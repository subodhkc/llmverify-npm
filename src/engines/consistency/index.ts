/**
 * Consistency Engine
 * 
 * Checks for internal consistency, contradictions, and behavioral drift.
 * All processing is local - no external API calls.
 * 
 * @module engines/consistency
 * @author Haiec
 * @license MIT
 */

import { Config } from '../../types/config';
import { ConsistencyResult, Contradiction, ConfidenceScore } from '../../types/results';
import { splitParagraphs } from '../../utils/text';
import { combinedSimilarity } from '../../utils/similarity';

// Sentiment indicators for drift detection
const POSITIVE_SENTIMENT = /\b(?:good|great|excellent|amazing|wonderful|fantastic|love|happy|pleased|satisfied|success|benefit|advantage|improve|best)\b/gi;
const NEGATIVE_SENTIMENT = /\b(?:bad|terrible|awful|horrible|hate|angry|frustrated|disappointed|failure|problem|issue|worst|damage|harm|risk)\b/gi;
const NEUTRAL_MARKERS = /\b(?:however|although|but|nevertheless|on the other hand|conversely|alternatively)\b/gi;

// Style indicators
const FORMAL_MARKERS = /\b(?:therefore|furthermore|consequently|moreover|thus|hence|accordingly|subsequently|notwithstanding)\b/gi;
const INFORMAL_MARKERS = /\b(?:gonna|wanna|kinda|sorta|yeah|nope|cool|awesome|stuff|things|basically|literally|actually|like)\b/gi;

// Technical indicators
const TECHNICAL_MARKERS = /\b(?:algorithm|function|parameter|variable|implementation|interface|protocol|architecture|framework|module|API|database|server|client)\b/gi;

// Numerical patterns for consistency
const NUMERICAL_PATTERN = /\b\d+(?:\.\d+)?(?:\s*(?:%|percent|million|billion|thousand|hundred))?\b/gi;

export class ConsistencyEngine {
  private readonly LIMITATIONS = [
    'Pattern-based consistency checking',
    'May miss subtle contradictions',
    'English language only',
    'Context-dependent accuracy',
    'Requires sufficient text length for meaningful analysis'
  ];
  
  private readonly METHODOLOGY = 
    'Analyzes text sections for internal consistency using similarity metrics, ' +
    'sentiment analysis, style detection, and contradiction pattern matching. ' +
    'Identifies potential logical conflicts, semantic drift, tone shifts, and ' +
    'numerical inconsistencies across sections.';
  
  constructor(private config: Config) {}
  
  async check(content: string): Promise<ConsistencyResult> {
    const sections = splitParagraphs(content);
    
    if (sections.length < 2) {
      return this.createMinimalResult(sections);
    }
    
    // Calculate similarity matrix
    const matrix = this.calculateSimilarityMatrix(sections);
    
    // Calculate average similarity
    const avgSimilarity = this.calculateAverageSimilarity(matrix);
    
    // Detect contradictions
    const contradictions = this.detectContradictions(sections);
    
    // Enhanced drift detection
    const sentimentDrift = this.detectSentimentDrift(sections);
    const styleDrift = this.detectStyleDrift(sections);
    const lengthDrift = this.detectLengthDrift(sections);
    const numericalInconsistencies = this.detectNumericalInconsistencies(sections);
    
    // Combine drift signals
    const driftScore = (
      (sentimentDrift ? 0.3 : 0) +
      (styleDrift ? 0.3 : 0) +
      (lengthDrift ? 0.2 : 0) +
      (numericalInconsistencies.length > 0 ? 0.2 : 0) +
      (avgSimilarity < 0.5 ? 0.3 : 0)
    );
    
    // Determine stability
    const stable = avgSimilarity > 0.6 && contradictions.length === 0 && driftScore < 0.3;
    const drift = driftScore >= 0.4 || avgSimilarity < 0.4;
    
    // Calculate confidence
    const confidence = this.calculateConfidence(sections.length, contradictions.length);
    
    // Add drift details to contradictions if detected
    if (sentimentDrift) {
      contradictions.push({
        section1: 0,
        section2: sections.length - 1,
        claim1: 'Initial sentiment',
        claim2: 'Final sentiment',
        type: 'sentiment_drift',
        confidence: 0.7
      });
    }
    
    if (styleDrift) {
      contradictions.push({
        section1: 0,
        section2: sections.length - 1,
        claim1: 'Initial style',
        claim2: 'Final style',
        type: 'style_drift',
        confidence: 0.7
      });
    }
    
    for (const numIssue of numericalInconsistencies) {
      contradictions.push(numIssue);
    }
    
    return {
      sections,
      avgSimilarity,
      similarityMatrix: this.config.output.verbose ? matrix : undefined,
      stable,
      drift,
      contradictions,
      confidence,
      limitations: this.LIMITATIONS,
      methodology: this.METHODOLOGY
    };
  }
  
