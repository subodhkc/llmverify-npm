/**
 * llmverify Constants
 * 
 * Privacy guarantees and accuracy statements.
 * These are NON-NEGOTIABLE principles.
 * 
 * @module constants
 * @author Haiec
 * @license MIT
 */

export const VERSION = '1.5.2';

/**
 * PRIVACY GUARANTEE - NON-NEGOTIABLE
 * 
 * Violation of these principles is a CRITICAL BUG.
 */
export const PRIVACY_GUARANTEE = {
  freeTier: {
    networkTraffic: 'ZERO',
    dataTransmission: 'NONE',
    telemetry: 'DISABLED',
    verification: 'Run tcpdump - you will see nothing',
    
    technicalImplementation: {
      noAPIKeys: true,
      noWebRequests: true,
      noTelemetry: true,
      offlineCapable: true
    }
  },
  
  paidTiers: {
    defaultBehavior: 'LOCAL_PROCESSING',
    apiCalls: 'OPT_IN_ONLY',
    requires: 'EXPLICIT_API_KEY',
    dataRetention: 'USER_CONTROLLED',
    
    technicalImplementation: {
      checkAPIKeyBeforeRequest: true,
      throwErrorIfMissing: true,
      explicitConsentRequired: true
    }
  },
  
  neverEver: [
    'No training on user data',
    'No third-party data sharing',
    'No hidden telemetry',
    'No tracking without explicit consent'
  ]
} as const;

/**
 * ACCURACY STATEMENT
 * 
 * We are HONEST about what we can and cannot detect.
 */
export const ACCURACY_STATEMENT = {
  capabilities: {
    canDetect: [
      'Common prompt injection patterns (OWASP LLM-01)',
      'Known PII patterns (email, phone, SSN)',
      'Secret exposure (API keys, passwords)',
      'Harmful content keywords',
      'JSON structure issues',
      'Internal consistency problems'
    ],
    
    cannotDetect: [
      'Novel or obfuscated attacks',
      'Context-dependent hallucinations without ground truth',
      'Factual accuracy without retrieval',
      'Cultural or regional bias without specialized models',
      'Intent or sarcasm reliably'
    ]
  },
  
  freeTierLimitations: {
    method: 'Pattern-based detection (regex + heuristics)',
    accuracy: 'Better than random, worse than ML models',
    purpose: 'Development, testing, basic screening',
    notFor: 'Production fact-checking or compliance validation'
  },
  
  confidence: {
    reportMethod: 'Always include confidence intervals',
    reportLimitations: 'Every result includes limitations array',
    noCertainty: "Use terms like 'likely', 'suspicious', 'flagged'",
    avoidTerms: ['definitely', 'guaranteed', 'proven']
  }
} as const;

/**
 * APPROVED TERMINOLOGY
 * 
 * Use these terms consistently across all documentation and code.
 */
export const TERMINOLOGY = {
  approved: {
    detection: 'risk indicator identification',
    hallucination: 'consistency analysis and risk scoring',
    accuracy: 'pattern matching with confidence intervals',
    verification: 'automated screening and triage',
    compliance: 'framework alignment and gap analysis'
  },
  
  avoid: {
    detection: 'foolproof detection',
    hallucination: 'hallucination detection',
    accuracy: '100% accurate',
    verification: 'verified as true/false',
    compliance: 'fully compliant'
  },
  
  qualifiers: [
    'may indicate',
    'suggests',
    'flags for review',
    'pattern-based',
    'requires human validation'
  ]
} as const;
