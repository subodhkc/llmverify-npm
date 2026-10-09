/**
 * Evidence-required fail-closed test — isolated file because the
 * engine's audit logger singleton resolves its directory on first use.
 * This worker sets an unwritable audit dir BEFORE the first verify()
 * call, so the write genuinely fails and requirePersistence must
 * escalate to a typed AUDIT_PERSISTENCE_FAILED error.
 */

import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  connectTestClient,
  structured,
  type ConnectedPair
} from '../helpers/client';

let pair: ConnectedPair;
let stateHome: string;

beforeAll(async () => {
  stateHome = mkdtempSync(join(tmpdir(), 'llmverify-mcp-failclosed-'));
  const blocker = join(stateHome, 'not-a-dir');
  writeFileSync(blocker, 'occupied'); // a file where a dir must be
  process.env.LLMVERIFY_HOME = stateHome;
  process.env.LLMVERIFY_AUDIT_DIR = join(blocker, 'audit');
  pair = await connectTestClient();
});

afterAll(async () => {
  await pair.close();
  delete process.env.LLMVERIFY_HOME;
  delete process.env.LLMVERIFY_AUDIT_DIR;
});

it('requireAuditPersistence=true escalates a failed write to a typed error', async () => {
  const result = await pair.client.callTool({
    name: 'verify_llm_content',
    arguments: {
      content: 'Must persist or fail.',
      requireAuditPersistence: true
    }
  });
  expect(result.isError).toBe(true);
  const sc = structured(result);
  const err = sc.error as { name: string; code: string };
  expect(err.name).toBe('AuditPersistenceError');
  // The engine's typed error code for audit persistence failures.
  expect(err.code).toBe('LLMVERIFY_8001');
});

it('developer mode (requireAuditPersistence=false) still returns the result', async () => {
  const result = await pair.client.callTool({
    name: 'verify_llm_content',
    arguments: { content: 'Developer mode keeps going.' }
  });
  const sc = structured(result);
  expect(result.isError).toBeFalsy();
  // The receipt must honestly report the failure — never PERSISTED.
  expect((sc.audit as { status: string }).status).toBe('FAILED');
});
