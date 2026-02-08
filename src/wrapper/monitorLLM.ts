/**
 * LLM Monitor Wrapper
 * 
 * Drop-in wrapper that adds health monitoring to any LLM client.
 * Tracks latency, token rate, response fingerprint, and overall health.
 * 
 * WHAT THIS DOES:
 * ✅ Wraps any LLM client with health monitoring
 * ✅ Tracks performance metrics over time
 * ✅ Detects behavioral drift and anomalies
 * ✅ Provides lifecycle hooks for health changes
 * ✅ Returns health report with each response
 * 
 * WHAT THIS DOES NOT DO:
 * ❌ Modify LLM responses
 * ❌ Store prompts or responses (ephemeral only)
 * ❌ Make predictions about LLM behavior
 * ❌ Block or filter responses (monitoring only)
 * 
 * PRIVACY GUARANTEE:
 * - No data is stored or transmitted
 * - All analysis is in-memory and ephemeral
 * - Prompts and responses are not logged
 * 
 * @module wrapper/monitorLLM
 * @author Haiec
 * @license MIT
 */

import { 
  CallRecord, 
  MonitorConfig, 
  HealthReport, 
  HealthStatus,
  ResponseFingerprint 
} from '../types/runtime';
import { BaselineEngine } from '../engines/runtime/baseline';
import { LatencyEngine } from '../engines/runtime/latency';
import { TokenRateEngine } from '../engines/runtime/token-rate';
import { FingerprintEngine, extractFingerprint } from '../engines/runtime/fingerprint';
import { StructureEngine } from '../engines/runtime/structure';
import { HealthScoreEngine } from '../engines/runtime/health-score';
import { LlmClient, LlmRequest, LlmResponse } from '../adapters/types';
import { incrementUsage, checkUsageLimit } from '../usage';
import { Tier } from '../types/config';

/**
 * Generic LLM client interface (legacy).
 * Any client with a generate method can be wrapped.
 * @deprecated Use LlmClient from adapters for new code
 */
export interface LLMClient {
  generate(opts: GenerateOptions): Promise<GenerateResponse>;
  [key: string]: unknown;
}

export interface GenerateOptions {
  prompt: string;
  model?: string;
  system?: string;
  temperature?: number;
  maxTokens?: number;
  [key: string]: unknown;
}

export interface GenerateResponse {
  text: string;
  tokens?: number;
  totalTokens?: number;
  model?: string;
  finishReason?: string;
  [key: string]: unknown;
}

/**
 * Union type for any supported client.
 */
export type AnyLLMClient = LLMClient | LlmClient;

/**
 * Response from monitored client includes health report.
 */
export interface MonitoredResponse extends GenerateResponse {
  llmverify: HealthReport;
}

/**
 * Monitored client interface.
 */
export interface MonitoredClient {
  generate(opts: GenerateOptions): Promise<MonitoredResponse>;
  getBaseline(): ReturnType<BaselineEngine['get']>;
  getLastHealth(): HealthStatus;
  resetBaseline(): void;
}

/**
 * Generates a UUID v4 (browser and Node.js compatible).
 */
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Wraps an LLM client with health monitoring.
 * 
 * @param originalClient - The LLM client to wrap
 * @param config - Optional monitoring configuration
 * @returns Monitored client with health tracking
 * 
 * @example
 * // Basic usage
 * import { monitorLLM } from 'llmverify';
 * 
 * const client = monitorLLM(openaiClient);
 * const response = await client.generate({ prompt: 'Hello' });
 * console.log(response.llmverify.health); // 'stable'
 * 
 * @example
 * // With hooks
 * const client = monitorLLM(openaiClient, {
 *   hooks: {
 *     onUnstable: (report) => alert('LLM unstable!'),
 *     onDegraded: (report) => console.warn('LLM degraded'),
 *     onRecovery: (report) => console.log('LLM recovered')
 *   }
 * });
 * 
 * @example
 * // With custom thresholds
 * const client = monitorLLM(openaiClient, {
 *   thresholds: {
 *     latencyWarnRatio: 1.5,
 *     latencyErrorRatio: 4.0
 *   },
 *   learningRate: 0.2
 * });
 */
