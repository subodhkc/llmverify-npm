/**
 * llmverify Core Module
 * 
 * Pre-configured verification pipelines for different use cases.
 * Run all engines with a single command using preset configurations.
 * 
 * @module core
 * @author HAIEC
 * @license MIT
 */

import { verify, VerifyOptions } from '../verify';
import { classify, ClassificationResult } from '../engines/classification';
import { checkPromptInjection, checkPII, checkHarmfulContent, isInputSafe, redactPII } from '../csm6/security';
import { VerifyResult, Finding } from '../types/results';
import { Config } from '../types/config';

// ============================================================================
// PRESET CONFIGURATIONS
// ============================================================================

/**
 * Preset configuration modes for different environments
 */
export type PresetMode = 'dev' | 'prod' | 'strict' | 'fast' | 'ci';

/**
 * Preset configurations for quick setup
 */
/**
 * Full checks configuration helper
 */
const fullChecks = {
  security: true,
  privacy: true,
  safety: true,
  fairness: false,
  reliability: false,
  transparency: true
};

const minimalChecks = {
  security: true,
  privacy: false,
  safety: false,
  fairness: false,
  reliability: false,
  transparency: false
};

export const PRESETS: Record<PresetMode, Partial<Config>> = {
  /**
   * Development mode - balanced, informative output
   * Good for local development and testing
   */
  dev: {
    tier: 'free',
    engines: {
      hallucination: { enabled: true },
      consistency: { enabled: true },
      jsonValidator: { enabled: true },
      csm6: { 
        enabled: true,
        profile: 'baseline',
        checks: fullChecks
      }
    },
    output: {
      verbose: true,
      includeEvidence: true,
      includeMethodology: true,
      includeLimitations: true
    }
  },

  /**
   * Production mode - optimized for speed, essential checks only
   * Good for production APIs with latency requirements
   */
  prod: {
    tier: 'free',
    engines: {
      hallucination: { enabled: false },
      consistency: { enabled: false },
      jsonValidator: { enabled: true },
      csm6: { 
        enabled: true,
        profile: 'baseline',
        checks: fullChecks
      }
    },
    output: {
      verbose: false,
      includeEvidence: false,
      includeMethodology: false,
      includeLimitations: false
    }
  },

  /**
   * Strict mode - all engines, maximum scrutiny
   * Good for high-stakes content, compliance requirements
   */
  strict: {
    tier: 'free',
    engines: {
      hallucination: { enabled: true },
      consistency: { enabled: true },
      jsonValidator: { enabled: true },
      csm6: { 
        enabled: true,
        profile: 'high_risk',
        checks: { ...fullChecks, fairness: true, reliability: true }
      }
    },
    output: {
      verbose: true,
      includeEvidence: true,
      includeMethodology: true,
      includeLimitations: true
    }
  },

  /**
   * Fast mode - minimal checks, maximum speed
   * Good for high-throughput scenarios
   */
  fast: {
    tier: 'free',
    engines: {
      hallucination: { enabled: false },
      consistency: { enabled: false },
      jsonValidator: { enabled: false },
      csm6: { 
        enabled: true,
        profile: 'baseline',
        checks: minimalChecks
      }
    },
    output: {
      verbose: false,
      includeEvidence: false,
      includeMethodology: false,
      includeLimitations: false
    }
  },

  /**
   * CI mode - optimized for CI/CD pipelines
   * Returns structured output, fails on high risk
   */
  ci: {
    tier: 'free',
    engines: {
      hallucination: { enabled: true },
      consistency: { enabled: true },
      jsonValidator: { enabled: true },
      csm6: { 
        enabled: true,
        profile: 'baseline',
        checks: fullChecks
      }
    },
    output: {
      verbose: false,
      includeEvidence: true,
      includeMethodology: false,
      includeLimitations: false
    }
  }
};

// ============================================================================
// CORE RUN FUNCTION
// ============================================================================

