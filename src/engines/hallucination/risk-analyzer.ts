/**
 * Risk Analyzer
 * 
 * Analyzes risk indicators for claims using pattern-based heuristics.
 * All processing is local - no external API calls.
 * 
 * @module engines/hallucination/risk-analyzer
 * @author Haiec
 * @license MIT
 */

import { Claim } from '../../types/results';
import { Config } from '../../types/config';

// Patterns for detecting fabricated statistics
const FABRICATED_STAT_PATTERNS = [
  /\b\d{1,2}\.\d{1,2}%\b/,  // Overly precise percentages like 73.47%
  /\bexactly \d+/i,         // "exactly 1234"
  /\b\d{4,}(?:,\d{3})+\b/,  // Large specific numbers like 10,847
  /\b(?:9[5-9]|100)(?:\.\d+)?%/,  // Suspiciously high percentages 95-100%
];

// Patterns for detecting overconfident language
const OVERCONFIDENT_PATTERNS = [
  /\b(?:absolutely|definitely|certainly|undoubtedly|unquestionably)\b/i,
  /\b(?:100%|guaranteed|proven fact|without doubt)\b/i,
  /\b(?:always|never|impossible|inevitable)\b/i,
  /\b(?:no doubt|beyond question|indisputable)\b/i,
  /\b(?:everyone knows|it is certain|there is no question)\b/i,
];

// Patterns for detecting fake authority appeals
const FAKE_AUTHORITY_PATTERNS = [
  /\b(?:studies show|research proves|scientists confirm|experts agree)\b/i,
  /\b(?:according to (?:a |recent )?(?:study|research|survey))\b/i,
  /\b(?:it has been (?:proven|shown|demonstrated))\b/i,
  /\b(?:universally accepted|widely known|common knowledge)\b/i,
];

// Patterns for detecting temporal inconsistencies
const TEMPORAL_PATTERNS = [
  /\b(19|20)\d{2}\b/g,  // Years
  /\b(?:yesterday|today|tomorrow|last (?:week|month|year)|next (?:week|month|year))\b/gi,
];

// Patterns for detecting numerical claims
const NUMERICAL_CLAIM_PATTERNS = [
  /\b\d+(?:\.\d+)?(?:\s*(?:million|billion|trillion|thousand))?\b/gi,
  /\b(?:\$|USD|EUR)\s*\d+/gi,
  /\b\d+(?:\.\d+)?%/g,
];

/**
 * Analyze risk indicators for a claim with enhanced detection
 */
export function analyzeRiskIndicators(claim: Claim, _config: Config): Claim {
  const text = claim.text;
  
  // Calculate additional risk factors
  const fabricatedStatRisk = detectFabricatedStatistics(text);
  const overconfidenceRisk = detectOverconfidence(text);
  const fakeAuthorityRisk = detectFakeAuthority(text);
  const temporalRisk = detectTemporalIssues(text);
  const numericalRisk = detectNumericalRisk(text);
  const hedgingScore = detectHedging(text);
  const specificitScore = detectSpecificity(text);
  
  // Combine risks into updated indicators
  const combinedRisk = (
    fabricatedStatRisk * 0.25 +
    overconfidenceRisk * 0.20 +
    fakeAuthorityRisk * 0.20 +
    temporalRisk * 0.10 +
    numericalRisk * 0.15 +
    (1 - hedgingScore) * 0.05 +
    (1 - specificitScore) * 0.05
  );
  
  // Update lack of specificity based on new analysis
  const updatedSpecificity = Math.max(
    claim.riskIndicators.lackOfSpecificity,
    1 - specificitScore
  );
  
  return {
    ...claim,
    riskIndicators: {
      ...claim.riskIndicators,
      lackOfSpecificity: updatedSpecificity,
      // Add new risk factors as custom properties
      fabricatedStatRisk,
      overconfidenceRisk,
      fakeAuthorityRisk,
      combinedRisk
    } as any
  };
}

/**
 * Detect fabricated statistics patterns
 */
