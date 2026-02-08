/**
 * llmverify Configuration Types
 * 
 * @module types/config
 * @author Haiec
 * @license MIT
 */

export type Tier = 'free' | 'starter' | 'pro' | 'business';

/**
 * Usage limits per tier — enforced locally via ~/.llmverify/usage.json
 * All features available on all tiers; only volume is capped.
 */
export interface TierUsageLimits {
  /** Max API calls per day (verify, guard, safe, parse, sentinel, monitor) */
  dailyCallLimit: number;
  /** Max content length per call in bytes */
  maxContentLength: number;
  /** Audit log retention in days */
  auditRetentionDays: number;
  /** Max custom plugins */
  maxPlugins: number;
  /** Custom patterns allowed */
  customPatterns: boolean;
}

export const TIER_USAGE_LIMITS: Record<Tier, TierUsageLimits> = {
  free: {
    dailyCallLimit: 500,
    maxContentLength: 51200,       // 50KB
    auditRetentionDays: 7,
    maxPlugins: 2,
    customPatterns: false
  },
  starter: {
    dailyCallLimit: 5000,
    maxContentLength: 204800,      // 200KB
    auditRetentionDays: 30,
    maxPlugins: 10,
    customPatterns: true
  },
  pro: {
    dailyCallLimit: 50000,
    maxContentLength: 1048576,     // 1MB
    auditRetentionDays: 90,
    maxPlugins: Infinity,
    customPatterns: true
  },
  business: {
    dailyCallLimit: Infinity,
    maxContentLength: Infinity,
    auditRetentionDays: Infinity,
    maxPlugins: Infinity,
    customPatterns: true
  }
};

export interface EngineConfig {
  enabled: boolean;
  config?: Record<string, unknown>;
}

export interface CSM6Config extends EngineConfig {
  profile: 'baseline' | 'high_risk' | 'finance' | 'health' | 'research';
  checks: {
    security: boolean;
    privacy: boolean;
    safety: boolean;
    fairness: boolean;
    reliability: boolean;
    transparency: boolean;
  };
  /** PII detection settings */
  pii?: {
    enabled: boolean;
    /** Minimum severity to report: 'low' | 'medium' | 'high' | 'critical' */
    minSeverity?: 'low' | 'medium' | 'high' | 'critical';
    /** Categories to scan: 'personal' | 'financial' | 'credential' | 'location' | 'health' */
    categories?: Array<'personal' | 'financial' | 'credential' | 'location' | 'health'>;
  };
  /** Harmful content detection settings */
  harmful?: {
    enabled: boolean;
    /** Minimum severity to report */
    minSeverity?: 'low' | 'medium' | 'high' | 'critical';
  };
}

export interface Config {
  tier: Tier;
  organizationId?: string;
  
  privacy: {
    allowNetworkRequests: boolean;
    apiKey?: string;
    telemetryEnabled: boolean;
    dataResidency?: 'US' | 'EU' | 'UK';
  };
  
  engines: {
    hallucination: EngineConfig;
    consistency: EngineConfig;
    jsonValidator: EngineConfig;
    csm6: CSM6Config;
  };
  
  performance: {
    timeout: number;
    maxContentLength: number;
    cacheEnabled: boolean;
    cacheTTL: number;
  };
  
  output: {
    verbose: boolean;
    includeEvidence: boolean;
    includeMethodology: boolean;
    includeLimitations: boolean;
  };
}

export const DEFAULT_CONFIG: Config = {
  tier: 'free',
  
  privacy: {
    allowNetworkRequests: false,
    telemetryEnabled: false,
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

export const TIER_LIMITS: Record<Tier, Partial<Config>> = {
  free: {
    performance: {
      maxContentLength: 51200, // 50KB
      timeout: 30000,
      cacheEnabled: true,
      cacheTTL: 3600
    }
  },
  
  starter: {
    performance: {
      maxContentLength: 204800, // 200KB
      timeout: 60000,
      cacheEnabled: true,
      cacheTTL: 7200
    }
  },
  
  pro: {
    performance: {
      maxContentLength: 1048576, // 1MB
      timeout: 120000,
      cacheEnabled: true,
      cacheTTL: 14400
    }
  },
  
  business: {
    performance: {
      maxContentLength: Infinity,
      timeout: 300000,
      cacheEnabled: true,
      cacheTTL: 28800
    }
  }
};