/**
 * Result from running all engines
 */
export interface CoreRunResult {
  /** Overall verification result */
  verification: VerifyResult;
  /** Classification result (intent, hallucination, etc.) */
  classification: ClassificationResult | null;
  /** Input safety check result */
  inputSafety: {
    safe: boolean;
    injectionFindings: Finding[];
    riskScore: number;
  } | null;
  /** PII detection result */
  piiCheck: {
    hasPII: boolean;
    findings: Finding[];
    redacted: string;
    piiCount: number;
  } | null;
  /** Harmful content check result */
  harmfulCheck: {
    hasHarmful: boolean;
    findings: Finding[];
  } | null;
  /** Execution metadata */
  meta: {
    preset: PresetMode;
    enginesRun: string[];
    totalLatencyMs: number;
    timestamp: string;
  };
}

/**
 * Options for core run
 */
export interface CoreRunOptions {
  /** Content to verify (AI output) */
  content: string;
  /** Original prompt (optional, for classification) */
  prompt?: string;
  /** User input to check (optional, for input safety) */
  userInput?: string;
  /** Preset mode */
  preset?: PresetMode;
  /** Custom config (overrides preset) */
  config?: Partial<Config>;
  /** Run engines in parallel */
  parallel?: boolean;
}

/**
 * Run all verification engines with a single command
 * 
 * This is the master function that developers can use to run
 * comprehensive verification with preset configurations.
 * 
 * @example
 * ```typescript
 * import { run } from 'llmverify/core';
 * 
 * // Quick dev mode
 * const result = await run({ content: aiOutput, preset: 'dev' });
 * 
 * // Production mode with input check
 * const result = await run({ 
 *   content: aiOutput, 
 *   userInput: userMessage,
 *   preset: 'prod' 
 * });
 * 
 * // Strict mode with classification
 * const result = await run({ 
 *   content: aiOutput, 
 *   prompt: originalPrompt,
 *   preset: 'strict' 
 * });
 * ```
 */
export async function run(options: CoreRunOptions): Promise<CoreRunResult> {
  const startTime = Date.now();
  const preset = options.preset || 'dev';
  const config = { ...PRESETS[preset], ...options.config };
  const enginesRun: string[] = [];

  // Prepare parallel tasks
  const tasks: Promise<any>[] = [];

  // 1. Main verification (always runs)
  enginesRun.push('verify');
  const verifyTask = verify({ content: options.content, config });
  tasks.push(verifyTask);

  // 2. Classification (if prompt provided)
  let classificationTask: Promise<ClassificationResult> | null = null;
  if (options.prompt) {
    enginesRun.push('classification');
    classificationTask = Promise.resolve(classify(options.prompt, options.content));
    tasks.push(classificationTask);
  }

  // 3. Input safety check (if userInput provided)
  let inputSafetyTask: Promise<any> | null = null;
  if (options.userInput) {
    enginesRun.push('input-safety');
    inputSafetyTask = Promise.resolve({
      safe: isInputSafe(options.userInput),
      injectionFindings: checkPromptInjection(options.userInput),
      riskScore: 0 // Will be calculated
    });
    tasks.push(inputSafetyTask);
  }

  // 4. PII check
  if (config.engines?.csm6?.checks?.privacy !== false) {
    enginesRun.push('pii-detection');
    const piiFindings = checkPII(options.content);
    const { redacted, piiCount } = redactPII(options.content);
    const piiTask = Promise.resolve({
      hasPII: piiFindings.length > 0,
      findings: piiFindings,
      redacted,
      piiCount
    });
    tasks.push(piiTask);
  }

  // 5. Harmful content check
  if (config.engines?.csm6?.checks?.safety !== false) {
    enginesRun.push('harmful-content');
    const harmfulFindings = checkHarmfulContent(options.content);
    const harmfulTask = Promise.resolve({
      hasHarmful: harmfulFindings.length > 0,
      findings: harmfulFindings
    });
    tasks.push(harmfulTask);
  }

  // Execute all tasks (parallel or sequential based on option)
  let results: any[];
  if (options.parallel !== false) {
    results = await Promise.all(tasks);
  } else {
    results = [];
    for (const task of tasks) {
      results.push(await task);
    }
  }

  // Extract results
  const verification = results[0] as VerifyResult;
  let resultIndex = 1;

  const classification = options.prompt ? results[resultIndex++] as ClassificationResult : null;
  const inputSafety = options.userInput ? results[resultIndex++] : null;
  
  let piiCheck = null;
  if (config.engines?.csm6?.checks?.privacy !== false) {
    piiCheck = results[resultIndex++];
  }

  let harmfulCheck = null;
  if (config.engines?.csm6?.checks?.safety !== false) {
    harmfulCheck = results[resultIndex++];
  }

  const totalLatencyMs = Date.now() - startTime;

  return {
    verification,
    classification,
    inputSafety,
    piiCheck,
    harmfulCheck,
    meta: {
      preset,
      enginesRun,
      totalLatencyMs,
      timestamp: new Date().toISOString()
    }
  };
}

