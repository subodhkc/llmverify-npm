/**
 * Sentinel Test Suite
 * 
 * Runs all sentinel tests and aggregates results.
 * 
 * @module sentinel/suite
 * @author Haiec
 * @license MIT
 */

import { SentinelTestResult, SentinelConfig } from '../types/runtime';
import { staticEchoTest } from './staticEchoTest';
import { duplicateQueryTest } from './duplicateQueryTest';
import { structuredListTest } from './structuredListTest';
import { shortReasoningTest } from './shortReasoningTest';
import { incrementUsage, checkUsageLimit } from '../usage';
import { Tier } from '../types/config';

/**
 * Aggregated sentinel test suite results.
 */
export interface SentinelSuite {
  /** Overall pass/fail status */
  passed: boolean;
  /** Number of tests passed */
  passedCount: number;
  /** Total number of tests */
  totalCount: number;
  /** Pass rate (0-1) */
  passRate: number;
  /** Individual test results */
  results: SentinelTestResult[];
  /** Timestamp of test run */
  timestamp: number;
  /** Duration in milliseconds */
  durationMs: number;
  /** Summary message */
  summary: string;
}

/**
 * Runs all sentinel tests and returns aggregated results.
 * 
 * @param config - Sentinel configuration with LLM client
 * @param options - Optional configuration for which tests to run
 * @returns Aggregated test suite results
 * 
 * @example
 * const suite = await runAllSentinelTests({
 *   client: myLLMClient,
 *   model: 'gpt-4'
 * });
 * 
 * console.log(`Passed ${suite.passedCount}/${suite.totalCount} tests`);
 * 
 * if (!suite.passed) {
 *   suite.results.filter(r => !r.passed).forEach(r => {
 *     console.error(`Failed: ${r.test} - ${r.message}`);
 *   });
 * }
 */
export async function runAllSentinelTests(
  config: SentinelConfig,
  options?: {
    skipTests?: string[];
    onTestComplete?: (result: SentinelTestResult) => void;
  }
): Promise<SentinelSuite> {
  const start = Date.now();
  const results: SentinelTestResult[] = [];
  const skipTests = new Set(options?.skipTests || []);
  
  // Usage tracking — counts as one call per suite run
  const tier = ((config as any).tier || 'free') as Tier;
  const usageCheck = checkUsageLimit(tier);
  if (!usageCheck.allowed) {
    return {
      passed: false,
      passedCount: 0,
      totalCount: 0,
      passRate: 0,
      results: [],
      timestamp: start,
      durationMs: 0,
      summary: usageCheck.warning || 'Daily usage limit exceeded. Upgrade: https://haiec.com/llmverify/pricing'
    };
  }
  incrementUsage('sentinel', tier);

  // Define test runners
  const tests: Array<{ name: string; run: () => Promise<SentinelTestResult> }> = [
    { name: 'staticEchoTest', run: () => staticEchoTest(config) },
    { name: 'duplicateQueryTest', run: () => duplicateQueryTest(config) },
    { name: 'structuredListTest', run: () => structuredListTest(config) },
    { name: 'shortReasoningTest', run: () => shortReasoningTest(config) }
  ];

  // Run tests sequentially
  for (const test of tests) {
    if (skipTests.has(test.name)) continue;

    try {
      const result = await test.run();
      results.push(result);
      
      if (options?.onTestComplete) {
        options.onTestComplete(result);
      }
    } catch (error) {
      const errorResult: SentinelTestResult = {
        test: test.name,
        passed: false,
        message: `Test threw error: ${error instanceof Error ? error.message : 'Unknown'}`,
        details: { error: error instanceof Error ? error.message : 'Unknown' },
        confidence: 0,
        limitations: ['Test failed due to unhandled error']
      };
      results.push(errorResult);
      
      if (options?.onTestComplete) {
        options.onTestComplete(errorResult);
      }
    }
  }

  const end = Date.now();
  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  const passRate = totalCount > 0 ? passedCount / totalCount : 0;
  const passed = passRate >= 0.75; // Pass if 75%+ tests pass

  return {
    passed,
    passedCount,
    totalCount,
    passRate: Math.round(passRate * 100) / 100,
    results,
    timestamp: start,
    durationMs: end - start,
    summary: passed
      ? `All critical tests passed (${passedCount}/${totalCount})`
      : `Some tests failed (${passedCount}/${totalCount} passed)`
  };
}
