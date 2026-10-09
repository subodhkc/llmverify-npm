/**
 * Engine Capability Discovery
 *
 * Static, truthful description of llmverify's public capabilities.
 * Intended for downstream integrations (e.g. a future MCP adapter) to
 * discover what the engine can and cannot do without importing
 * internal source paths.
 *
 * Every capability is described honestly: heuristics are labelled
 * heuristic, and NOT_CHECKED/UNSUPPORTED semantics are documented.
 *
 * @module capabilities
 * @author Haiec
 * @license MIT
 */

import { VERSION } from './constants';
import { RESULT_SCHEMA_VERSION } from './result-contract';

/**
 * A single callable capability exposed by the package.
 */
export interface EngineCapability {
  /** Stable capability identifier */
  id: string;
  /** Public function(s) providing this capability */
  entrypoints: string[];
  /** What the capability observes */
  observes: string;
  /** What the capability CANNOT establish — honest limitation */
  doesNotEstablish: string;
  /** Whether the capability performs network access by default */
  networkAccess: 'none' | 'opt-in';
  /** Whether input content is persisted anywhere */
  persistsContent: boolean;
}

/**
 * All public verification capabilities.
 */
export function getEngineCapabilities(): EngineCapability[] {
  return [
    {
      id: 'verify',
      entrypoints: ['verify', 'run', 'devVerify', 'prodVerify', 'strictVerify', 'fastVerify', 'ciVerify'],
      observes: 'Combined risk signals: hallucination-risk heuristics, internal consistency, JSON validity, CSM6 checks (prompt injection, PII, harmful content)',
      doesNotEstablish: 'Factual correctness, freedom from hallucination, safety certification, or compliance status',
      networkAccess: 'none',
      persistsContent: false
    },
    {
      id: 'hallucination-risk',
      entrypoints: ['HallucinationEngine', 'calculateHallucinationSignals', 'calculateHallucinationRisk', 'getHallucinationLabel'],
      observes: 'Linguistic risk indicators: low specificity, missing citations, vague language, contradiction signals, fabricated-statistic and overconfidence patterns',
      doesNotEstablish: 'That a claim is true or false — risk signals require human review against ground truth',
      networkAccess: 'none',
      persistsContent: false
    },
    {
      id: 'prompt-injection',
      entrypoints: ['checkPromptInjection', 'isInputSafe', 'sanitizePromptInjection', 'getInjectionRiskScore'],
      observes: 'Known prompt-injection and jailbreak patterns (OWASP LLM-01 aligned)',
      doesNotEstablish: 'Detection of novel, obfuscated, or context-dependent attacks',
      networkAccess: 'none',
      persistsContent: false
    },
    {
      id: 'pii-detection',
      entrypoints: ['checkPII', 'containsPII', 'redactPII', 'getPIIRiskScore'],
      observes: 'Pattern-based PII: emails, phone numbers, SSNs, credentials/keys, card numbers',
      doesNotEstablish: 'Exhaustive PII discovery — miss does not mean absent',
      networkAccess: 'none',
      persistsContent: false
    },
    {
      id: 'harmful-content',
      entrypoints: ['checkHarmfulContent'],
      observes: 'Keyword/pattern-based harmful content indicators',
      doesNotEstablish: 'Contextual judgement of intent, satire, or domain-appropriate content',
      networkAccess: 'none',
      persistsContent: false
    },
    {
      id: 'consistency',
      entrypoints: ['ConsistencyEngine'],
      observes: 'Internal similarity, drift, and contradiction patterns across text sections',
      doesNotEstablish: 'External factual accuracy or semantic equivalence under paraphrase',
      networkAccess: 'none',
      persistsContent: false
    },
    {
      id: 'json-validation',
      entrypoints: ['JSONValidatorEngine', 'detectAndRepairJson'],
      observes: 'JSON syntactic validity, optional schema conformance, repair attempts',
      doesNotEstablish: 'Semantic correctness of JSON content',
      networkAccess: 'none',
      persistsContent: false
    },
    {
      id: 'classification',
      entrypoints: ['ClassificationEngine', 'classify', 'detectIntent'],
      observes: 'Heuristic intent tags and hallucination-risk labels for prompt/output pairs',
      doesNotEstablish: 'Authoritative intent or calibrated probability',
      networkAccess: 'none',
      persistsContent: false
    },
    {
      id: 'runtime-monitoring',
      entrypoints: ['monitorLLM', 'isHealthy', 'getAlertLevel', 'LatencyEngine', 'TokenRateEngine', 'FingerprintEngine', 'StructureEngine', 'BaselineEngine', 'HealthScoreEngine'],
      observes: 'Local runtime telemetry for wrapped calls: latency, token rate, response structure, baseline drift',
      doesNotEstablish: 'Provider-side behavior; only what the wrapped client observable returned',
      networkAccess: 'none',
      persistsContent: false
    },
    {
      id: 'result-validation',
      entrypoints: ['validateVerifyResult', 'getVerifyResultSchemaPath', 'RESULT_SCHEMA_VERSION'],
      observes: 'Structural conformance of a VerifyResult to contract version 1.0',
      doesNotEstablish: 'Semantic validity of scores or findings',
      networkAccess: 'none',
      persistsContent: false
    },
    {
      id: 'audit-trail',
      entrypoints: ['AuditLogger', 'AuditLoggerV2', 'verifyAuditEntry'],
      observes: 'Local append-only audit records with SHA-256 integrity digests and explicit persistence receipts',
      doesNotEstablish: 'Producer authenticity (a digest is not a signature), off-host durability, or tamper-proof storage',
      networkAccess: 'none',
      persistsContent: false
    }
  ];
}

/**
 * Package-level integration metadata.
 */
export function getPackageInfo(): {
  name: string;
  version: string;
  resultSchemaVersion: string;
  node: string;
  localStateDir: string;
} {
  return {
    name: 'llmverify',
    version: VERSION,
    resultSchemaVersion: RESULT_SCHEMA_VERSION,
    node: '>=18.0.0',
    localStateDir: '~/.llmverify (override: LLMVERIFY_HOME)'
  };
}
