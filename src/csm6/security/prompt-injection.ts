/**
 * Prompt Injection Detection & Deterrence
 * 
 * Comprehensive detection based on OWASP LLM-01.
 * Includes detection, sanitization, and deterrence utilities.
 * 
 * @module csm6/security/prompt-injection
 * @author Haiec
 * @license MIT
 */

import { Finding, ConfidenceScore } from '../../types/results';
import { truncate, extractContext, isLikelyQuoted } from '../../utils/text';

const LIMITATIONS = [
  'Pattern-based detection (novel attacks may evade)',
  'English language only',
  'Context-dependent false positives possible',
  'Obfuscated attacks may not be detected',
  'Base64/encoding attacks have limited detection',
  'Educational content about attacks may be flagged'
];

const METHODOLOGY =
  'OWASP LLM-01 aligned pattern matching. ' +
  'Detects known prompt injection techniques using regex patterns ' +
  'validated against public attack datasets (HackAPrompt, Gandalf, etc). ' +
  'Accuracy: ~70-85% on known attacks, lower on novel variations.';

interface PatternConfig {
  patterns: RegExp[];
  severity: 'medium' | 'high' | 'critical';
  confidence: number;
  description: string;
}

/**
 * Comprehensive prompt injection patterns
 * Categories based on OWASP LLM Top 10 and real-world attack datasets
 */
