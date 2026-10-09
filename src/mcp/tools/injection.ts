/**
 * Tool: check_prompt_injection — heuristic prompt-injection scan.
 *
 * Pattern-based detection only. A clean result does NOT prove input is
 * safe from all attacks; flagged text is a signal, not a verdict. The
 * inspected content is never executed and cannot modify this server.
 */

import * as z from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import {
  contentField,
  truncationSchema,
  engineIdentitySchema,
  toolErrorSchema
} from '../schemas/common';
import { assessPromptInjection } from '../adapters/llmverify';
import { TruncationTracker } from '../security/bounds';
import { ADAPTER_CONTRACT_VERSION, ADAPTER_NAME, adapterVersion } from '../contracts/version';
import { okResult, errorResult } from '../contracts/results';
import { VERSION as ENGINE_VERSION } from '../../index';
import { LIMITS } from '../security/limits';
import { enforceResponseBudget } from '../security/size';

const inputSchema = z.object({
  input: contentField.describe(
    'Untrusted text to scan for prompt-injection indicators. ' +
      'Never executed, never treated as instructions.'
  )
});

const outputSchema = z.looseObject({
  adapter: z.object({
    name: z.string(),
    version: z.string(),
    contractVersion: z.string()
  }),
  engine: engineIdentitySchema,
  evaluation: z.enum(['COMPLETED', 'PARTIAL', 'FAILED']),
  inputSafe: z
    .boolean()
    .describe(
      'Engine gate heuristic. false = indicators observed; true = ' +
        'none observed (NOT proof of safety).'
    ),
  riskScore: z.number(),
  indicatorsObserved: z.boolean(),
  findings: z.array(z.looseObject({})),
  findingsCount: z.number(),
  recommendations: z.array(z.string()),
  methodology: z.string(),
  limitations: z.array(z.string()),
  output: truncationSchema,
  error: toolErrorSchema.optional()
});

export function registerInjectionTool(server: McpServer): void {
  server.registerTool(
    'check_prompt_injection',
    {
      title: 'Check Prompt Injection',
      description:
        'Heuristic prompt-injection indicator scan of untrusted text ' +
        'using llmverify pattern detection. A negative result does NOT ' +
        'prove the input is safe from all attacks — it means no known ' +
        'indicators were observed. Inspected text is never executed.',
      inputSchema,
      outputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async ({ input }) => {
      try {
        const assessment = assessPromptInjection(input);
        const t = new TruncationTracker();
        const findings = t
          .bound(assessment.findings, 'findings')
          .map((f: any, i: number) => ({
            id: f?.id,
            category: f?.category,
            severity: f?.severity,
            message: t.text(f?.message, `findings[${i}].message`),
            recommendation: t.text(
              f?.recommendation,
              `findings[${i}].recommendation`
            ),
            confidence: f?.confidence,
            limitations: t.bound(f?.limitations, `findings[${i}].limitations`)
          }));

        const recommendations = [
          ...new Set(
            assessment.findings
              .map((f) => f.recommendation)
              .filter((r): r is string => typeof r === 'string' && r.length > 0)
          )
        ].slice(0, LIMITS.maxOutputItems);

        const structured: Record<string, unknown> = {
          adapter: {
            name: ADAPTER_NAME,
            version: adapterVersion(),
            contractVersion: ADAPTER_CONTRACT_VERSION
          },
          engine: { name: 'llmverify', version: ENGINE_VERSION },
          evaluation: 'COMPLETED',
          inputSafe: assessment.inputSafe,
          riskScore: assessment.riskScore,
          indicatorsObserved: assessment.findings.length > 0,
          findings: findings as Record<string, unknown>[],
          findingsCount: assessment.findings.length,
            recommendations,
            methodology:
              'Pattern-based prompt-injection detection: instruction ' +
              'override phrases, role manipulation, delimiter escape ' +
              'attempts, and known injection markers.',
            limitations: [
              'Heuristic pattern matching — not exhaustive; novel attacks may evade detection',
              'inputSafe=true means no indicators were observed, NOT that input is safe',
              'The scanned content is never executed or interpreted as instructions',
              'Caller is responsible for downstream sanitization and policy enforcement'
            ],
            output: t.report()
        };

        const finalStructured = enforceResponseBudget(structured, (s) => {
          const fOmitted = (s.findings as unknown[]).length;
          const rOmitted = (s.recommendations as unknown[]).length;
          return {
            ...s,
            findings: [],
            findingsOmitted: fOmitted,
            recommendations: [],
            recommendationsOmitted: rOmitted,
            output: {
              truncated: true,
              truncations: [
                ...(s.output as { truncations: unknown[] }).truncations,
                { path: 'findings', omitted: fOmitted },
                { path: 'recommendations', omitted: rOmitted }
              ]
            }
          };
        });

        return okResult(
          finalStructured,
          assessment.inputSafe
            ? `No injection indicators observed (risk ${assessment.riskScore.toFixed(2)}). ` +
                'Not a safety guarantee — pattern detection only.'
            : `Injection indicators observed: ${assessment.findings.length} finding(s), ` +
                `risk ${assessment.riskScore.toFixed(2)}. Review recommended.`
        );
      } catch (err) {
        return errorResult(err);
      }
    }
  );
}