/**
 * Checks if client is a unified LlmClient from adapters.
 */
function isLlmClient(client: AnyLLMClient): client is LlmClient {
  return 'provider' in client && typeof (client as LlmClient).provider === 'string';
}

export function monitorLLM(
  originalClient: AnyLLMClient,
  config: MonitorConfig = {}
): MonitoredClient {
  const baselineEngine = new BaselineEngine(
    config.learningRate ?? 0.1,
    config.minSamplesForBaseline ?? 5
  );
  
  let lastHealth: HealthStatus = 'stable';

  // Engine enable flags (all enabled by default)
  const engines = {
    latency: config.engines?.latency ?? true,
    tokenRate: config.engines?.tokenRate ?? true,
    fingerprint: config.engines?.fingerprint ?? true,
    structure: config.engines?.structure ?? true
  };

  return {
    async generate(opts: GenerateOptions): Promise<MonitoredResponse> {
      // Usage tracking — counts each generate() call
      // Bypassed in test environment (LLMVERIFY_TEST=1)
      const tier = ((config as any).tier || 'free') as Tier;
      if (!process.env.LLMVERIFY_TEST) {
        const usageCheck = checkUsageLimit(tier);
        if (!usageCheck.allowed) {
          throw new Error(usageCheck.warning || 'Daily usage limit exceeded. Upgrade: https://haiec.com/llmverify/pricing');
        }
        incrementUsage('monitor', tier);
      }
      
      const start = Date.now();
      
      // Call original client
      const resp = await originalClient.generate(opts);
      
      const end = Date.now();

      // Build call record
      const call: CallRecord = {
        id: generateUUID(),
        timestamp: start,
        prompt: opts.prompt,
        model: opts.model || 'unknown',
        responseText: resp.text || '',
        responseTokens: resp.tokens ?? (resp.text?.split(/\s+/).length || 0),
        latencyMs: end - start
      };

      // Get current baseline
      const baseline = baselineEngine.get();

      // Run enabled engines
      const results = [];

      if (engines.latency) {
        results.push(LatencyEngine(call, baseline, {
          warnRatio: config.thresholds?.latencyWarnRatio,
          errorRatio: config.thresholds?.latencyErrorRatio
        }));
      }

      if (engines.tokenRate) {
        results.push(TokenRateEngine(call, baseline, {
          warnRatio: config.thresholds?.tokenRateWarnRatio,
          errorRatio: config.thresholds?.tokenRateErrorRatio
        }));
      }

      let currentFingerprint: ResponseFingerprint | undefined;
      if (engines.fingerprint) {
        const fingerprintResult = FingerprintEngine(call, baseline.fingerprint);
        results.push(fingerprintResult);
        currentFingerprint = fingerprintResult.details.curr as ResponseFingerprint;
      } else {
        currentFingerprint = extractFingerprint(call.responseText);
      }

      if (engines.structure) {
        results.push(StructureEngine(call));
      }

      // Calculate health score
      const healthReport = HealthScoreEngine(results);

      // Update baseline
      baselineEngine.update(call, currentFingerprint, 1);

      // Fire hooks on health state changes
      if (config.hooks) {
        if (healthReport.health !== lastHealth) {
          if (healthReport.health === 'unstable' && config.hooks.onUnstable) {
            config.hooks.onUnstable(healthReport);
          }
          if (healthReport.health === 'degraded' && config.hooks.onDegraded) {
            config.hooks.onDegraded(healthReport);
          }
          if (lastHealth !== 'stable' && healthReport.health === 'stable' && config.hooks.onRecovery) {
            config.hooks.onRecovery(healthReport);
          }
        }
        if (config.hooks.onHealthCheck) {
          config.hooks.onHealthCheck(healthReport);
        }
      }

      lastHealth = healthReport.health;

      return {
        ...resp,
        llmverify: healthReport
      };
    },

    getBaseline() {
      return baselineEngine.get();
    },

    getLastHealth() {
      return lastHealth;
    },

    resetBaseline() {
      baselineEngine.reset();
      lastHealth = 'stable';
    }
  };
}
