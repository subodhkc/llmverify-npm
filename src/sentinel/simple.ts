/**
 * Simplified Sentinel API
 * 
 * One-liner API for running sentinel tests without manual config.
 * Ideal for IDE users and quick integrations.
 * 
 * @module sentinel/simple
 * @author Haiec
 * @license MIT
 */

import { runAllSentinelTests, SentinelSuite } from './suite';
import { SentinelConfig, SentinelTestResult } from '../types/runtime';

/**
 * Simplified sentinel namespace for quick access.
 * 
 * @example
 * ```typescript
 * import { sentinel } from 'llmverify';
 * 
 * // Run all tests with one line
 * const suite = await sentinel.quick(myClient, 'gpt-4');
 * console.log(suite.passed ? 'All good' : 'Issues found');
 * 
 * // Run a single test by name
 * const result = await sentinel.test('staticEchoTest', myClient, 'gpt-4');
 * ```
 */
export const sentinel = {
  /**
   * Run all sentinel tests with minimal config.
   * 
   * @param client - Any object with a generate() method
   * @param model - Model name (e.g. 'gpt-4', 'claude-3')
   * @param options - Optional: skipTests, onTestComplete
   * @returns Aggregated test suite results
   */
  async quick(
    client: { generate: (opts: any) => Promise<any> },
    model: string,
    options?: {
      skipTests?: string[];
      onTestComplete?: (result: SentinelTestResult) => void;
    }
  ): Promise<SentinelSuite> {
    const config: SentinelConfig = {
      client: {
        generate: async (opts: any) => {
          const resp = await client.generate(opts);
          return typeof resp === 'string' ? { text: resp } : resp;
        }
      },
      model
    };
    return runAllSentinelTests(config, options);
  },

  /**
   * Run a single sentinel test by name.
   * 
   * @param testName - One of: 'staticEchoTest', 'duplicateQueryTest', 'structuredListTest', 'shortReasoningTest'
   * @param client - Any object with a generate() method
   * @param model - Model name
   * @returns Single test result
   */
  async test(
    testName: string,
    client: { generate: (opts: any) => Promise<any> },
    model: string
  ): Promise<SentinelSuite> {
    const allTests = ['staticEchoTest', 'duplicateQueryTest', 'structuredListTest', 'shortReasoningTest'];
    const skipTests = allTests.filter(t => t !== testName);
    return this.quick(client, model, { skipTests });
  },

  /**
   * Run all sentinel tests (full config version).
   * Re-export for convenience.
   */
  runAll: runAllSentinelTests
};
