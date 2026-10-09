/**
 * Tool: assess_hallucination_risk — heuristic hallucination-risk signals.
 *
 * Uses the engine's HallucinationEngine directly: pure analysis, no
 * usage/audit/baseline writes. The output is a RISK SIGNAL — a claim
 * flagged here is not established as factually false, and an unflagged
 * claim is not established as true. Ground-truth verification is out
 * of scope for this engine and adapter.
 */

import * as z from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import {
  contentField,
  truncationSchema,
  engineIdentitySchema,
  toolErrorSchema
} from '../schemas/common';
import { assessHallucinationRisk } from '../adapters/llmverify';
import { TruncationTracker } from '../security/bounds';
import { ADAPTER_CONTRACT_VERSION, ADAPTER_NAME, adapterVersion } from '../contracts/version';
import { okResult, errorResult } from '../contracts/results';
import { VERSION as ENGINE_VERSION } from '../../index';

const inputSchema = z.object({
  content: contentField
});

const outputSchema = z.looseObject({
  adapter: z.object({
    name: z.string(),
    version: z.string(),
    contractVersion: z.string()
  }),
  engine: engineIdentitySchema,
  evaluation: z.enum(['COMPLETED', 'PARTIAL', 'FAILED']),
  riskScore: z.number(),
  riskLabel: z
    .enum(['low', 'medium', 'high'])
    .describe(
      "Engine-authoritative classification from llmverify's exported " +
        'getHallucinationLabel() — the hallucination engine\'s own ' +
        'label semantics, distinct from the verify() risk.level bands.'
    ),
  riskIndicators: z.looseObject({}),
  suspiciousClaims: z.array(z.looseObject({})),
  claimsEvaluated: z.number(),
  confidence: z.looseObject({}).optional(),
  methodology: z.string(),
  limitations: z.array(z.string()),
  output: truncationSchema,
  error: toolErrorSchema.optional()
});

export function registerHallucinationTool(server: McpServer): void {
  server.registerTool(
    'assess_hallucination_risk',
    {
      title: 'Assess Hallucination Risk',
      description:
        'Heuristic hallucination-RISK assessment of AI-generated text ' +
        'using llmverify linguistic pattern analysis (claim ' +
        'specificity, citations, vague language, contradictions). ' +
        'IMPORTANT: a high risk score means claims warrant human ' +
        'review — it does NOT establish that any claim is factually ' +
        'false, and a low score does NOT establish truth.',
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
        const assessment = await assessHallucinationRisk(content);
        const t = new TruncationTracker();
        const suspiciousClaims = t
          .bound(assessment.suspiciousClaims, 'suspiciousClaims')
          .map((claim: any, i: number) => ({
            ...claim,
            text: t.text(claim?.text, `suspiciousClaims[${i}].text`),
            limitations: t.bound(
              claim?.limitations,
              `suspiciousClaims[${i}].limitations`
            )
          }));

        return okResult(
          {
            adapter: {
              name: ADAPTER_NAME,
              version: adapterVersion(),
              contractVersion: ADAPTER_CONTRACT_VERSION
            },
            engine: { name: 'llmverify', version: ENGINE_VERSION },
            evaluation: 'COMPLETED',
            riskScore: assessment.riskScore,
            riskLabel: assessment.riskLabel,
            riskIndicators: assessment.riskIndicators as Record<string, unknown>,
            suspiciousClaims: suspiciousClaims as Record<string, unknown>[],
            claimsEvaluated: assessment.claimsEvaluated,
            confidence: assessment.confidence as Record<string, unknown>,
            methodology: assessment.methodology,
            limitations: [
              ...assessment.limitations,
              'Risk signals do not verify factual accuracy — no ground-truth check is performed',
              'A low score does not mean the content is true or safe'
            ],
            output: t.report()
          } as Record<string, unknown>,
          `Hallucination risk: ${assessment.riskLabel} (${assessment.riskScore.toFixed(2)}) — ` +
            `${suspiciousClaims.length}/${assessment.claimsEvaluated} claims flagged for review. ` +
            'Risk signal only; not a factual verdict.'
        );
      } catch (err) {
        return errorResult(err);
      }
    }
  );
}

// re-export for tests
export { ENGINE_VERSION };
