/**
 * Public-API integration layer for the `llmverify` engine.
 *
 * HARD RULE: this module imports only from the package root
 * (`../../index.js` — the public export surface, nothing internal).
 * If the public exports can't express something, that's a public-API
 * change, not an adapter workaround.
 *
 * This module also owns:
 *  - the serialized execution lane for stateful verify() calls
 *    (usage counter / audit / baseline writes are atomic per-write but
 *    not cross-process coordinated — see docs/SECURITY.md), and
 *  - the adapter-level execution timeout.
 */

import {
  verify,
  validateVerifyResult,
  getVerifyResultSchemaPath,
  getEngineCapabilities,
  getPackageInfo,
  getLLMVerifyHome,
  getLogDir,
  getAuditDir,
  getBaselineDir,
  getUsageFile,
  RESULT_SCHEMA_VERSION,
  VERSION,
  DEFAULT_CONFIG,
  HallucinationEngine,
  checkPromptInjection,
  getInjectionRiskScore,
  isInputSafe,
  checkPII,
  containsPII,
  getPIIRiskScore,
  redactPII
} from '../../index';
import type {
  Config,
  Finding,
  VerifyOptions,
  VerifyResult
} from '../../index';

import { LIMITS, withTimeout } from '../security/limits';
import { verifyLane } from '../security/lane';
import { getHallucinationLabel } from '../../index';
import type { HallucinationLabel } from '../../index';

export type VerificationProfile =
  | 'baseline'
  | 'high_risk'
  | 'finance'
  | 'health'
  | 'research';

export const VALID_ENGINE_IDS = [
  'hallucination',
  'consistency',
  'jsonValidator',
  'csm6'
] as const;

export type EngineId = (typeof VALID_ENGINE_IDS)[number];

export interface VerifyToolInput {
  content: string;
  profile?: VerificationProfile;
  isJSON?: boolean;
  expectedSchema?: Record<string, unknown>;
  skipEngines?: EngineId[];
  requireAuditPersistence?: boolean;
}

/**
 * Public MCP engine identifiers → the identifiers the engine's
 * `context.skipEngines` actually recognizes. The engine names its JSON
 * validator 'json' internally; the public tool contract keeps the
 * descriptive 'jsonValidator' and maps it here.
 */
const PUBLIC_TO_ENGINE_ID: Record<EngineId, string> = {
  hallucination: 'hallucination',
  consistency: 'consistency',
  jsonValidator: 'json',
  csm6: 'csm6'
};

/**
 * General verification. Returns the engine's VerifyResult — semantics
 * preserved verbatim (notChecked, risk, limitations, audit receipt).
 * Throws typed engine errors; callers normalize them for MCP.
 */
export async function verifyContent(
  input: VerifyToolInput
): Promise<VerifyResult> {
  const config: Partial<Config> = {};
  if (input.profile !== undefined) {
    config.engines = {
      ...DEFAULT_CONFIG.engines,
      csm6: { ...DEFAULT_CONFIG.engines.csm6, profile: input.profile }
    };
  }

  const options: VerifyOptions = {
    content: input.content,
    config: Object.keys(config).length > 0 ? config : undefined,
    context: {
      isJSON: input.isJSON,
      expectedSchema: input.expectedSchema,
      // Translate public engine ids → engine-internal ids ('jsonValidator' → 'json')
      skipEngines: input.skipEngines?.map((id) => PUBLIC_TO_ENGINE_ID[id])
    },
    audit: {
      requirePersistence: input.requireAuditPersistence === true
    }
  };

  // The engine returns a fully-formed VerifyResult; we validate it
  // against the shipped contract before exposing it (defense in depth —
  // a contract violation becomes an adapter error, not a bad payload).
  //
  // verifyLane serializes stateful calls; its timeout races the CALLER'S
  // promise only — the underlying verify() keeps the lane until it
  // actually settles, so a timed-out call can never overlap a later one.
  const result = await verifyLane.run(() => verify(options));

  const check = validateVerifyResult(result);
  if (!check.valid) {
    const err = new Error(
      `Engine result failed contract validation: ${check.errors
        .slice(0, 5)
        .join('; ')}`
    );
    (err as { code?: string }).code = 'MCP_ADAPTER_CONTRACT_VIOLATION';
    throw err;
  }

  return result;
}

export interface HallucinationAssessment {
  riskScore: number;
  /**
   * Engine-authoritative label from llmverify's exported
   * `getHallucinationLabel()` — 'low' | 'medium' | 'high'. This is the
   * engine's own classification of its hallucination-risk score; the
   * adapter does NOT re-derive it from the general risk-scoring
   * thresholds (different score type, different semantics).
   */
  riskLabel: HallucinationLabel;
  riskIndicators: unknown;
  suspiciousClaims: unknown[];
  claimsEvaluated: number;
  confidence: unknown;
  methodology: string;
  limitations: string[];
}

