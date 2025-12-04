/**
 * Stable JSON Schema for llmverify API responses
 * This schema is guaranteed to remain stable across minor versions
 */

export interface VerificationResponse {
  /** Whether the verification was successful */
  success: boolean;
  
  /** Human-readable summary (optional, only if requested) */
  summary?: {
    verdict: string;
    riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
    riskScore: string;
    explanation: string;
    testsRun: string[];
    findings: Array<{
      severity: string;
      message: string;
      category?: string;
    }>;
    nextSteps: string[];
  };
  
  /** Full verification result */
  result: {
    /** Risk assessment */
    risk: {
      overall: number;
      level: 'low' | 'moderate' | 'high' | 'critical';
      components: {
        hallucination: number;
        consistency: number;
        csm6: number;
      };
      blockers: string[];
      action: 'allow' | 'review' | 'block';
      confidence: {
        value: number;
        interval: string;
        method: string;
      };
      interpretation: string;
    };
    
    /** Hallucination detection results */
    hallucination: {
      claims: any[];
      suspiciousClaims: any[];
      riskScore: number;
      confidence: any;
      riskIndicators: any;
      limitations: string[];
      methodology: string;
    };
    
    /** Consistency analysis results */
    consistency: {
      sections: string[];
      avgSimilarity: number;
      stable: boolean;
      drift: boolean;
      contradictions: any[];
      confidence: any;
      limitations: string[];
      methodology: string;
    };
    
    /** CSM6 security results */
    csm6: {
      findings: Array<{
        severity: string;
        message: string;
        category: string;
      }>;
      summary: {
        total: number;
        bySeverity: any;
        byCategory: any;
      };
      riskScore: number;
      passed: boolean;
      profile: string;
      checksPerformed: string[];
      limitations: string[];
      methodology: string;
    };
    
    /** Metadata */
    meta: {
      verification_id: string;
      timestamp: string;
      latency_ms: number;
      version: string;
      tier: string;
      enginesUsed: string[];
    };
    
    /** Limitations */
    limitations: string[];
    notChecked: string[];
  };
  
  /** Response metadata */
  meta: {
    version: string;
    timestamp: string;
  };
  
  /** Error information (only if success is false) */
  error?: {
    message: string;
    code?: string;
  };
}

export interface HealthResponse {
  ok: boolean;
  version: string;
  service: string;
  timestamp: string;
  uptime?: number;
}

export interface CheckInputResponse {
  safe: boolean;
  issues: string[];
  sanitized?: string;
}

export interface CheckPIIResponse {
  containsPII: boolean;
  types: string[];
  redacted?: string;
}

export interface ClassifyResponse {
  intent: string[];
  confidence: number;
  category: string;
}

/**
 * Schema version - increment on breaking changes
 */
export const SCHEMA_VERSION = '1.0.0';

/**
 * Validate a verification response against the schema
 */
export function validateVerificationResponse(data: any): data is VerificationResponse {
  return (
    typeof data === 'object' &&
    typeof data.success === 'boolean' &&
    typeof data.result === 'object' &&
    typeof data.result.risk === 'object' &&
    typeof data.meta === 'object'
  );
}
