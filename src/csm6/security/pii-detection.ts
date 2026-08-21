/**
 * PII Detection & Redaction
 * 
 * Comprehensive PII detection with redaction utilities.
 * Supports US and international formats.
 * 
 * @module csm6/security/pii-detection
 * @author Haiec
 * @license MIT
 */

import { Finding, ConfidenceScore } from '../../types/results';
import { truncate, extractContext } from '../../utils/text';

const LIMITATIONS = [
  'Pattern-based detection only',
  'May miss obfuscated PII',
  'US-centric patterns for SSN/phone (international formats included)',
  'Context-dependent false positives possible',
  'Cannot detect PII in images or encoded content'
];

const METHODOLOGY =
  'Regex-based pattern matching for common PII formats. ' +
  'Detects emails, phone numbers, SSNs, credit cards, API keys, and more. ' +
  'Accuracy: ~90% for standard formats, lower for variations.';

interface PIIPattern {
  name: string;
  pattern: RegExp;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  message: string;
  category: 'personal' | 'financial' | 'credential' | 'location' | 'health';
}

/**
 * Comprehensive PII patterns
 */
const PII_PATTERNS: PIIPattern[] = [
  // === PERSONAL IDENTIFIERS ===
  {
    name: 'EMAIL',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    severity: 'medium',
    confidence: 0.95,
    message: 'Email address detected',
    category: 'personal'
  },
  {
    name: 'PHONE_US',
    pattern: /\b(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    severity: 'medium',
    confidence: 0.85,
    message: 'US phone number detected',
    category: 'personal'
  },
  {
    name: 'PHONE_INTL',
    pattern: /\b\+(?:[0-9][\s.-]?){6,14}[0-9]\b/g,
    severity: 'medium',
    confidence: 0.8,
    message: 'International phone number detected',
    category: 'personal'
  },
  {
    name: 'SSN',
    pattern: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
    severity: 'critical',
    confidence: 0.8,
    message: 'Potential SSN detected',
    category: 'personal'
  },
  {
    name: 'PASSPORT',
    pattern: /\b[A-Z]{1,2}\d{6,9}\b/g,
    severity: 'high',
    confidence: 0.6,
    message: 'Potential passport number detected',
    category: 'personal'
  },
  {
    name: 'DRIVERS_LICENSE',
    pattern: /\b[A-Z]{1,2}\d{5,8}\b/g,
    severity: 'high',
    confidence: 0.5,
    message: 'Potential drivers license detected',
    category: 'personal'
  },
  {
    name: 'DATE_OF_BIRTH',
    pattern: /\b(?:dob|date\s+of\s+birth|born\s+on|birthday)[:\s]+\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/gi,
    severity: 'medium',
    confidence: 0.85,
    message: 'Date of birth detected',
    category: 'personal'
  },
  
  // === FINANCIAL ===
  {
    name: 'CREDIT_CARD',
    pattern: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g,
    severity: 'critical',
    confidence: 0.9,
    message: 'Credit card number detected',
    category: 'financial'
  },
  {
    name: 'BANK_ACCOUNT',
    pattern: /\b(?:account|acct)[\s#:]*\d{8,17}\b/gi,
    severity: 'high',
    confidence: 0.7,
    message: 'Bank account number detected',
    category: 'financial'
  },
  {
    name: 'ROUTING_NUMBER',
    pattern: /\b(?:routing|aba)[\s#:]*\d{9}\b/gi,
    severity: 'high',
    confidence: 0.75,
    message: 'Bank routing number detected',
    category: 'financial'
  },
  {
    name: 'IBAN',
    pattern: /\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}([A-Z0-9]?){0,16}\b/g,
    severity: 'high',
    confidence: 0.85,
    message: 'IBAN detected',
    category: 'financial'
  },
  
  // === CREDENTIALS & SECRETS ===
  {
    name: 'API_KEY',
    pattern: /\b(?:sk|pk|api|key|token|secret|password)[-_]?[a-zA-Z0-9]{20,}\b/gi,
    severity: 'critical',
    confidence: 0.75,
    message: 'Potential API key or secret detected',
    category: 'credential'
  },
  {
    name: 'AWS_KEY',
    pattern: /\bAKIA[0-9A-Z]{16}\b/g,
    severity: 'critical',
    confidence: 0.95,
    message: 'AWS Access Key ID detected',
    category: 'credential'
  },
  {
    name: 'AWS_SECRET',
    pattern: /\b[A-Za-z0-9/+=]{40}\b/g,
    severity: 'critical',
    confidence: 0.6,
    message: 'Potential AWS Secret Key detected',
    category: 'credential'
  },
  {
    name: 'GITHUB_TOKEN',
    pattern: /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b/g,
    severity: 'critical',
    confidence: 0.95,
    message: 'GitHub token detected',
    category: 'credential'
  },
  {
    name: 'SLACK_TOKEN',
    pattern: /\bxox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24}\b/g,
    severity: 'critical',
    confidence: 0.95,
    message: 'Slack token detected',
    category: 'credential'
  },
  {
    name: 'STRIPE_KEY',
    pattern: /\b(sk|pk)_(test|live)_[A-Za-z0-9]{24,}\b/g,
    severity: 'critical',
    confidence: 0.95,
    message: 'Stripe API key detected',
    category: 'credential'
  },
  {
    name: 'JWT_TOKEN',
    pattern: /\beyJ[A-Za-z0-9-_]+\.eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\b/g,
    severity: 'high',
    confidence: 0.9,
    message: 'JWT token detected',
    category: 'credential'
  },
  {
    name: 'PRIVATE_KEY',
    pattern: /-----BEGIN\s+(RSA|DSA|EC|OPENSSH|PGP)?\s*PRIVATE\s+KEY-----/gi,
    severity: 'critical',
    confidence: 0.98,
    message: 'Private key detected',
    category: 'credential'
  },
  {
    name: 'PASSWORD_INLINE',
    pattern: /\b(?:password|passwd|pwd)\s*[:=]\s*["']?[^\s"']{8,}["']?\b/gi,
    severity: 'critical',
    confidence: 0.85,
    message: 'Inline password detected',
    category: 'credential'
  },
  
  // === LOCATION ===
  {
    name: 'IP_ADDRESS',
    pattern: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    severity: 'low',
    confidence: 0.9,
    message: 'IP address detected',
    category: 'location'
  },
  {
    name: 'IPV6_ADDRESS',
    pattern: /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g,
    severity: 'low',
    confidence: 0.9,
    message: 'IPv6 address detected',
    category: 'location'
  },
  {
    name: 'MAC_ADDRESS',
    pattern: /\b([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})\b/g,
    severity: 'low',
    confidence: 0.9,
    message: 'MAC address detected',
    category: 'location'
  },
  {
    name: 'US_ADDRESS',
    pattern: /\b\d{1,5}\s+[\w\s]+(?:street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln|court|ct)\b/gi,
    severity: 'medium',
    confidence: 0.6,
    message: 'US street address detected',
    category: 'location'
  },
  {
    name: 'ZIP_CODE',
    pattern: /\b\d{5}(?:-\d{4})?\b/g,
    severity: 'low',
    confidence: 0.5,
    message: 'US ZIP code detected',
    category: 'location'
  },
  
  // === HEALTH ===
  {
    name: 'MEDICAL_RECORD',
    pattern: /\b(?:mrn|medical\s+record)[\s#:]*\d{6,12}\b/gi,
    severity: 'critical',
    confidence: 0.8,
    message: 'Medical record number detected',
    category: 'health'
  }
];

/**
 * Check for PII in content
 * @param content - The content to scan
 * @returns Array of findings
 */
export function checkPII(content: string): Finding[] {
  const findings: Finding[] = [];
  const foundTypes = new Set<string>();
  
  for (const piiPattern of PII_PATTERNS) {
    // Reset lastIndex
    piiPattern.pattern.lastIndex = 0;
    const matches = Array.from(content.matchAll(piiPattern.pattern));
    
    for (const match of matches) {
      // Skip if we already found this type (avoid spam)
      if (foundTypes.has(piiPattern.name)) continue;
      
      // Skip if likely false positive
      if (isLikelyFalsePositive(content, match[0], piiPattern.name, match.index)) continue;
      
      foundTypes.add(piiPattern.name);
      
      findings.push({
        id: `PII_${piiPattern.name}`,
        category: 'privacy',
        severity: piiPattern.severity,
        surface: 'output',
        message: piiPattern.message,
        recommendation: `Remove or redact ${piiPattern.name.toLowerCase().replace(/_/g, ' ')} before use.`,
        
        evidence: {
          textSample: redactSample(match[0]),
          pattern: piiPattern.name,
          context: extractContext(content, match.index || 0, 30)
        },
        
        confidence: calculateConfidence(piiPattern.confidence, match[0]),
        limitations: LIMITATIONS,
        methodology: METHODOLOGY,
        metadata: {
          piiType: piiPattern.name,
          piiCategory: piiPattern.category
        }
      });
    }
  }
  
  return findings;
}

/**
 * Redact all PII from content
 * @param content - The content to redact
 * @param replacement - Replacement string (default: [REDACTED])
 * @returns Redacted content and list of redactions
 */
export function redactPII(content: string, replacement = '[REDACTED]'): {
  redacted: string;
  redactions: Array<{ type: string; original: string; position: number }>;
  piiCount: number;
} {
  let redacted = content;
  const redactions: Array<{ type: string; original: string; position: number }> = [];
  
  for (const piiPattern of PII_PATTERNS) {
    piiPattern.pattern.lastIndex = 0;
    const matches = Array.from(content.matchAll(piiPattern.pattern));

    for (const match of matches) {
      if (!isLikelyFalsePositive(content, match[0], piiPattern.name, match.index, true)) {
        redactions.push({
          type: piiPattern.name,
          original: redactSample(match[0]),
          position: match.index || 0
        });
        // Replace ALL occurrences of this exact match (not just the first).
        // Escape regex metacharacters in the matched value before building a
        // global replacement pattern.
        const escaped = match[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        redacted = redacted.replace(new RegExp(escaped, 'g'), replacement);
      }
    }
  }
  
  return {
    redacted,
    redactions,
    piiCount: redactions.length
  };
}

/**
 * Check if content contains any PII
 * @param content - The content to check
 * @returns true if PII detected
 */
export function containsPII(content: string): boolean {
  return checkPII(content).length > 0;
}

/**
 * Get PII risk score (0-1)
 * @param content - The content to score
 * @returns Risk score
 */
export function getPIIRiskScore(content: string): number {
  const findings = checkPII(content);
  if (findings.length === 0) return 0;
  
  const severityWeights: Record<string, number> = {
    low: 0.2,
    medium: 0.4,
    high: 0.7,
    critical: 1.0
  };
  
  let maxScore = 0;
  for (const finding of findings) {
    const score = severityWeights[finding.severity] * finding.confidence.value;
    maxScore = Math.max(maxScore, score);
  }
  
  // Add penalty for multiple PII types
  const typeBonus = Math.min(findings.length * 0.1, 0.3);
  
  return Math.min(1, maxScore + typeBonus);
}

/**
 * Redact sensitive parts of sample for display
 */
function redactSample(text: string): string {
  if (text.length <= 8) {
    return text.substring(0, 2) + '***' + text.substring(text.length - 2);
  }
  
  const visible = Math.min(4, Math.floor(text.length / 4));
  return text.substring(0, visible) + '***' + text.substring(text.length - visible);
}

/**
 * Calculate confidence score
 */
function calculateConfidence(baseConfidence: number, match: string): ConfidenceScore {
  let value = baseConfidence;
  
  // Adjust based on match characteristics
  if (match.length > 20) value += 0.05;
  if (/^[A-Z]/.test(match)) value -= 0.05; // Might be a name, not PII
  
  value = Math.max(0.5, Math.min(0.95, value));
  
  return {
    value,
    interval: [Math.max(0, value - 0.1), Math.min(1, value + 0.1)],
    method: 'empirical',
    factors: {
      patternStrength: baseConfidence
    }
  };
}

/**
 * Check for false positives
 *
 * The placeholder heuristic examines the text SURROUNDING a match, not the
 * match itself, and only matches whole placeholder words (word-bounded).
 * This prevents legitimate values (e.g. the domain `example.com` inside an
 * email, or the word "example" appearing near PII) and substring accidents
 * (e.g. "latest", "contest", "demographic") from silently suppressing
 * redaction.
 *
 * In `aggressive` mode (used by `redactPII`), the placeholder heuristic is
 * skipped entirely. Redaction is a conservative operation: when in doubt,
 * redact. A false positive of redaction (masking a non-PII value) is far
 * less harmful than a false negative (leaving real PII in the output).
 */
function isLikelyFalsePositive(
  fullText: string,
  match: string,
  type: string,
  matchIndex: number = -1,
  aggressive: boolean = false
): boolean {
  // Resolve the actual match position. Fall back to indexOf only when the
  // caller did not provide an index (keeps backwards compatibility).
  const start = matchIndex >= 0 ? matchIndex : fullText.indexOf(match);
  if (start < 0) return false;

  // Build context from the text BEFORE and AFTER the match, deliberately
  // EXCLUDING the matched substring so that placeholder words which are part
  // of the PII value (e.g. "example" in john@example.com) do not trigger a
  // false-positive suppression.
  const before = fullText.substring(Math.max(0, start - 50), start);
  const after = fullText.substring(start + match.length, start + match.length + 50);
  const context = before + after;

  // Placeholder/example indicators. Word-bounded so "latest", "contest",
  // "demographic", etc. do not suppress detection. Skipped in aggressive
  // (redaction) mode.
  if (!aggressive) {
    const placeholders = [
      /\bexample\b/i,
      /\bplaceholder\b/i,
      /\btest\b/i,
      /\bsample\b/i,
      /\bdummy\b/i,
      /\bfake\b/i,
      /\bdemo\b/i,
      /\bxxx\b/i
    ];
    if (placeholders.some(p => p.test(context))) {
      return true;
    }
  }

  // SSN false positives
  if (type === 'SSN') {
    // Only suppress if the WHOLE match is a 2-2-4 date (e.g. 12/25/2024).
    // Anchored so a 3-2-4 SSN like 123-45-6789 is not suppressed by the
    // 23-45-6789 substring that happens to look like a date.
    if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(match)) {
      return true;
    }
    // Check if preceded by date-like context
    if (/date|time|year|month|day/i.test(context)) {
      return true;
    }
  }

  // Phone false positives
  if (type === 'PHONE_US') {
    // Check if it's a zip code or other number
    if (/zip|code|id|number/i.test(context) && !/phone|call|mobile|cell/i.test(context)) {
      return true;
    }
  }

  // ZIP code - too many false positives, require context
  if (type === 'ZIP_CODE') {
    if (!/zip|postal|address/i.test(context)) {
      return true;
    }
  }

  // AWS Secret - high false positive rate
  if (type === 'AWS_SECRET') {
    // Only flag if near AWS context
    if (!/aws|amazon|secret|key/i.test(context)) {
      return true;
    }
  }

  return false;
}
