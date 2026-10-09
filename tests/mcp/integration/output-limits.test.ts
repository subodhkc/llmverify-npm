/**
 * Regression tests for truthful output limits:
 * - serialized structuredContent is budgeted as a whole
 * - a too-large result is degraded honestly (engineResults summary,
 *   explicit truncation records) or fails with a typed size error
 * - a redacted document is NEVER silently truncated — oversize yields
 *   an explicit MCP_ADAPTER_OUTPUT_TOO_LARGE error
 * - caller-supplied expectedSchema is bounded in bytes and depth
 */

import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  connectTestClient,
  structured,
  type ConnectedPair
} from '../helpers/client';

let pair: ConnectedPair;

beforeAll(async () => {
  process.env.LLMVERIFY_HOME = mkdtempSync(
    join(tmpdir(), 'llmverify-mcp-size-')
  );
  pair = await connectTestClient();
});

afterAll(async () => {
  delete process.env.LLMVERIFY_MCP_MAX_OUTPUT_BYTES;
  await pair.close();
  delete process.env.LLMVERIFY_HOME;
});

describe('serialized output budget', () => {
  it('verify_llm_content degrades engineResults honestly over budget', async () => {
    // ~2 KB budget: enough for the envelope, not for engineResults.
    process.env.LLMVERIFY_MCP_MAX_OUTPUT_BYTES = '2048';
    const result = await pair.client.callTool({
      name: 'verify_llm_content',
      arguments: { content: 'Some ordinary content to verify.' }
    });
    const sc = structured(result);
    if (result.isError) {
      // Even the degraded envelope exceeded the budget — typed error.
      expect((sc.error as { code: string }).code).toBe(
        'MCP_ADAPTER_OUTPUT_TOO_LARGE'
      );
    } else {
      const er = sc.engineResults as Record<string, unknown>;
      expect(er.omittedForSize).toBe(true);
      expect(Array.isArray(er.engines)).toBe(true);
      const output = sc.output as {
        truncated: boolean;
        truncations: Array<{ path: string }>;
      };
      expect(output.truncated).toBe(true);
      expect(output.truncations.map((t) => t.path)).toContain(
        'engineResults'
      );
    }
    delete process.env.LLMVERIFY_MCP_MAX_OUTPUT_BYTES;
  });

  it('returns MCP_ADAPTER_OUTPUT_TOO_LARGE when nothing can fit', async () => {
    process.env.LLMVERIFY_MCP_MAX_OUTPUT_BYTES = '200';
    const result = await pair.client.callTool({
      name: 'verify_llm_content',
      arguments: { content: 'anything' }
    });
    expect(result.isError).toBe(true);
    const sc = structured(result);
    expect((sc.error as { code: string }).code).toBe(
      'MCP_ADAPTER_OUTPUT_TOO_LARGE'
    );
    delete process.env.LLMVERIFY_MCP_MAX_OUTPUT_BYTES;
  });
});

describe('redact_pii size handling', () => {
  it('never returns a truncated redaction — explicit size error instead', async () => {
    // Content ~4 KB with one email; budget 1 KB is smaller than the
    // redacted document itself.
    process.env.LLMVERIFY_MCP_MAX_OUTPUT_BYTES = '1024';
    const filler = 'filler text '.repeat(400);
    const result = await pair.client.callTool({
      name: 'redact_pii',
      arguments: { content: `${filler} secret@example.com` }
    });
    expect(result.isError).toBe(true);
    const sc = structured(result);
    expect((sc.error as { code: string }).code).toBe(
      'MCP_ADAPTER_OUTPUT_TOO_LARGE'
    );
    // No partial/redacted document is exposed.
    expect(sc.redacted).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain('secret@example.com');
    delete process.env.LLMVERIFY_MCP_MAX_OUTPUT_BYTES;
  });

  it('large but in-budget redaction returns the complete document', async () => {
    process.env.LLMVERIFY_MCP_MAX_OUTPUT_BYTES = String(256 * 1024);
    const filler = 'safe prose. '.repeat(2000); // ~24 KB
    const result = await pair.client.callTool({
      name: 'redact_pii',
      arguments: { content: `${filler} test@example.com` }
    });
    const sc = structured(result);
    expect(result.isError).toBeFalsy();
    const redacted = sc.redacted as string;
    // Complete document: full length preserved (plus marker delta).
    expect(redacted.length).toBeGreaterThanOrEqual(filler.length);
    expect(redacted).toContain('[REDACTED]');
    expect(redacted).not.toContain('test@example.com');
    delete process.env.LLMVERIFY_MCP_MAX_OUTPUT_BYTES;
  });
});

describe('expectedSchema input bounds', () => {
  it('rejects an oversized expectedSchema', async () => {
    const bigSchema = {
      type: 'object',
      properties: { blob: { type: 'string', description: 'x'.repeat(70000) } }
    };
    const result = await pair.client.callTool({
      name: 'verify_llm_content',
      arguments: {
        content: '{"blob": "ok"}',
        isJSON: true,
        expectedSchema: bigSchema
      }
    });
    expect(result.isError).toBe(true);
  });

  it('rejects a pathologically deep expectedSchema', async () => {
    let schema: Record<string, unknown> = { type: 'string' };
    for (let i = 0; i < 40; i++) {
      schema = { type: 'object', properties: { a: schema } };
    }
    const result = await pair.client.callTool({
      name: 'verify_llm_content',
      arguments: {
        content: '{}',
        isJSON: true,
        expectedSchema: schema
      }
    });
    expect(result.isError).toBe(true);
  });
});
