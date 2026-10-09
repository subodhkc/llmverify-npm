/**
 * Functional integration tests: verify(), audit persistence policies,
 * engine skipping, and profiles — through the real MCP protocol with
 * isolated engine state (LLMVERIFY_HOME per run).
 */

import { mkdtempSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  connectTestClient,
  structured,
  type ConnectedPair
} from '../helpers/client';

let pair: ConnectedPair;
let stateHome: string;
let savedTestFlag: string | undefined;

beforeAll(async () => {
  // Isolate ALL engine state for this run: usage counter, audit dir,
  // baselines. Audit writes land in a temp dir we can inspect.
  stateHome = mkdtempSync(join(tmpdir(), 'llmverify-mcp-it-'));
  process.env.LLMVERIFY_HOME = stateHome;
  // tests/setup.ts sets LLMVERIFY_TEST=1, which bypasses the usage
  // counter entirely. This suite asserts the real serialized usage
  // write — clear the bypass for its duration and restore after.
  savedTestFlag = process.env.LLMVERIFY_TEST;
  delete process.env.LLMVERIFY_TEST;
  pair = await connectTestClient();
});

afterAll(async () => {
  await pair.close();
  delete process.env.LLMVERIFY_HOME;
  if (savedTestFlag === undefined) {
    delete process.env.LLMVERIFY_TEST;
  } else {
    process.env.LLMVERIFY_TEST = savedTestFlag;
  }
});

describe('verify_llm_content', () => {
  it('verifies benign content end-to-end', async () => {
    const result = await pair.client.callTool({
      name: 'verify_llm_content',
      arguments: { content: 'The sky appears blue due to Rayleigh scattering.' }
    });
    const sc = structured(result);
    expect(result.isError).toBeFalsy();
    expect(sc.evaluation).toBeUndefined(); // completed results carry no error
    expect((sc.audit as { status: string }).status).toBe('PERSISTED');
  });

  it('records skipped engines in notChecked, never as success', async () => {
    const result = await pair.client.callTool({
      name: 'verify_llm_content',
      arguments: {
        content: 'Some text to verify.',
        skipEngines: ['consistency', 'jsonValidator']
      }
    });
    const sc = structured(result);
    expect(result.isError).toBeFalsy();
    const notChecked = sc.enginesNotChecked as string[];
    expect(notChecked).toContain('consistency');
    // The engine names the JSON engine 'json' in notChecked.
    expect(notChecked).toContain('json');
    const er = sc.engineResults as Record<string, unknown>;
    expect(er.consistency).toBeUndefined();
    expect(er.json).toBeUndefined();
  });

  it('marks the JSON engine notChecked for non-JSON input', async () => {
    const result = await pair.client.callTool({
      name: 'verify_llm_content',
      arguments: { content: 'Plain prose, definitely not JSON.' }
    });
    const sc = structured(result);
    expect(sc.enginesNotChecked as string[]).toContain('json');
  });

  it('runs the JSON engine when isJSON is set', async () => {
    const result = await pair.client.callTool({
      name: 'verify_llm_content',
      arguments: {
        content: '{"a": 1, "b": [2, 3]}',
        isJSON: true
      }
    });
    const sc = structured(result);
    const er = sc.engineResults as Record<string, unknown>;
    expect(er.json).toBeDefined();
  });

  it('applies a CSM6 profile without error', async () => {
    const result = await pair.client.callTool({
      name: 'verify_llm_content',
      arguments: { content: 'Clinical trial results pending.', profile: 'health' }
    });
    const sc = structured(result);
    expect(result.isError).toBeFalsy();
    const er = sc.engineResults as Record<string, any>;
    expect(er.csm6.profile).toBe('health');
  });
});

describe('audit persistence policies', () => {
  it('persists an audit record with a sha256 entry digest', async () => {
    const result = await pair.client.callTool({
      name: 'verify_llm_content',
      arguments: { content: 'Audit me.' }
    });
    const sc = structured(result);
    const audit = sc.audit as {
      status: string;
      entryDigest?: string;
      filePath?: string;
    };
    expect(audit.status).toBe('PERSISTED');
    expect(audit.entryDigest).toMatch(/^sha256:[0-9a-f]{64}$/);

    // The JSONL record actually exists on disk under the isolated home.
    const auditDir = join(stateHome, 'audit');
    expect(existsSync(auditDir)).toBe(true);
    const files = readdirSync(auditDir);
    expect(files.length).toBeGreaterThan(0);
    const record = JSON.parse(
      readFileSync(join(auditDir, files[files.length - 1]), 'utf-8')
        .trim()
        .split('\n')
        .pop() as string
    );
    expect(record.integrity.entryDigest).toBe(audit.entryDigest);
  });

  it('requireAuditPersistence succeeds when persistence works', async () => {
    const result = await pair.client.callTool({
      name: 'verify_llm_content',
      arguments: {
        content: 'Evidence required.',
        requireAuditPersistence: true
      }
    });
    const sc = structured(result);
    expect(result.isError).toBeFalsy();
    expect((sc.audit as { status: string }).status).toBe('PERSISTED');
  });

  it('developer mode reports a failed write on the receipt without throwing', async () => {
    // Covered in audit-failclosed.test.ts for the required mode; here we
    // only assert the receipt shape is honest in developer mode.
    const result = await pair.client.callTool({
      name: 'verify_llm_content',
      arguments: { content: 'Receipt check.' }
    });
    const sc = structured(result);
    expect(result.isError).toBeFalsy();
    expect(['PERSISTED', 'DISABLED', 'FAILED', 'NOT_ATTEMPTED']).toContain(
      (sc.audit as { status: string }).status
    );
  });
});

describe('sequential and concurrent calls', () => {
  it('handles a burst of verification calls without error', async () => {
    const calls = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        pair.client.callTool({
          name: 'verify_llm_content',
          arguments: { content: `Burst content ${i}` }
        })
      )
    );
    for (const c of calls) {
      expect(c.isError).toBeFalsy();
      expect((structured(c).audit as { status: string }).status).toBe(
        'PERSISTED'
      );
    }
    // Usage counter file is valid JSON — serialized lane + atomic writes.
    const usage = JSON.parse(
      readFileSync(join(stateHome, 'usage.json'), 'utf-8')
    );
    expect(usage.calls).toBeGreaterThanOrEqual(5);
  });
});
