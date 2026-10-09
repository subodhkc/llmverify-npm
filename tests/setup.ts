/**
 * Jest global setup — isolates local state per test worker and resets
 * the usage tracker so tests don't hit the 100-call daily limit.
 *
 * Every jest worker gets its own LLMVERIFY_HOME under the OS temp dir.
 * Without this, all workers share ~/.llmverify and race on baseline,
 * usage, log and audit files — which previously produced torn JSON
 * reads (and stderr noise that broke stdio-safety assertions) in CI.
 */
import * as os from 'os';
import * as path from 'path';
import { resetUsage } from '../src/usage';

// Signal test environment — usage checks are bypassed
process.env.LLMVERIFY_TEST = '1';

// Per-worker isolated state root (explicit LLMVERIFY_HOME still wins)
if (!process.env.LLMVERIFY_HOME) {
  const workerId = process.env.JEST_WORKER_ID || `pid-${process.pid}`;
  process.env.LLMVERIFY_HOME = path.join(
    os.tmpdir(),
    `llmverify-test-${workerId}`
  );
}

// Reset usage counter before each test worker starts
resetUsage();
