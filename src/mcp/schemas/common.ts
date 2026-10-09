/**
 * Shared zod v4 schema fragments for tool inputs and outputs.
 */

import * as z from 'zod';
import { LIMITS } from '../security/limits';

export const contentField = z
  .string()
  .min(1, 'content must not be empty')
  .max(
    LIMITS.maxInputChars,
    `content exceeds adapter limit of ${LIMITS.maxInputChars} characters`
  )
  .describe('AI-generated text to evaluate. Never executed.');

export const auditStatusSchema = z
  .enum(['PERSISTED', 'DISABLED', 'FAILED', 'NOT_ATTEMPTED'])
  .describe(
    'Actual persistence outcome of the audit write — a successful ' +
      'verification does NOT imply a persisted audit record'
  );

export const auditReceiptSchema = z.object({
  status: auditStatusSchema,
  filePath: z.string().optional(),
  entryDigest: z
    .string()
    .optional()
    .describe(
      "Integrity digest 'sha256:<hex>' over the canonical stored record. " +
        'Tamper-evidence only — NOT a digital signature or proof of ' +
        'producer authenticity.'
    ),
  error: z.string().optional()
});

export const truncationSchema = z.object({
  truncated: z.boolean(),
  truncations: z.array(
    z.object({
      path: z.string(),
      omitted: z.number()
    })
  )
});

export const engineIdentitySchema = z.object({
  name: z.string(),
  version: z.string()
});

export const toolErrorSchema = z.object({
  name: z.string(),
  code: z.string(),
  message: z.string(),
  recoverable: z.boolean().optional(),
  details: z.record(z.string(), z.unknown()).optional()
});

export const ENGINE_IDS = [
  'hallucination',
  'consistency',
  'jsonValidator',
  'csm6'
] as const;

/**
 * Bounds on caller-supplied JSON Schema input (`expectedSchema`): caps
 * serialized size and nesting depth so a malicious/giant schema cannot
 * exhaust the validator or the response budget.
 */
const MAX_SCHEMA_BYTES = 64 * 1024;
const MAX_SCHEMA_DEPTH = 32;

function jsonDepth(value: unknown, depth: number): number {
  if (depth > MAX_SCHEMA_DEPTH || value === null || typeof value !== 'object') {
    return depth;
  }
  const children = Array.isArray(value)
    ? value
    : Object.values(value as Record<string, unknown>);
  let max = depth;
  for (const child of children) {
    const d = jsonDepth(child, depth + 1);
    if (d > max) max = d;
    if (max > MAX_SCHEMA_DEPTH) break;
  }
  return max;
}

export const jsonSchemaField = z
  .record(z.string(), z.unknown())
  .refine(
    (v) => Buffer.byteLength(JSON.stringify(v), 'utf-8') <= MAX_SCHEMA_BYTES,
    `expectedSchema exceeds ${MAX_SCHEMA_BYTES} serialized bytes`
  )
  .refine(
    (v) => jsonDepth(v, 0) <= MAX_SCHEMA_DEPTH,
    `expectedSchema exceeds ${MAX_SCHEMA_DEPTH} levels of nesting`
  );