  /**
   * Detect sentiment drift across sections
   */
  private detectSentimentDrift(sections: string[]): boolean {
    if (sections.length < 2) return false;
    
    const sentiments = sections.map(s => this.calculateSentiment(s));
    
    // Check for significant sentiment shift
    const firstHalf = sentiments.slice(0, Math.floor(sentiments.length / 2));
    const secondHalf = sentiments.slice(Math.floor(sentiments.length / 2));
    
    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    // Significant drift if sentiment changes by more than 0.4 on -1 to 1 scale
    return Math.abs(avgFirst - avgSecond) > 0.4;
  }
  
  /**
   * Calculate sentiment score for a section (-1 to 1)
   */
  private calculateSentiment(text: string): number {
    const positiveMatches = (text.match(POSITIVE_SENTIMENT) || []).length;
    const negativeMatches = (text.match(NEGATIVE_SENTIMENT) || []).length;
    const total = positiveMatches + negativeMatches;
    
    if (total === 0) return 0;
    return (positiveMatches - negativeMatches) / total;
  }
  
  /**
   * Detect style drift (formal to informal or vice versa)
   */
  private detectStyleDrift(sections: string[]): boolean {
    if (sections.length < 2) return false;
    
    const styles = sections.map(s => this.calculateStyleScore(s));
    
    // Check for significant style shift
    const firstStyle = styles[0];
    const lastStyle = styles[styles.length - 1];
    
    // Significant drift if style changes from formal to informal or vice versa
    return Math.abs(firstStyle - lastStyle) > 0.5;
  }
  
  /**
   * Calculate style score (-1 = informal, 1 = formal)
   */
  private calculateStyleScore(text: string): number {
    const formalMatches = (text.match(FORMAL_MARKERS) || []).length;
    const informalMatches = (text.match(INFORMAL_MARKERS) || []).length;
    const technicalMatches = (text.match(TECHNICAL_MARKERS) || []).length;
    
    // Technical content tends to be more formal
    const adjustedFormal = formalMatches + (technicalMatches * 0.5);
    const total = adjustedFormal + informalMatches;
    
    if (total === 0) return 0;
    return (adjustedFormal - informalMatches) / total;
  }
  
