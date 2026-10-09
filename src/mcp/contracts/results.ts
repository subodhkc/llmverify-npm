/**
 * Shared result-envelope helpers used by every tool handler.
 *
 * Every tool returns `structuredContent` (machine contract) plus a
 * bounded human-readable `content` text block. Errors are returned as
 * `isError: true` results carrying a NormalizedToolError — never thrown
 * past the handler boundary.
 */

import type { CallToolResult } from '@modelcontextprotocol/server';
import { normalizeError, type NormalizedToolError } from '../errors/index';
import type { TruncationReport } from '../security/bounds';

export function okResult(
  structured: Record<string, unknown>,
  summary: string
): CallToolResult {
  return {
    content: [{ type: 'text', text: summary }],
    structuredContent: structured
  };
}

export function errorResult(err: unknown): CallToolResult {
  const normalized = normalizeError(err);
  const structured: Record<string, unknown> = {
    error: normalized
  };
  return {
    isError: true,
    content: [
      {
        type: 'text',
        text: `${normalized.name} [${normalized.code}]: ${normalized.message}`
      }
    ],
    structuredContent: structured
  };
}

export function summarizeLines(lines: string[]): string {
  return lines.filter(Boolean).join('\n');
}

export type { NormalizedToolError, TruncationReport };