// ============================================================================
// QUICK FUNCTIONS
// ============================================================================

/**
 * Quick verification with dev preset
 */
export async function devVerify(content: string, prompt?: string): Promise<CoreRunResult> {
  return run({ content, prompt, preset: 'dev' });
}

/**
 * Quick verification with prod preset
 */
export async function prodVerify(content: string): Promise<CoreRunResult> {
  return run({ content, preset: 'prod' });
}

/**
 * Quick verification with strict preset
 */
export async function strictVerify(content: string, prompt?: string): Promise<CoreRunResult> {
  return run({ content, prompt, preset: 'strict' });
}

/**
 * Quick verification with fast preset
 */
export async function fastVerify(content: string): Promise<CoreRunResult> {
  return run({ content, preset: 'fast' });
}

/**
 * Quick verification for CI/CD
 */
export async function ciVerify(content: string): Promise<CoreRunResult> {
  return run({ content, preset: 'ci' });
}

// ============================================================================
// PIPELINE BUILDER
// ============================================================================

/**
 * Pipeline step definition
 */
export interface PipelineStep {
  name: string;
  enabled: boolean;
  run: (content: string, context: any) => Promise<any>;
}

/**
 * Build a custom verification pipeline
 * 
 * @example
 * ```typescript
 * const pipeline = createPipeline()
 *   .addStep('pii', async (content) => checkPII(content))
 *   .addStep('injection', async (content) => checkPromptInjection(content))
 *   .build();
 * 
 * const results = await pipeline.run(content);
 * ```
 */
export function createPipeline() {
  const steps: PipelineStep[] = [];

  return {
    addStep(name: string, run: (content: string, context: any) => Promise<any>) {
      steps.push({ name, enabled: true, run });
      return this;
    },

    disableStep(name: string) {
      const step = steps.find(s => s.name === name);
      if (step) step.enabled = false;
      return this;
    },

    enableStep(name: string) {
      const step = steps.find(s => s.name === name);
      if (step) step.enabled = true;
      return this;
    },

    build() {
      return {
        async run(content: string, context: any = {}) {
          const results: Record<string, any> = {};
          const enabledSteps = steps.filter(s => s.enabled);

          // Run all enabled steps in parallel
          const promises = enabledSteps.map(async step => {
            const result = await step.run(content, context);
            return { name: step.name, result };
          });

          const stepResults = await Promise.all(promises);
          stepResults.forEach(({ name, result }) => {
            results[name] = result;
          });

          return results;
        },

        getSteps() {
          return steps.map(s => ({ name: s.name, enabled: s.enabled }));
        }
      };
    }
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export { PRESETS as presets };
export default { run, devVerify, prodVerify, strictVerify, fastVerify, ciVerify, createPipeline, PRESETS };