function detectFabricatedStatistics(text: string): number {
  let risk = 0;
  
  for (const pattern of FABRICATED_STAT_PATTERNS) {
    if (pattern.test(text)) {
      risk += 0.3;
    }
  }
  
  // Check for suspiciously precise large numbers
  const numbers = text.match(/\b\d{3,}\b/g) || [];
  for (const num of numbers) {
    // Numbers ending in 7, 3, or other "random-looking" digits are suspicious
    if (/[1379]$/.test(num) && num.length > 3) {
      risk += 0.1;
    }
  }
  
  return Math.min(1, risk);
}

/**
 * Detect overconfident language
 */
function detectOverconfidence(text: string): number {
  let risk = 0;
  
  for (const pattern of OVERCONFIDENT_PATTERNS) {
    if (pattern.test(text)) {
      risk += 0.25;
    }
  }
  
  // Check for multiple exclamation marks
  const exclamations = (text.match(/!/g) || []).length;
  if (exclamations > 1) {
    risk += 0.1 * exclamations;
  }
  
  // Check for ALL CAPS words (excluding acronyms)
  const capsWords = text.match(/\b[A-Z]{4,}\b/g) || [];
  if (capsWords.length > 0) {
    risk += 0.1 * capsWords.length;
  }
  
  return Math.min(1, risk);
}

/**
 * Detect fake authority appeals
 */
function detectFakeAuthority(text: string): number {
  let risk = 0;
  
  for (const pattern of FAKE_AUTHORITY_PATTERNS) {
    if (pattern.test(text)) {
      risk += 0.2;
    }
  }
  
  // Check for vague expert references
  if (/\b(?:experts|scientists|researchers|studies)\b/i.test(text)) {
    // Without specific names or citations
    if (!/\b(?:Dr\.|Prof\.|[A-Z][a-z]+ et al\.|\(\d{4}\)|\[\d+\])/i.test(text)) {
      risk += 0.2;
    }
  }
  
  // Check for "many people" type appeals
  if (/\b(?:many people|most people|everyone|nobody)\b/i.test(text)) {
    risk += 0.15;
  }
  
  return Math.min(1, risk);
}

/**
 * Detect temporal inconsistencies
 */
function detectTemporalIssues(text: string): number {
  let risk = 0;
  
  // Extract all years
  const years = text.match(/\b(19|20)\d{2}\b/g) || [];
  const yearNums = years.map(y => parseInt(y, 10));
  
  // Check for future dates presented as facts
  const currentYear = new Date().getFullYear();
  for (const year of yearNums) {
    if (year > currentYear) {
      risk += 0.3;
    }
  }
  
  // Check for impossible timelines (year X before year Y where X > Y)
  if (yearNums.length >= 2) {
    const sorted = [...yearNums].sort((a, b) => a - b);
    // Check if text implies wrong order
    if (/before|prior to|preceded/i.test(text)) {
      const firstMentioned = yearNums[0];
      const secondMentioned = yearNums[1];
      if (firstMentioned > secondMentioned) {
        risk += 0.4;
      }
    }
  }
  
  return Math.min(1, risk);
}

/**
 * Detect numerical claim risks
 */
function detectNumericalRisk(text: string): number {
  let risk = 0;
  
  // Count numerical claims
  const numbers = text.match(NUMERICAL_CLAIM_PATTERNS[0]) || [];
  const currencies = text.match(NUMERICAL_CLAIM_PATTERNS[1]) || [];
  const percentages = text.match(NUMERICAL_CLAIM_PATTERNS[2]) || [];
  
  const totalNumerical = numbers.length + currencies.length + percentages.length;
  
  // High density of numbers without sources is risky
  const words = text.split(/\s+/).length;
  const numericalDensity = totalNumerical / words;
  
  if (numericalDensity > 0.15) {
    risk += 0.3;
  }
  
  // Check for round numbers (often fabricated)
  for (const num of numbers) {
    const n = parseInt(num.replace(/,/g, ''), 10);
    if (n > 100 && n % 100 === 0) {
      risk += 0.05;
    }
    if (n > 1000 && n % 1000 === 0) {
      risk += 0.1;
    }
  }
  
  return Math.min(1, risk);
}

