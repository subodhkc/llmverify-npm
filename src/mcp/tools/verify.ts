/**
 * Tool: verify_llm_content — the primary verification tool.
 *
 * Maps MCP input → engine VerifyOptions → VerifyResult → bounded
 * structuredContent. Result semantics are preserved verbatim:
 * notChecked stays notChecked, audit receipts stay honest, and a
 * heuristic risk score is never presented as a verdict.
 */

import * as z from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import {
  contentField,
  auditReceiptSchema,
  truncationSchema,
  engineIdentitySchema,
  toolErrorSchema,
  jsonSchemaField,
  ENGINE_IDS
} from '../schemas/common';
import {
  verifyContent,
  type VerifyToolInput
} from '../adapters/llmverify';
import { boundVerifyResult, type TruncationReport } from '../security/bounds';
import { enforceResponseBudget } from '../security/size';
import { ADAPTER_CONTRACT_VERSION, ADAPTER_NAME, adapterVersion } from '../contracts/version';
import { okResult, errorResult } from '../contracts/results';

const inputSchema = z.object({
  content: contentField,
  profile: z
    .enum(['baseline', 'high_risk', 'finance', 'health', 'research'])
    .optional()
    .describe(
      'CSM6 evaluation profile applied to this call (config.csm6.profile).'
    ),
  isJSON: z
    .boolean()
    .optional()
    .describe(
      'Declare that content is intended as JSON. Gates the JSON ' +
        'validator onto non-JSON input and affects which engines run.'
    ),
  expectedSchema: jsonSchemaField
    .optional()
    .describe(
      'JSON Schema object the JSON validator should check content ' +
        'against. Only meaningful with isJSON: true.'
    ),
  skipEngines: z
    .array(z.enum(ENGINE_IDS))
    .optional()
    .describe(
      'Engine identifiers to skip for this call. The adapter maps the ' +
        'public id jsonValidator onto the engine-internal id "json". ' +
        'Skipped engines are reported in notChecked under their ' +
        'engine-internal names — never as success.'
    ),
  requireAuditPersistence: z
    .boolean()
    .optional()
    .describe(
      'Evidence-required mode. When true, the tool fails unless the ' +
        'audit record is actually PERSISTED (FAILED, DISABLED and ' +
        'NOT_ATTEMPTED all escalate to a typed error).'
    )
});

const outputSchema = z.looseObject({
  adapter: z.object({
    name: z.string(),
    version: z.string(),
    contractVersion: z.string()
  }),
  engine: engineIdentitySchema,
  resultSchemaVersion: z
    .string()
    .describe('llmverify result schema version — currently 1.0'),
  risk: z.looseObject({
    overall: z.number(),
    level: z.enum(['low', 'moderate', 'high', 'critical']),
    action: z.enum(['allow', 'review', 'block']),
    interpretation: z.string()
  }),
  enginesExecuted: z.array(z.string()),
  enginesNotChecked: z
    .array(z.string())
    .describe(
      'Engines that did NOT evaluate this input. NOT_CHECKED is not ' +
        'success and not failure — it is unassessed work.'
    ),
  limitations: z.array(z.string()),
  audit: auditReceiptSchema,
  engineResults: z.looseObject({}).describe(
    'Bounded pass-through of per-engine results (hallucination, ' +
      'consistency, json, csm6). See llmverify VerifyResult contract.'
  ),
  meta: z.looseObject({}),
  warnings: z.array(z.string()),
  output: truncationSchema,
  privacy: z
    .object({
      piiFieldsMasked: z.number(),
      policy: z.string()
    })
    .describe(
      'Privacy projection applied to input-echoing fields — ' +
        'piiFieldsMasked counts fields where engine-detected PII was ' +
        'masked. The internal engine result is richer; this response ' +
        'is the privacy-filtered projection.'
    ),
  error: toolErrorSchema.optional()
});

export function registerVerifyTool(server: McpServer): void {
  server.registerTool(
    'verify_llm_content',
    {
      title: 'Verify LLM Content',
      description:
        'Run llmverify heuristic verification on AI-generated text: ' +
        'hallucination-risk signals, consistency, JSON validation, and ' +
        'CSM6 security/PII/injection findings. Returns a structured ' +
        'risk assessment with explicit limitations and an honest audit ' +
        'persistence receipt. Results are heuristic risk SIGNALS for ' +
        'triage — not factual verification, safety certification, or ' +
        'compliance clearance.',
      inputSchema,
      outputSchema,
      annotations: {
        // Not readOnly: verify() may increment a local usage counter and
        // append an audit record under the configured state directory.
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false
      }
    },
    async (args) => {
      try {
        const result = await verifyContent(args as VerifyToolInput);
        const { result: bounded, output, privacy } =
          boundVerifyResult(result);

        const structured: Record<string, unknown> = {
          adapter: {
            name: ADAPTER_NAME,
            version: adapterVersion(),
            contractVersion: ADAPTER_CONTRACT_VERSION
          },
          engine: { name: 'llmverify', version: bounded.meta.version },
          resultSchemaVersion: bounded.schemaVersion,
          risk: bounded.risk,
          enginesExecuted: bounded.meta.enginesUsed,
          enginesNotChecked: bounded.notChecked,
          limitations: bounded.limitations,
          audit: bounded.audit ?? { status: 'NOT_ATTEMPTED' },
          engineResults: {
            ...(bounded.hallucination
              ? { hallucination: bounded.hallucination }
              : {}),
            ...(bounded.consistency
              ? { consistency: bounded.consistency }
              : {}),
            ...(bounded.json ? { json: bounded.json } : {}),
            ...(bounded.csm6 ? { csm6: bounded.csm6 } : {})
          },
          meta: bounded.meta,
          warnings: bounded.warnings ?? [],
          output,
          privacy
        };

        // Serialized-size budget: if the envelope exceeds it, drop the
        // bulky engineResults pass-through (counts + names preserved),
        // re-measure, and fail with a typed size error if still over.
        const finalStructured = enforceResponseBudget(structured, (s) => {
          const truncations = [
            ...output.truncations,
            { path: 'engineResults', omitted: 1 }
          ];
          return {
            ...s,
            engineResults: {
              omittedForSize: true,
              engines: Object.keys(
                s.engineResults as Record<string, unknown>
              )
            },
            output: { truncated: true, truncations } as TruncationReport
          };
        });
        const finalOutput = finalStructured.output as TruncationReport;

        const audit = structured.audit as { status: string };
        const summary = [
          `Risk: ${bounded.risk.level} (${bounded.risk.overall}) — action: ${bounded.risk.action}`,
          `Engines run: ${(bounded.meta.enginesUsed as string[]).join(', ') || 'none'}`,
          bounded.notChecked.length > 0
            ? `Not evaluated: ${(bounded.notChecked as string[]).join(', ')}`
            : null,
          `Audit: ${audit.status}`,
          finalOutput.truncated
            ? `Output truncated: ${finalOutput.truncations.map((t) => `${t.path}(-${t.omitted})`).join(', ')}`
            : null,
          'Note: heuristic risk signal, not factual verification.'
        ]
          .filter(Boolean)
          .join('\n');

        return okResult(finalStructured, summary);
      } catch (err) {
        return errorResult(err);
      }
    }
  );
}
