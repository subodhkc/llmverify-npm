/**
 * Configuration loader for llmverify
 * Loads config from file, environment, or defaults
 */

import * as fs from 'fs';
import * as path from 'path';
import { Config, DEFAULT_CONFIG } from '../types/config';

/**
 * Load configuration from llmverify.config.json
 */
export function loadConfigFromFile(configPath?: string): Config | null {
  const searchPaths = configPath 
    ? [configPath]
    : [
        path.join(process.cwd(), 'llmverify.config.json'),
        path.join(process.cwd(), '.llmverify.json'),
        path.join(process.cwd(), 'llmverify.json'),
      ];

  for (const filePath of searchPaths) {
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const config = JSON.parse(content);
        return mergeWithDefaults(config);
      } catch (error) {
        console.warn(`Failed to load config from ${filePath}:`, error);
      }
    }
  }

  return null;
}

/**
 * Load configuration from environment variables
 */
export function loadConfigFromEnv(): Partial<Config> {
  const config: any = {};

  if (process.env.LLMVERIFY_TIER) {
    config.tier = process.env.LLMVERIFY_TIER;
  }

  if (process.env.LLMVERIFY_MAX_LENGTH) {
    config.performance = config.performance || {};
    config.performance.maxContentLength = parseInt(process.env.LLMVERIFY_MAX_LENGTH, 10);
  }

  if (process.env.LLMVERIFY_VERBOSE) {
    config.output = config.output || {};
    config.output.verbose = process.env.LLMVERIFY_VERBOSE === 'true';
  }

  return config;
}

/**
 * Merge config with defaults
 */
function mergeWithDefaults(config: Partial<Config>): Config {
  const merged: any = {
    ...DEFAULT_CONFIG,
    ...config
  };
  
  // Deep merge nested objects
  if (config.engines) {
    merged.engines = { ...DEFAULT_CONFIG.engines, ...config.engines };
  }
  if (config.performance) {
    merged.performance = { ...DEFAULT_CONFIG.performance, ...config.performance };
  }
  if (config.output) {
    merged.output = { ...DEFAULT_CONFIG.output, ...config.output };
  }
  if (config.privacy) {
    merged.privacy = { ...DEFAULT_CONFIG.privacy, ...config.privacy };
  }
  
  return merged;
}

/**
 * Load configuration with priority:
 * 1. Provided config object
 * 2. Config file
 * 3. Environment variables
 * 4. Defaults
 */
export function loadConfig(options?: {
  config?: Partial<Config>;
  configPath?: string;
}): Config {
  // Start with defaults
  let config: Config = { ...DEFAULT_CONFIG };

  // Load from file
  const fileConfig = loadConfigFromFile(options?.configPath);
  if (fileConfig) {
    config = mergeWithDefaults({ ...config, ...fileConfig });
  }

  // Load from environment
  const envConfig = loadConfigFromEnv();
  config = mergeWithDefaults({ ...config, ...envConfig });

  // Override with provided config
  if (options?.config) {
    config = mergeWithDefaults({ ...config, ...options.config });
  }

  return config;
}

/**
 * Create a default config file
 */
export function createDefaultConfigFile(outputPath?: string): string {
  const filePath = outputPath || path.join(process.cwd(), 'llmverify.config.json');
  
  const defaultConfig = {
    tier: 'free',
    privacy: {
      allowNetworkRequests: false,
      telemetryEnabled: false
    },
    engines: {
      hallucination: { enabled: true },
      consistency: { enabled: true },
      jsonValidator: { enabled: true },
      csm6: {
        enabled: true,
        profile: 'baseline',
        checks: {
          security: true,
          privacy: true,
          safety: true,
          fairness: false,
          reliability: false,
          transparency: true
        }
      }
    },
    performance: {
      timeout: 30000,
      maxContentLength: 10000,
      cacheEnabled: true,
      cacheTTL: 3600
    },
    output: {
      verbose: false,
      includeEvidence: true,
      includeMethodology: true,
      includeLimitations: true
    }
  };

  fs.writeFileSync(filePath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
  return filePath;
}

/**
 * Validate config structure
 */
export function validateConfig(config: any): config is Config {
  return (
    typeof config === 'object' &&
    typeof config.tier === 'string' &&
    typeof config.maxContentLength === 'number' &&
    typeof config.verbose === 'boolean'
  );
}