/**
 * Detect hedging language (reduces risk)
 */
function detectHedging(text: string): number {
  const hedgingPatterns = [
    /\b(?:may|might|could|possibly|perhaps|probably)\b/i,
    /\b(?:suggests|indicates|appears|seems)\b/i,
    /\b(?:approximately|about|around|roughly|estimated)\b/i,
    /\b(?:in my opinion|I think|I believe)\b/i,
    /\b(?:it is possible|there is a chance)\b/i,
  ];
  
  let hedgingScore = 0;
  for (const pattern of hedgingPatterns) {
    if (pattern.test(text)) {
      hedgingScore += 0.2;
    }
  }
  
  return Math.min(1, hedgingScore);
}

/**
 * Detect specificity (higher is better)
 */
function detectSpecificity(text: string): number {
  let score = 0.3; // Base score
  
  // Proper nouns add specificity
  const properNouns = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
  score += Math.min(0.3, properNouns.length * 0.1);
  
  // Dates add specificity
  if (/\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/i.test(text)) {
    score += 0.2;
  }
  
  // Citations add specificity
  if (/\(\d{4}\)|\[\d+\]|et al\./i.test(text)) {
    score += 0.2;
  }
  
  // URLs add specificity
  if (/https?:\/\/\S+/i.test(text)) {
    score += 0.1;
  }
  
  return Math.min(1, score);
}

/**
 * Check for contradiction signals between claims
 */
export function checkContradictions(claims: Claim[]): Claim[] {
  const contradictionPairs: Array<[number, number]> = [];
  
  for (let i = 0; i < claims.length; i++) {
    for (let j = i + 1; j < claims.length; j++) {
      if (detectContradiction(claims[i], claims[j])) {
        contradictionPairs.push([i, j]);
      }
    }
  }
  
  // Mark claims involved in contradictions
  const updatedClaims = claims.map((claim, index) => {
    const isInvolved = contradictionPairs.some(
      ([a, b]) => a === index || b === index
    );
    
    if (isInvolved) {
      return {
        ...claim,
        riskIndicators: {
          ...claim.riskIndicators,
          contradictionSignal: true
        }
      };
    }
    
    return claim;
  });
  
  return updatedClaims;
}

/**
 * Detect potential contradiction between two claims
 */
function detectContradiction(claim1: Claim, claim2: Claim): boolean {
  const text1 = claim1.text.toLowerCase();
  const text2 = claim2.text.toLowerCase();
  
  // Check for negation patterns
  const negationPatterns = [
    { positive: /\bis\b/, negative: /\bis not\b|\bisn't\b/ },
    { positive: /\bwill\b/, negative: /\bwill not\b|\bwon't\b/ },
    { positive: /\bcan\b/, negative: /\bcannot\b|\bcan't\b/ },
    { positive: /\bdoes\b/, negative: /\bdoes not\b|\bdoesn't\b/ },
    { positive: /\bhas\b/, negative: /\bhas not\b|\bhasn't\b/ },
    { positive: /\btrue\b/, negative: /\bfalse\b/ },
    { positive: /\byes\b/, negative: /\bno\b/ },
    { positive: /\balways\b/, negative: /\bnever\b/ },
    { positive: /\ball\b/, negative: /\bnone\b/ }
  ];
  
  for (const pattern of negationPatterns) {
    const match1Pos = pattern.positive.test(text1);
    const match1Neg = pattern.negative.test(text1);
    const match2Pos = pattern.positive.test(text2);
    const match2Neg = pattern.negative.test(text2);
    
    // One has positive, other has negative
    if ((match1Pos && match2Neg) || (match1Neg && match2Pos)) {
      // Check if they're about the same subject (simple overlap check)
      const words1 = new Set(text1.split(/\s+/).filter(w => w.length > 4));
      const words2 = new Set(text2.split(/\s+/).filter(w => w.length > 4));
      
      const overlap = [...words1].filter(w => words2.has(w));
      
      if (overlap.length >= 2) {
        return true;
      }
    }
  }
  
  return false;
}
