/**
 * Jest global setup — resets usage tracker before tests
 * so tests don't hit the 100-call daily limit.
 */
import { resetUsage } from '../src/usage';

// Signal test environment — usage checks are bypassed
process.env.LLMVERIFY_TEST = '1';

// Reset usage counter before each test worker starts
resetUsage();
