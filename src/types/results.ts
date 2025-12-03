/**
 * llmverify Result Types
 * 
 * All results include limitations and confidence intervals.
 * We provide risk indicators, not certainties.
 * 
 * @module types/results
 * @author Haiec
 * @license MIT
 */

import { Tier } from './config';

export type Category = 
  | 'security' 
  | 'privacy' 
  | 'safety' 
  | 'fairness' 
  | 'reliability' 
  | 'governance';

export type Severity = 
  | 'info' 
  | 'low' 
  | 'medium' 
  | 'high' 
  | 'critical';

export type Surface = 
  | 'input' 
  | 'output' 
  | 'behavior';

export interface ConfidenceScore {
  value: number;
  interval: [number, number];
  method: 'heuristic' | 'bootstrap' | 'bayesian' | 'empirical';
  factors?: {
    patternStrength?: number;
    contextClarity?: number;
    historicalAccuracy?: number;
  };
}

export interface Evidence {
  span?: [number, number];
  textSample?: string;
  pattern?: string;
  context?: string;
}

export interface Finding {
  id: string;
  category: Category;
  severity: Severity;
  surface: Surface;
  message: string;
  recommendation: string;
  evidence?: Evidence;
  confidence: ConfidenceScore;
  limitations: string[];
  methodology: string;
  metadata?: Record<string, unknown>;
}

export interface Claim {
  text: string;
  span: [number, number];
  type: 'factual' | 'opinion' | 'instruction' | 'metadata';
  verifiable: boolean;
  riskIndicators: {
    lackOfSpecificity: number;
    missingCitation: boolean;
    vagueLanguage: boolean;
    contradictionSignal: boolean;
  };
  confidence: ConfidenceScore;
  limitations: string[];
}

export interface HallucinationResult {
  claims: Claim[];
  suspiciousClaims: Claim[];
  riskScore: number;
  confidence: ConfidenceScore;
  riskIndicators: {
    lackOfSpecificity: number;
    missingCitations: number;
    vagueLanguage: number;
    contradictionSignals: number;
  };
  limitations: string[];
  methodology: string;
}

export interface Contradiction {
  section1: number;
  section2: number;
  claim1: string;
  claim2: string;
  type: 'factual' | 'temporal' | 'logical' | 'sentiment_drift' | 'style_drift' | 'numerical';
  confidence: number;
}

export interface ConsistencyResult {
  sections: string[];
  avgSimilarity: number;
  similarityMatrix?: number[][];
  stable: boolean;
  drift: boolean;
  contradictions: Contradiction[];
  confidence: ConfidenceScore;
  limitations: string[];
  methodology: string;
}

export interface JSONResult {
  valid: boolean;
  parsed: unknown;
  schema?: unknown;
  schemaValid: boolean;
  schemaErrors: string[];
  repaired: boolean;
  repairMethod?: string;
  structure: {
    depth: number;
    keyCount: number;
    issues: string[];
  };
  limitations: string[];
  methodology: string;
}

export interface CSM6Result {
  findings: Finding[];
  summary: {
    total: number;
    bySeverity: Record<Severity, number>;
    byCategory: Record<Category, number>;
  };
  riskScore: number;
  passed: boolean;
  profile: string;
  checksPerformed: string[];
  limitations: string[];
  methodology: string;
}

export interface RiskScore {
  overall: number;
  level: 'low' | 'moderate' | 'high' | 'critical';
  components: {
    hallucination: number;
    consistency: number;
    csm6: number;
    json?: number;
  };
  blockers: string[];
  action: 'allow' | 'review' | 'block';
  confidence: ConfidenceScore;
  interpretation: string;
}

export interface VerifyResult {
  hallucination?: HallucinationResult;
  consistency?: ConsistencyResult;
  json?: JSONResult;
  csm6?: CSM6Result;
  risk: RiskScore;
  meta: {
    verification_id: string;
    timestamp: string;
    latency_ms: number;
    version: string;
    tier: Tier;
    enginesUsed: string[];
  };
  limitations: string[];
  notChecked: string[];
}
