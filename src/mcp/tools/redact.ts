/**
 * Tool: redact_pii — in-memory PII redaction.
 *
 * Pure string transformation via the engine's redactPII(). No
 * filesystem mutation, no external transmission. Original matched
 * values are never returned — only the redacted output plus
 * redaction type/position metadata.
 */

import * as z from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import {
  contentField,
  truncationSchema,
  engineIdentitySchema,
  toolErrorSchema
} from '../schemas/common';
import { redactPii } from '../adapters/llmverify';
import { TruncationTracker } from '../security/bounds';
import {
  enforceResponseBudget,
  getMaxOutputBytes,
  measureBytes,
  outputSizeError
} from '../security/size';
import { ADAPTER_CONTRACT_VERSION, ADAPTER_NAME, adapterVersion } from '../contracts/version';
import { okResult, errorResult } from '../contracts/results';
import { VERSION as ENGINE_VERSION } from '../../index';

const inputSchema = z.object({
  content: contentField.describe('Text to redact PII from'),
  replacement: z
    .string()
    .max(64)
    .optional()
    .describe(
      'Replacement marker. Default: engine default ([REDACTED]).'
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
  redacted: z.string(),
  piiCount: z.number(),
  redactions: z.array(
    z.object({
      type: z.string(),
      position: z.number()
    })
  ),
  limitations: z.array(z.string()),
  output: truncationSchema,
  error: toolErrorSchema.optional()
});

export function registerRedactTool(server: McpServer): void {
  server.registerTool(
    'redact_pii',
    {
      title: 'Redact PII',
      description:
        'Return a PII-redacted copy of the supplied text using ' +
        'llmverify pattern redaction. Original matched values are ' +
        'never returned. Pattern coverage is not exhaustive — review ' +
        'output before relying on it for disclosure decisions.',
      inputSchema,
      outputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async ({ content, replacement }) => {
      try {
        const result = redactPii(content, replacement);
        const t = new TruncationTracker();
        const redactions = t.bound(result.redactions, 'redactions');

        // A redacted document that does not fit the budget is a
        // SIZE-LIMIT RESULT, never a truncated string passed off as a
        // complete redaction — a truncated redaction could silently
        // corrupt downstream content.
        const budget = getMaxOutputBytes();
        if (measureBytes(result.redacted) > budget) {
          return errorResult(
            outputSizeError(
              measureBytes(result.redacted),
              budget,
              'the redacted document itself exceeds the response ' +
                'budget and cannot be returned safely truncated; ' +
                'raise LLMVERIFY_MCP_MAX_OUTPUT_BYTES or call the ' +
                'llmverify redactPII API directly for large documents'
            )
          );
        }

        const structured: Record<string, unknown> = {
          adapter: {
            name: ADAPTER_NAME,
            version: adapterVersion(),
            contractVersion: ADAPTER_CONTRACT_VERSION
          },
          engine: { name: 'llmverify', version: ENGINE_VERSION },
          evaluation: 'COMPLETED',
          redacted: result.redacted,
          piiCount: result.piiCount,
          redactions,
          limitations: [
            'Pattern-based redaction is not exhaustive — verify output before disclosure use',
            'Original values are withheld by design; use position metadata for review'
          ],
          output: t.report()
        };

        const finalStructured = enforceResponseBudget(structured, (s) => {
          const omitted = (s.redactions as unknown[]).length;
          return {
            ...s,
            redactions: [],
            redactionsOmitted: omitted,
            output: {
              truncated: true,
              truncations: [
                ...(s.output as { truncations: unknown[] }).truncations,
                { path: 'redactions', omitted }
              ]
            }
          };
        });

        return okResult(
          finalStructured,
          `Redacted ${result.piiCount} PII match(es). Pattern coverage ` +
            'is not exhaustive — review before disclosure use.'
        );
      } catch (err) {
        return errorResult(err);
      }
    }
  );
}