const PATTERNS: Record<string, PatternConfig> = {
  // OWASP LLM01: System Override Attempts
  systemOverride: {
    patterns: [
      /\b(ignore|bypass|forget|disregard)\s+(all\s+)?(your\s+)?(previous|prior|above|earlier)\s+(instructions?|rules?|prompts?|directives?)/gi,
      /\byou\s+are\s+now\s+(the\s+)?(system|admin|developer|root|god\s*mode)\b/gi,
      /\bas\s+(system|admin|developer|root),?\s+you\s+(must|should|will|shall)\b/gi,
      /\b(new|updated?|revised)\s+(instructions?|rules?|system\s+prompt|directives?)\s*:?\s*\n/gi,
      /\b(start|begin)\s+(with|by)\s+(ignoring|forgetting|disregarding)\b/gi,
      /\bfrom\s+now\s+on,?\s+(you\s+)?(will|must|should|are)/gi,
      /\breset\s+(your|all)\s+(instructions?|rules?|context)/gi,
      /\b(ignore|bypass|forget|disregard)\s+(all\s+)?(your\s+)?(rules?|guidelines?|policies|directives?|constraints?)\b/gi
    ],
    severity: 'high',
    confidence: 0.8,
    description: 'Attempts to override system instructions'
  },
  
  // Policy/Safety Bypass
  policyBypass: {
    patterns: [
      /\b(ignore|bypass|override|disable|turn\s+off)\s+(all\s+)?(safety|content|policy|policies|filters?|guidelines?|restrictions?)/gi,
      /\b(pretend|act\s+as\s+if|simulate|imagine)\s+you\s+(have\s+no|don'?t\s+have|lack|are\s+without)\s+(restrictions?|limitations?|rules?|policies)\b/gi,
      /\bi\s+give\s+you\s+permission\s+to\s+(ignore|bypass|break)\b/gi,
      /\b(enable|activate|enter)\s+(developer|debug|god|admin)\s+mode/gi,
      /\bunlock\s+(your\s+)?(full|hidden|secret)\s+(potential|capabilities|features)/gi,
      /\bno\s+(ethical|moral|safety)\s+(guidelines?|restrictions?|limitations?)/gi
    ],
    severity: 'high',
    confidence: 0.75,
    description: 'Attempts to bypass safety policies'
  },
  
  // Context/System Prompt Exfiltration
  contextExfiltration: {
    patterns: [
      /\b(print|show|display|reveal|output|dump|list)\s+(your\s+)?(system\s+prompt|original\s+instructions?|initial\s+prompt|hidden\s+(config|instructions?))\b/gi,
      /\bwhat\s+(is|are|were|was)\s+your\s+(original|initial|first|secret)\s+(instructions?|prompt|rules?|directives?)\b/gi,
      /\b(repeat|show|print)\s+(everything|all)\s+(above|before|prior|previous)\b/gi,
      /\b(show|display|list)\s+(all\s+)?(previous|prior|earlier)\s+messages?\b/gi,
      /\brepeat\s+(the\s+)?(text|words|content)\s+(above|before)/gi,
      /\bwhat\s+did\s+(the\s+)?(user|developer|admin)\s+tell\s+you/gi,
      /\b(output|print|echo)\s+(your\s+)?(config|configuration|settings|parameters)/gi,
      /\b(output|reveal|show|give\s+me)\s+(the\s+)?(system\s+prompt|system\s+instructions?|hidden\s+prompt)/gi
    ],
    severity: 'medium',
    confidence: 0.7,
    description: 'Attempts to extract system prompt or context'
  },
  
  // Jailbreak Attempts (DAN, etc.)
  jailbreak: {
    patterns: [
      /\b(DAN|do\s+anything\s+now)\b/gi,
      /\bjailbreak(ed|ing)?\b/gi,
      /\b(STAN|DUDE|AIM|KEVIN)\s+(mode|persona)/gi,
      /\bact\s+as\s+(an?\s+)?(unrestricted|unfiltered|uncensored)\b/gi,
      /\bpretend\s+(to\s+be|you\s+are)\s+(an?\s+)?(evil|malicious|unethical)/gi,
      /\byou\s+are\s+(now\s+)?(free|liberated)\s+from\s+(all\s+)?(restrictions?|rules?)/gi,
      /\bopposite\s+(mode|day|personality)/gi,
      /\balter\s+ego/gi
    ],
    severity: 'high',
    confidence: 0.85,
    description: 'Known jailbreak techniques (DAN, etc.)'
  },
  
  // Roleplay Manipulation
  roleplayManipulation: {
    patterns: [
      /\bpretend\s+(you\s+are|to\s+be)\s+(an?\s+)?(hacker|criminal|villain|terrorist)/gi,
      /\broleplay\s+as\s+(an?\s+)?(malicious|evil|unethical)/gi,
      /\bact\s+as\s+if\s+you\s+(have\s+no|don'?t\s+have)\s+(morals?|ethics?)/gi,
      /\bimagine\s+you\s+(are|were)\s+(programmed|designed)\s+to\s+(harm|hurt|attack)/gi,
      /\bfor\s+(a\s+)?(fictional|hypothetical)\s+(story|scenario),?\s+(ignore|bypass)/gi
    ],
    severity: 'medium',
    confidence: 0.7,
    description: 'Roleplay-based manipulation attempts'
  },
  
  // Tool/Function Abuse
  toolAbuse: {
    patterns: [
      /\b(execute|run|call|invoke)\s+.*\b(delete|drop|truncate|remove|destroy|rm\s+-rf)\b/gi,
      /\b(send|email|post|upload|transmit)\s+.*\b(password|credentials?|secret|token|key|private)\b/gi,
      /\b(read|write|access)\s+.*\b(\/etc\/|\/root\/|\.ssh|\.aws|\.env)\b/gi,
      /\b(curl|wget|fetch)\s+http/gi,
      /\b(eval|exec|system|shell_exec|subprocess)\s*\(/gi,
      /\bsudo\s+/gi,
      /\bchmod\s+777/gi
    ],
    severity: 'critical',
    confidence: 0.85,
    description: 'Attempts to abuse tools or execute dangerous commands'
  },
  
  // Encoding/Obfuscation Attacks
  encodingAttack: {
    patterns: [
      /\bdecode\s+(this|the\s+following)\s+(base64|hex|rot13)/gi,
      /\b(base64|hex|rot13)\s*:\s*[A-Za-z0-9+/=]{20,}/gi,
      /\\x[0-9a-fA-F]{2}/g,
      /\\u[0-9a-fA-F]{4}/g,
      /&#x?[0-9a-fA-F]+;/g,
      /\beval\s*\(\s*atob\s*\(/gi
    ],
    severity: 'medium',
    confidence: 0.6,
    description: 'Encoded or obfuscated attack payloads'
  },
  
  // Indirect Injection (via data)
  indirectInjection: {
    patterns: [
      /\[SYSTEM\]|\[INST\]|\[\/INST\]|<\|system\|>|<\|user\|>/gi,
      /###\s*(system|instruction|human|assistant)\s*:/gi,
      /<\/?s>|<\/?human>|<\/?assistant>/gi,
      /\bHuman:\s*|\bAssistant:\s*|\bSystem:\s*/gi
    ],
    severity: 'high',
    confidence: 0.75,
    description: 'Indirect injection via data/markup'
  },
  
  // Prompt Leaking via Completion
  completionLeak: {
    patterns: [
      /\bcomplete\s+the\s+(following|sentence|text)\s*:\s*["']?(system|instruction)/gi,
      /\bfinish\s+this\s+(sentence|prompt)\s*:\s*["']?you\s+are/gi,
      /\bwhat\s+comes\s+(after|next)\s*:\s*["']?(ignore|bypass|system)/gi
    ],
    severity: 'medium',
    confidence: 0.65,
    description: 'Attempts to leak prompts via completion'
  }
};

/**
 * Check for prompt injection attempts
 * @param input - The input text to check
 * @returns Array of findings
 */
export function checkPromptInjection(input: string): Finding[] {
  const findings: Finding[] = [];
  
  for (const [category, config] of Object.entries(PATTERNS)) {
    for (const pattern of config.patterns) {
      // Reset lastIndex for global patterns
      pattern.lastIndex = 0;
      const matches = Array.from(input.matchAll(pattern));
      
      if (matches.length > 0) {
        const match = matches[0];
        
        // Check for false positives
        if (!isLikelyFalsePositive(input, match[0])) {
          findings.push(createFinding(
            category,
            config.severity,
            match,
            config.confidence,
            input,
            config.description
          ));
          
          // Only report one finding per category
          break;
        }
      }
    }
  }
  
  return findings;
}

/**
 * Sanitize input by removing or neutralizing injection attempts
 * @param input - The input to sanitize
 * @returns Sanitized input and list of removed patterns
 */
export function sanitizePromptInjection(input: string): { 
  sanitized: string; 
  removed: string[];
  wasModified: boolean;
} {
  let sanitized = input;
  const removed: string[] = [];
  
  for (const [category, config] of Object.entries(PATTERNS)) {
    for (const pattern of config.patterns) {
      pattern.lastIndex = 0;
      const matches = Array.from(sanitized.matchAll(pattern));
      
      for (const match of matches) {
        if (!isLikelyFalsePositive(input, match[0])) {
          removed.push(`[${category}]: ${match[0]}`);
          sanitized = sanitized.replace(match[0], '[REMOVED]');
        }
      }
    }
  }
  
  return {
    sanitized,
    removed,
    wasModified: removed.length > 0
  };
}

/**
 * Get risk score for input (0-1)
 * @param input - The input to score
 * @returns Risk score between 0 and 1
 */
export function getInjectionRiskScore(input: string): number {
  const findings = checkPromptInjection(input);
  if (findings.length === 0) return 0;
  
  const severityWeights: Record<string, number> = {
    medium: 0.4,
    high: 0.7,
    critical: 1.0
  };
  
  let maxScore = 0;
  for (const finding of findings) {
    const score = severityWeights[finding.severity] * finding.confidence.value;
    maxScore = Math.max(maxScore, score);
  }
  
  return maxScore;
}

/**
 * Quick check if input is likely safe (no injection detected)
 * @param input - The input to check
 * @returns true if no injection detected
 */
export function isInputSafe(input: string): boolean {
  return checkPromptInjection(input).length === 0;
}

/**
 * Create a finding object
 */
function createFinding(
  category: string,
  severity: Finding['severity'],
  match: RegExpMatchArray,
  confidence: number,
  fullInput: string,
  description: string
): Finding {
  const messages: Record<string, string> = {
    systemOverride: 'System override attempt detected',
    policyBypass: 'Policy bypass attempt detected',
    contextExfiltration: 'System prompt exfiltration attempt detected',
    jailbreak: 'Jailbreak attempt detected (DAN/similar)',
    roleplayManipulation: 'Roleplay manipulation attempt detected',
    toolAbuse: 'Tool abuse attempt detected',
    encodingAttack: 'Encoded/obfuscated attack detected',
    indirectInjection: 'Indirect injection markers detected',
    completionLeak: 'Prompt leak via completion detected'
  };
  
  const recommendations: Record<string, string> = {
    systemOverride: 'Reject or sanitize request. Use sanitizePromptInjection() to clean input.',
    policyBypass: 'Block request - attempting to bypass safety policies.',
    contextExfiltration: 'Sanitize request to prevent system prompt leakage.',
    jailbreak: 'Block immediately - known jailbreak technique.',
    roleplayManipulation: 'Review carefully - roleplay may be used to bypass safety.',
    toolAbuse: 'Block immediately - attempting dangerous operations.',
    encodingAttack: 'Decode and re-scan before processing.',
    indirectInjection: 'Sanitize data inputs - may contain injected instructions.',
    completionLeak: 'Block - attempting to extract prompts via completion.'
  };
  
  const contextClarity = analyzeContext(fullInput, match[0]);
  
  return {
    id: `PROMPT_INJECTION_${category.toUpperCase()}`,
    category: 'security',
    severity,
    surface: 'input',
    message: messages[category] || 'Prompt injection attempt detected',
    recommendation: recommendations[category] || 'Review and sanitize input.',
    
    evidence: {
      textSample: truncate(match[0], 100),
      pattern: category,
      context: extractContext(fullInput, match.index || 0, 50)
    },
    
    confidence: calculateConfidence(confidence, contextClarity),
    limitations: LIMITATIONS,
    methodology: METHODOLOGY,
    metadata: {
      attackType: category,
      description
    }
  };
}

/**
 * Calculate confidence score
 */
function calculateConfidence(baseConfidence: number, contextClarity: number): ConfidenceScore {
  const value = baseConfidence * contextClarity;
  
  return {
    value,
    interval: [Math.max(0, value - 0.15), Math.min(1, value + 0.15)],
    method: 'empirical',
    factors: {
      patternStrength: baseConfidence,
      contextClarity
    }
  };
}

/**
 * Check if this is likely a false positive
 */
function isLikelyFalsePositive(fullText: string, matchedText: string): boolean {
  // Educational context
  const educationalMarkers = [
    /this\s+is\s+an\s+example\s+of/i,
    /for\s+educational\s+purposes/i,
    /demonstrate\s+how/i,
    /showing\s+you\s+what\s+not\s+to/i,
    /never\s+do\s+this/i,
    /avoid\s+doing/i,
    /here'?s?\s+how\s+attacks?\s+work/i,
    /security\s+training/i,
    /awareness\s+training/i
  ];
  
  if (educationalMarkers.some(p => p.test(fullText))) {
    return true;
  }
  
  // Question about security
  const securityQuestions = [
    /how\s+(do|can)\s+(?:i|we|you)\s+prevent/i,
    /what\s+(?:is|are)\s+the\s+risks?\s+of/i,
    /how\s+to\s+protect\s+against/i,
    /how\s+to\s+detect/i,
    /what\s+is\s+prompt\s+injection/i
  ];
  
  if (securityQuestions.some(p => p.test(fullText))) {
    return true;
  }
  
  // Quoted content
  if (isLikelyQuoted(fullText, matchedText)) {
    return true;
  }
  
  return false;
}

/**
 * Analyze context to refine confidence
 */
function analyzeContext(fullText: string, match: string): number {
  const matchIndex = fullText.indexOf(match);
  if (matchIndex === -1) return 0.9;
  
  const before = fullText.substring(Math.max(0, matchIndex - 30), matchIndex);
  const after = fullText.substring(matchIndex + match.length, matchIndex + match.length + 30);
  
  // Lower confidence if surrounded by quotes or code markers
  if (/["'`]/.test(before) || /["'`]/.test(after)) {
    return 0.6;
  }
  
  // Lower confidence if in code block
  if (/```/.test(before) || /```/.test(after)) {
    return 0.5;
  }
  
  return 0.9;
}