/**
 * Heuristic hallucination-risk assessment via the engine's
 * HallucinationEngine. Read-only: this path performs no usage, audit,
 * or baseline writes. A risk SIGNAL only — never a factual verdict.
 */
export async function assessHallucinationRisk(
  content: string
): Promise<HallucinationAssessment> {
  const engine = new HallucinationEngine(DEFAULT_CONFIG);
  const result = await withTimeout(engine.detect(content), LIMITS.toolTimeoutMs);
  return {
    riskScore: result.riskScore,
    riskLabel: getHallucinationLabel(result.riskScore),
    riskIndicators: result.riskIndicators,
    suspiciousClaims: result.suspiciousClaims,
    claimsEvaluated: result.claims.length,
    confidence: result.confidence,
    methodology: result.methodology,
    limitations: result.limitations
  };
}

export interface InjectionAssessment {
  inputSafe: boolean;
  riskScore: number;
  findings: Finding[];
}

export function assessPromptInjection(input: string): InjectionAssessment {
  return {
    inputSafe: isInputSafe(input),
    riskScore: getInjectionRiskScore(input),
    findings: checkPromptInjection(input)
  };
}

export interface PiiAssessment {
  containsPII: boolean;
  riskScore: number;
  findings: Finding[];
  piiTypes: string[];
}

/**
 * Extract distinct PII type labels from engine findings.
 * Engine contract: PII findings carry `metadata.piiType` (plus
 * `metadata.piiCategory`). Findings with missing/unexpected metadata
 * contribute no type — they are still counted in findingsCount.
 */
export function extractPiiTypes(findings: Finding[]): string[] {
  return [
    ...new Set(
      findings
        .map(
          (f) => (f.metadata as { piiType?: string } | undefined)?.piiType
        )
        .filter((t): t is string => typeof t === 'string')
    )
  ];
}

export function assessPii(content: string): PiiAssessment {
  const findings = checkPII(content);
  const types = extractPiiTypes(findings);
  return {
    containsPII: containsPII(content),
    riskScore: getPIIRiskScore(content),
    findings,
    piiTypes: types
  };
}

export interface PiiRedaction {
  redacted: string;
  piiCount: number;
  /** `original` values are deliberately withheld — never echoed back. */
  redactions: Array<{ type: string; position: number }>;
}

export function redactPii(
  content: string,
  replacement?: string
): PiiRedaction {
  const out =
    replacement === undefined ? redactPII(content) : redactPII(content, replacement);
  return {
    redacted: out.redacted,
    piiCount: out.piiCount,
    redactions: out.redactions.map((r) => ({
      type: r.type,
      position: r.position
    }))
  };
}

/**
 * Capability discovery — straight pass-through of engine metadata.
 *
 * Absolute host paths are withheld by default: a capability call
 * should not leak the operator's local filesystem layout to an MCP
 * client. `includeLocalPaths` is the deliberate opt-in for that
 * diagnostic detail.
 */
export function describeCapabilities(includeLocalPaths = false) {
  return {
    package: getPackageInfo(),
    adapterContractVersion: 'see contracts/version.ts',
    resultSchemaVersion: RESULT_SCHEMA_VERSION,
    engineVersion: VERSION,
    capabilities: getEngineCapabilities(),
    localState: {
      fields: [
        'home',
        'logDir',
        'auditDir',
        'baselineDir',
        'usageFile'
      ] as const,
      envOverrides: [
        'LLMVERIFY_HOME',
        'LLMVERIFY_LOG_DIR',
        'LLMVERIFY_AUDIT_DIR',
        'LLMVERIFY_BASELINE_DIR',
        'LLMVERIFY_USAGE_FILE'
      ] as const,
      note:
        'llmverify writes usage counters, audit JSONL (if enabled), ' +
        'baseline state and operational logs under these locations ' +
        '(default: ~/.llmverify). Zero network access does not mean ' +
        'zero local writes. Absolute paths are withheld by default — ' +
        'pass includeLocalPaths: true to disclose them.',
      ...(includeLocalPaths
        ? {
            paths: {
              home: getLLMVerifyHome(),
              logDir: getLogDir(),
              auditDir: getAuditDir(),
              baselineDir: getBaselineDir(),
              usageFile: getUsageFile()
            }
          }
        : {})
    },
    resultSchemaFile: includeLocalPaths ? getVerifyResultSchemaPath() : null
  };
}
