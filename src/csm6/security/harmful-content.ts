/**
 * Harmful Content Detection
 * 
 * Detects potentially harmful content patterns.
 * Pattern-based detection with honest limitations.
 * 
 * @module csm6/security/harmful-content
 * @author Haiec
 * @license MIT
 */

import { Finding, ConfidenceScore } from '../../types/results';
import { truncate, extractContext } from '../../utils/text';

const LIMITATIONS = [
  'Keyword-based detection only',
  'High false positive rate on educational content',
  'Cannot detect context or intent',
  'May miss euphemisms or coded language',
  'English language only'
];

const METHODOLOGY =
  'Keyword pattern matching for harmful content categories. ' +
  'Detects violence, threats, self-harm, and dangerous instructions. ' +
  'Detection rates are heuristic and not empirically calibrated — ' +
  'absence of findings is not proof of safety. Requires human validation.';

interface HarmPattern {
  category: string;
  patterns: RegExp[];
  severity: 'medium' | 'high' | 'critical';
  confidence: number;
  message: string;
}

const HARM_PATTERNS: HarmPattern[] = [
  {
    category: 'VIOLENCE',
    patterns: [
      /\b(kill|murder|assassinate|execute)\s+(him|her|them|you|everyone)\b/gi,
      /\bhow\s+to\s+(kill|murder|harm|hurt)\b/gi,
      /\b(bomb|explosive|weapon)\s+(making|instructions|how\s+to)\b/gi
    ],
    severity: 'critical',
    confidence: 0.7,
    message: 'Violent content detected'
  },
  {
    category: 'THREATS',
    patterns: [
      /\bi\s+will\s+(kill|hurt|harm|destroy)\s+you\b/gi,
      /\byou\s+will\s+(die|suffer|regret)\b/gi,
      /\b(threat|threaten|threatening)\s+to\b/gi
    ],
    severity: 'high',
    confidence: 0.65,
    message: 'Threatening language detected'
  },
  {
    category: 'SELF_HARM',
    patterns: [
      /\bhow\s+to\s+(commit\s+suicide|kill\s+myself|end\s+my\s+life)\b/gi,
      /\b(suicide|self-harm)\s+(methods?|ways?|instructions?)\b/gi
    ],
    severity: 'critical',
    confidence: 0.75,
    message: 'Self-harm content detected'
  },
  {
    category: 'DANGEROUS_INSTRUCTIONS',
    patterns: [
      /\bhow\s+to\s+(hack|break\s+into|steal)\b/gi,
      /\b(synthesize|make|create)\s+(drugs?|meth|cocaine|heroin)\b/gi,
      /\b(poison|poisoning)\s+(someone|food|water)\b/gi
    ],
    severity: 'high',
    confidence: 0.6,
    message: 'Dangerous instructions detected'
  },
  {
    category: 'HATE_SPEECH',
    patterns: [
      /\b(hate|kill|exterminate)\s+all\s+(jews|muslims|christians|blacks|whites|gays)\b/gi,
      /\b(inferior|subhuman)\s+(race|people|group)\b/gi
    ],
    severity: 'critical',
    confidence: 0.8,
    message: 'Hate speech detected'
  }
];

/**
 * Check for harmful content
 */
export function checkHarmfulContent(content: string): Finding[] {
  const findings: Finding[] = [];
  const foundCategories = new Set<string>();
  
  for (const harmPattern of HARM_PATTERNS) {
    for (const pattern of harmPattern.patterns) {
      pattern.lastIndex = 0;
      const matches = Array.from(content.matchAll(pattern));
      
      for (const match of matches) {
        if (foundCategories.has(harmPattern.category)) continue;
        
        if (!isLikelyFalsePositive(content, match[0])) {
          foundCategories.add(harmPattern.category);
          
          findings.push({
            id: `HARMFUL_${harmPattern.category}`,
            category: 'safety',
            severity: harmPattern.severity,
            surface: 'output',
            message: harmPattern.message,
            recommendation: 'Block or flag content for human review. Do not display to users.',
            
            evidence: {
              textSample: truncate(match[0], 50),
              pattern: harmPattern.category,
              context: extractContext(content, match.index || 0, 30)
            },
            
            confidence: calculateConfidence(harmPattern.confidence),
            limitations: LIMITATIONS,
            methodology: METHODOLOGY
          });
          
          break;
        }
      }
    }
  }
  
  return findings;
}

/**
 * Calculate confidence score
 */
function calculateConfidence(baseConfidence: number): ConfidenceScore {
  return {
    value: baseConfidence,
    interval: [Math.max(0, baseConfidence - 0.2), Math.min(1, baseConfidence + 0.1)],
    method: 'heuristic',
    factors: {
      patternStrength: baseConfidence,
      contextClarity: 0.5 // Low because keyword-based
    }
  };
}

/**
 * Check for false positives
 */
function isLikelyFalsePositive(fullText: string, match: string): boolean {
  const context = fullText.substring(
    Math.max(0, fullText.indexOf(match) - 100),
    fullText.indexOf(match) + match.length + 100
  ).toLowerCase();
  
  // Educational/warning context
  const educationalMarkers = [
    /warning/i,
    /example\s+of\s+what\s+not/i,
    /never\s+say/i,
    /avoid/i,
    /don'?t\s+do/i,
    /harmful\s+content\s+includes/i,
    /detecting/i,
    /prevention/i,
    /awareness/i,
    /training/i,
    /policy/i
  ];
  
  if (educationalMarkers.some(p => p.test(context))) {
    return true;
  }
  
  // Fiction/story context
  const fictionMarkers = [
    /story/i,
    /novel/i,
    /fiction/i,
    /character/i,
    /plot/i,
    /movie/i,
    /game/i
  ];
  
  if (fictionMarkers.some(p => p.test(context))) {
    return true;
  }
  
  // News/reporting context
  const newsMarkers = [
    /reported/i,
    /according\s+to/i,
    /news/i,
    /article/i,
    /investigation/i
  ];
  
  if (newsMarkers.some(p => p.test(context))) {
    return true;
  }
  
  return false;
}
