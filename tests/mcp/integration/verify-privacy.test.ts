/**
 * P0 regression: verify_llm_content must not leak PII.
 *
 * Before this fix, boundVerifyResult() truncated but did NOT redact
 * csm6 finding evidence — `evidence.context` is a raw ±30-char excerpt
 * that contained the matched value verbatim, and the engine's own
 * `evidence.textSample` only partial-masks (keeps a prefix/suffix).
 * Hallucination claim text, consistency sections/contradictions, and
 * JSON schema-error strings also echo caller content.
 *
 * These tests exercise the REAL MCP protocol path and assert on the
 * serialized CallToolResult — the exact bytes a client receives.
 */

import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  connectTestClient,
  structured,
  type ConnectedPair
} from '../helpers/client';
import { sanitizeMessage } from '../../../src/mcp/errors/index';

let pair: ConnectedPair;

beforeAll(async () => {
  process.env.LLMVERIFY_HOME = mkdtempSync(
    join(tmpdir(), 'llmverify-mcp-vpriv-')
  );
  pair = await connectTestClient();
});

afterAll(async () => {
  await pair.close();
  delete process.env.LLMVERIFY_HOME;
});

const EMAIL = 'janet.rivers@corp-mail.org';
const PHONE = '555-867-5309';
const SSN = '078-05-1120';
// NB: keep placeholder words ("example", "test", "sample", "fake",
// "dummy") away from values — the engine suppresses detection near them.

function assertNoLeak(result: unknown, raws: string[]): void {
  const serialized = JSON.stringify(result);
  for (const raw of raws) {
    expect(serialized).not.toContain(raw);
  }
}

describe('verify_llm_content — PII privacy', () => {
  it('does not leak email/phone/SSN anywhere in the serialized result', async () => {
    const result = await pair.client.callTool({
      name: 'verify_llm_content',
      arguments: {
        content: `Please send the report to ${EMAIL} or call ${PHONE}. ` +
          `The employee identifier is ${SSN}.`
      }
    });
    expect(result.isError).toBeFalsy();
    assertNoLeak(result, [EMAIL, PHONE, SSN]);
    const sc = structured(result);
    // privacy provenance is reported, not silent
    const privacy = sc.privacy as { piiFieldsMasked: number };
    expect(privacy.piiFieldsMasked).toBeGreaterThan(0);
  });

  it('masks finding evidence but preserves ids/types/severity/counts', async () => {
    const result = await pair.client.callTool({
      name: 'verify_llm_content',
      arguments: {
        content: `Contact ${EMAIL} regarding invoice ${PHONE}.`
      }
    });
    const sc = structured(result);
    expect(result.isError).toBeFalsy();
    const csm6 = (sc.engineResults as Record<string, any>).csm6;
    expect(csm6).toBeDefined();
    const findings = (csm6.findings ?? []) as Array<Record<string, any>>;
    const piiFindings = findings.filter((f) => f.category === 'privacy');
    expect(piiFindings.length).toBeGreaterThan(0);
    for (const f of piiFindings) {
      expect(f.id).toBeTruthy();
      expect(f.severity).toBeTruthy();
      expect(f.metadata?.piiType).toBeTruthy();
      expect(f.evidence?.textSample).toBe('[REDACTED]');
      const ctx = String(f.evidence?.context ?? '');
      expect(ctx).not.toContain('@');
    }
    assertNoLeak(result, [EMAIL, PHONE]);
  });

  it('scrubs PII embedded in hallucination claim text', async () => {
    const result = await pair.client.callTool({
      name: 'verify_llm_content',
      arguments: {
        content:
          `The quarterly filing by ${EMAIL} showed revenue of $4.2 ` +
          'million according to the SEC.'
      }
    });
    expect(result.isError).toBeFalsy();
    assertNoLeak(result, [EMAIL]);
    const sc = structured(result);
    const h = (sc.engineResults as Record<string, any>).hallucination;
    const allClaims = [
      ...(h?.claims ?? []),
      ...(h?.suspiciousClaims ?? [])
    ] as Array<{ text?: string }>;
    // If the engine extracted a claim containing the email, it is masked.
    for (const c of allClaims) {
      expect(c.text ?? '').not.toContain(EMAIL);
    }
  });

  it('does not leak through audit receipt, notChecked, or error details', async () => {
    const result = await pair.client.callTool({
      name: 'verify_llm_content',
      arguments: {
        content: `Call ${PHONE} then email ${EMAIL}.`,
        requireAuditPersistence: true
      }
    });
    assertNoLeak(result, [PHONE, EMAIL]);
    const sc = structured(result);
    expect((sc.audit as { status: string }).status).toBe('PERSISTED');
    expect(Array.isArray(sc.enginesNotChecked)).toBe(true);
  });
});

describe('error-path privacy', () => {
  it('sanitizeMessage strips PII-shaped content from error text', () => {
    const msg = sanitizeMessage(
      `validation failed for contact ${EMAIL} at ${PHONE}`
    );
    expect(msg).not.toContain(EMAIL);
    expect(msg).not.toContain(PHONE);
  });
});

describe('get_llmverify_capabilities — path disclosure', () => {
  it('withholds absolute host paths by default', async () => {
    const result = await pair.client.callTool({
      name: 'get_llmverify_capabilities',
      arguments: {}
    });
    const sc = structured(result);
    const ls = sc.localState as Record<string, unknown>;
    expect(ls.paths).toBeUndefined();
    expect(ls.envOverrides).toContain('LLMVERIFY_HOME');
    expect(sc.resultSchemaFile).toBeNull();
    // localState must not contain absolute host paths.
    expect(JSON.stringify(ls)).not.toMatch(/[A-Za-z]:\\|\/home\/|\/Users\//);
    expect(JSON.stringify(ls)).not.toContain(
      process.env.LLMVERIFY_HOME as string
    );
  });

  it('returns real paths only under the documented opt-in', async () => {
    const result = await pair.client.callTool({
      name: 'get_llmverify_capabilities',
      arguments: { includeLocalPaths: true }
    });
    const sc = structured(result);
    const ls = sc.localState as { paths?: { home?: string } };
    expect(typeof ls.paths?.home).toBe('string');
    expect((ls.paths?.home ?? '').length).toBeGreaterThan(0);
  });
});