  /**
   * Detect significant length drift
   */
  private detectLengthDrift(sections: string[]): boolean {
    if (sections.length < 2) return false;
    
    const lengths = sections.map(s => s.length);
    const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    
    // Check if any section is drastically different in length
    for (const len of lengths) {
      const ratio = len / avgLength;
      if (ratio < 0.2 || ratio > 5) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Detect numerical inconsistencies
   */
  private detectNumericalInconsistencies(sections: string[]): Contradiction[] {
    const inconsistencies: Contradiction[] = [];
    const numbersByContext: Map<string, Array<{ value: string; section: number }>> = new Map();
    
    // Extract numbers with their context
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const numbers = section.match(NUMERICAL_PATTERN) || [];
      
      for (const num of numbers) {
        // Get surrounding context (5 words before and after)
        const index = section.indexOf(num);
        const before = section.substring(Math.max(0, index - 50), index);
        const after = section.substring(index + num.length, index + num.length + 50);
        
        // Extract key context words
        const contextWords = (before + ' ' + after)
          .toLowerCase()
          .split(/\s+/)
          .filter(w => w.length > 4)
          .slice(0, 5)
          .join(' ');
        
        if (contextWords.length > 0) {
          if (!numbersByContext.has(contextWords)) {
            numbersByContext.set(contextWords, []);
          }
          numbersByContext.get(contextWords)!.push({ value: num, section: i });
        }
      }
    }
    
    // Check for conflicting numbers in same context
    for (const [context, occurrences] of numbersByContext) {
      if (occurrences.length > 1) {
        const uniqueValues = new Set(occurrences.map(o => o.value));
        if (uniqueValues.size > 1) {
          // Different numbers in same context
          const values = Array.from(uniqueValues);
          inconsistencies.push({
            section1: occurrences[0].section,
            section2: occurrences[occurrences.length - 1].section,
            claim1: `${values[0]} (context: ${context})`,
            claim2: `${values[1]} (context: ${context})`,
            type: 'numerical',
            confidence: 0.6
          });
        }
      }
    }
    
    return inconsistencies;
  }
  
  private createMinimalResult(sections: string[]): ConsistencyResult {
    return {
      sections,
      avgSimilarity: 1,
      stable: true,
      drift: false,
      contradictions: [],
      confidence: {
        value: 0.3,
        interval: [0.1, 0.5],
        method: 'heuristic'
      },
      limitations: [
        ...this.LIMITATIONS,
        'Insufficient text for meaningful consistency analysis'
      ],
      methodology: this.METHODOLOGY
    };
  }
  
  private calculateSimilarityMatrix(sections: string[]): number[][] {
    const n = sections.length;
    const matrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          matrix[i][j] = 1;
        } else if (j > i) {
          const sim = combinedSimilarity(sections[i], sections[j]);
          matrix[i][j] = sim;
          matrix[j][i] = sim;
        }
      }
    }
    
    return matrix;
  }
  
  private calculateAverageSimilarity(matrix: number[][]): number {
    const n = matrix.length;
    if (n < 2) return 1;
    
    let sum = 0;
    let count = 0;
    
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        sum += matrix[i][j];
        count++;
      }
    }
    
    return count > 0 ? sum / count : 1;
  }
  
  private detectContradictions(sections: string[]): Contradiction[] {
    const contradictions: Contradiction[] = [];
    
    const contradictionPatterns = [
      { positive: /\bis\b/i, negative: /\bis not\b|\bisn't\b/i },
      { positive: /\bwill\b/i, negative: /\bwill not\b|\bwon't\b/i },
      { positive: /\btrue\b/i, negative: /\bfalse\b/i },
      { positive: /\balways\b/i, negative: /\bnever\b/i },
      { positive: /\ball\b/i, negative: /\bnone\b|\bno\b/i },
      { positive: /\bincreased?\b/i, negative: /\bdecreased?\b/i },
      { positive: /\bmore\b/i, negative: /\bless\b|\bfewer\b/i }
    ];
    
    for (let i = 0; i < sections.length; i++) {
      for (let j = i + 1; j < sections.length; j++) {
        const section1 = sections[i].toLowerCase();
        const section2 = sections[j].toLowerCase();
        
        for (const pattern of contradictionPatterns) {
          const s1HasPos = pattern.positive.test(section1);
          const s1HasNeg = pattern.negative.test(section1);
          const s2HasPos = pattern.positive.test(section2);
          const s2HasNeg = pattern.negative.test(section2);
          
          if ((s1HasPos && s2HasNeg) || (s1HasNeg && s2HasPos)) {
            // Check for subject overlap
            const words1 = new Set(section1.split(/\s+/).filter(w => w.length > 4));
            const words2 = new Set(section2.split(/\s+/).filter(w => w.length > 4));
            const overlap = [...words1].filter(w => words2.has(w));
            
            if (overlap.length >= 2) {
              contradictions.push({
                section1: i,
                section2: j,
                claim1: this.extractRelevantClaim(sections[i], pattern),
                claim2: this.extractRelevantClaim(sections[j], pattern),
                type: 'logical',
                confidence: 0.6 + (overlap.length * 0.05)
              });
              break;
            }
          }
        }
      }
    }
    
    return contradictions;
  }
  
  private extractRelevantClaim(section: string, _pattern: { positive: RegExp; negative: RegExp }): string {
    // Extract first sentence as representative claim
    const sentences = section.split(/[.!?]/);
    return sentences[0]?.trim().substring(0, 100) || section.substring(0, 100);
  }
  
  private calculateConfidence(sectionCount: number, contradictionCount: number): ConfidenceScore {
    let value = 0.5;
    
    // More sections = higher confidence
    if (sectionCount >= 5) value += 0.2;
    else if (sectionCount >= 3) value += 0.1;
    
    // Clear contradictions = higher confidence in result
    if (contradictionCount > 0) value += 0.1;
    
    const margin = 0.15;
    
    return {
      value: Math.min(0.85, value),
      interval: [Math.max(0, value - margin), Math.min(1, value + margin)],
      method: 'heuristic'
    };
  }
}
