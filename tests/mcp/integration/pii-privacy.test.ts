/**
 * Regression tests for the PII-type extraction defect (adapter read
 * metadata.type; the engine emits metadata.piiType) plus serialized-
 * response privacy: raw matched values must appear nowhere in the
 * MCP result — not in structuredContent, not in the text summary.
 */

import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  connectTestClient,
  structured,
  type ConnectedPair
} from '../helpers/client';
import { extractPiiTypes } from '../../../src/mcp/adapters/llmverify';
import type { Finding } from '../../../src/index';

let pair: ConnectedPair;

beforeAll(async () => {
  process.env.LLMVERIFY_HOME = mkdtempSync(
    join(tmpdir(), 'llmverify-mcp-pii-')
  );
  pair = await connectTestClient();
});

afterAll(async () => {
  await pair.close();
  delete process.env.LLMVERIFY_HOME;
});

function assertNoLeak(result: unknown, rawValues: string[]): void {
  const serialized = JSON.stringify(result);
  for (const raw of rawValues) {
    expect(serialized).not.toContain(raw);
  }
}

describe('check_pii — piiTypes from the real engine contract', () => {
  it('reports EMAIL type for an email address', async () => {
    const result = await pair.client.callTool({
      name: 'check_pii',
      arguments: { content: 'Reach me at alice.smith@example.com please.' }
    });
    const sc = structured(result);
    expect(result.isError).toBeFalsy();
    expect(sc.piiDetected).toBe(true);
    expect(sc.piiTypes as string[]).toContain('EMAIL');
    expect((sc.findingsCount as number)).toBeGreaterThan(0);
    assertNoLeak(result, ['alice.smith@example.com']);
  });

  it('reports a phone type for a US phone number', async () => {
    const result = await pair.client.callTool({
      name: 'check_pii',
      arguments: { content: 'Call me at 555-123-4567 tomorrow.' }
    });
    const sc = structured(result);
    const types = sc.piiTypes as string[];
    expect(types.some((t) => t.startsWith('PHONE'))).toBe(true);
    assertNoLeak(result, ['555-123-4567']);
  });

  it('reports multiple distinct PII types', async () => {
    const result = await pair.client.callTool({
      name: 'check_pii',
      arguments: {
        // NB: keep placeholder words ("test", "sample", ...) away from
        // values — the engine suppresses matches near them.
        content:
          'Email bob@corp.org, SSN 123-45-6789, phone 555-987-6543.'
      }
    });
    const sc = structured(result);
    const types = sc.piiTypes as string[];
    expect(types).toContain('EMAIL');
    expect(types).toContain('SSN');
    expect(types.some((t) => t.startsWith('PHONE'))).toBe(true);
    assertNoLeak(result, ['bob@corp.org', '123-45-6789', '555-987-6543']);
  });

  it('deduplicates repeated PII types', async () => {
    const result = await pair.client.callTool({
      name: 'check_pii',
      arguments: {
        content: 'First a@x.com, then b@y.org, then c@z.net.'
      }
    });
    const sc = structured(result);
    const types = sc.piiTypes as string[];
    expect(types).toContain('EMAIL');
    expect(new Set(types).size).toBe(types.length);
    assertNoLeak(result, ['a@x.com', 'b@y.org', 'c@z.net']);
  });

  it('returns empty types with no findings', async () => {
    const result = await pair.client.callTool({
      name: 'check_pii',
      arguments: { content: 'No personal data here at all.' }
    });
    const sc = structured(result);
    expect(result.isError).toBeFalsy();
    expect(sc.piiDetected).toBe(false);
    expect(sc.piiTypes).toEqual([]);
  });
});

describe('extractPiiTypes — malformed metadata tolerance', () => {
  it('ignores findings with missing or unexpected metadata', () => {
    const fake = [
      { metadata: { piiType: 'EMAIL' } },
      { metadata: { piiType: 'PHONE_US' } },
      { metadata: { piiType: 'EMAIL' } },
      { metadata: {} },
      { metadata: undefined },
      { metadata: { piiType: 42 } },
      { metadata: { type: 'LEGACY_FIELD' } },
      {}
    ] as unknown as Finding[];
    expect(extractPiiTypes(fake)).toEqual(['EMAIL', 'PHONE_US']);
  });

  it('returns [] for no findings', () => {
    expect(extractPiiTypes([])).toEqual([]);
  });
});

describe('serialized-response privacy', () => {
  it('check_pii leaks nothing in content text or structuredContent', async () => {
    const result = await pair.client.callTool({
      name: 'check_pii',
      arguments: {
        content:
          'SSN 123-45-6789 belongs to sam@example.com at 555-555-5555.'
      }
    });
    assertNoLeak(result, ['123-45-6789', 'sam@example.com', '555-555-5555']);
    const sc = structured(result);
    // Findings still carry useful masked evidence.
    const findings = sc.findings as Array<{ evidence?: { textSample?: string } }>;
    for (const f of findings) {
      expect(f.evidence?.textSample).not.toMatch(/[a-z]+@[a-z]+/i);
    }
  });

  it('redact_pii returns the redacted document and only type/position metadata', async () => {
    const result = await pair.client.callTool({
      name: 'redact_pii',
      arguments: {
        // Engine card pattern matches contiguous digits only.
        content: 'Card 4111111111111111 and ssn 123-45-6789.'
      }
    });
    const sc = structured(result);
    expect(result.isError).toBeFalsy();
    assertNoLeak(result, ['4111111111111111', '123-45-6789']);
    for (const r of sc.redactions as Array<Record<string, unknown>>) {
      expect(Object.keys(r).sort()).toEqual(['position', 'type']);
    }
  });
});
