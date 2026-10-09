/**
 * Tool: check_pii — pattern-based PII detection.
 *
 * Reports PII TYPES and counts — never raw matched values. Evidence
 * text samples are masked because a PII scanner must not echo the
 * PII it found. Detection is pattern-based and not exhaustive.
 */

import * as z from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import {
  contentField,
  truncationSchema,
  engineIdentitySchema,
  toolErrorSchema
} from '../schemas/common';
import { assessPii } from '../adapters/llmverify';
import { TruncationTracker, maskFindingEvidence } from '../security/bounds';
import { enforceResponseBudget } from '../security/size';
import { ADAPTER_CONTRACT_VERSION, ADAPTER_NAME, adapterVersion } from '../contracts/version';
import { okResult, errorResult } from '../contracts/results';
import { VERSION as ENGINE_VERSION } from '../../index';

const inputSchema = z.object({
  content: contentField.describe('Text to scan for PII indicators')
});

const outputSchema = z.looseObject({
  adapter: z.object({
    name: z.string(),
    version: z.string(),
    contractVersion: z.string()
  }),
  engine: engineIdentitySchema,
  evaluation: z.enum(['COMPLETED', 'PARTIAL', 'FAILED']),
  piiDetected: z.boolean(),
  riskScore: z.number(),
  piiTypes: z.array(z.string()),
  findings: z
    .array(z.looseObject({}))
    .describe(
      'Findings with sensitive values masked — raw PII is never ' +
        'returned in tool output'
    ),
  findingsCount: z.number(),
  methodology: z.string(),
  limitations: z.array(z.string()),
  output: truncationSchema,
  error: toolErrorSchema.optional()
});

export function registerPiiTool(server: McpServer): void {
  server.registerTool(
    'check_pii',
    {
      title: 'Check for PII',
      description:
        'Pattern-based PII scan returning PII types, counts, and ' +
        'masked findings — raw sensitive values are never returned. ' +
        'Coverage is heuristic and NOT exhaustive: absence of ' +
        'findings does not prove content is PII-free.',
      inputSchema,
      outputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async ({ content }) => {
      try {
        const assessment = assessPii(content);
        const t = new TruncationTracker();
        const findings = t
          .bound(assessment.findings, 'findings')
          .map((f: any, i: number) => {
            const masked = maskFindingEvidence(f);
            return {
              id: masked?.id,
              category: masked?.category,
              severity: masked?.severity,
              message: t.text(masked?.message, `findings[${i}].message`),
              recommendation: t.text(
                masked?.recommendation,
                `findings[${i}].recommendation`
              ),
              evidence: masked?.evidence,
              confidence: masked?.confidence,
              limitations: t.bound(
                masked?.limitations,
                `findings[${i}].limitations`
              )
            };
          });

        const structured: Record<string, unknown> = {
          adapter: {
            name: ADAPTER_NAME,
            version: adapterVersion(),
            contractVersion: ADAPTER_CONTRACT_VERSION
          },
          engine: { name: 'llmverify', version: ENGINE_VERSION },
          evaluation: 'COMPLETED',
          piiDetected: assessment.containsPII,
          riskScore: assessment.riskScore,
          piiTypes: assessment.piiTypes,
          findings: findings as Record<string, unknown>[],
          findingsCount: assessment.findings.length,
            methodology:
              'Pattern-based PII detection across common formats ' +
              '(emails, phones, payment cards, identifiers). Matched ' +
              'values are masked in all tool output.',
            limitations: [
              'Pattern coverage is not exhaustive — regional or novel PII formats may be missed',
              'piiDetected=false does not prove the content is PII-free',
              'Raw PII values are withheld from output by design'
            ],
            output: t.report()
        };

        const finalStructured = enforceResponseBudget(structured, (s) => {
          const omitted = (s.findings as unknown[]).length;
          return {
            ...s,
            findings: [],
            findingsOmitted: omitted,
            output: {
              truncated: true,
              truncations: [
                ...(s.output as { truncations: unknown[] }).truncations,
                { path: 'findings', omitted }
              ]
            }
          };
        });

        return okResult(
          finalStructured,
          assessment.containsPII
            ? `PII detected: ${assessment.piiTypes.join(', ') || 'unspecified'} — ` +
                `${assessment.findings.length} finding(s), risk ${assessment.riskScore.toFixed(2)}. ` +
                'Raw values withheld.'
            : `No PII indicators observed (risk ${assessment.riskScore.toFixed(2)}). ` +
                'Not a guarantee — pattern coverage is not exhaustive.'
        );
      } catch (err) {
        return errorResult(err);
      }
    }
  );
}
