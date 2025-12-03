/**
 * Similarity Utilities Tests
 */

import {
  jaccardSimilarity,
  cosineSimilarity,
  levenshteinDistance,
  levenshteinSimilarity,
  combinedSimilarity
} from '../src/utils/similarity';

describe('Similarity Utilities', () => {
  describe('jaccardSimilarity', () => {
    it('should return 1 for identical texts', () => {
      const text = 'hello world';
      expect(jaccardSimilarity(text, text)).toBe(1);
    });

    it('should return 0 for completely different texts', () => {
      const result = jaccardSimilarity('hello world', 'foo bar baz');
      expect(result).toBe(0);
    });

    it('should return partial similarity for overlapping texts', () => {
      const result = jaccardSimilarity('hello world', 'hello there');
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(1);
    });

    it('should be case insensitive', () => {
      const result = jaccardSimilarity('Hello World', 'hello world');
      expect(result).toBe(1);
    });

    it('should handle empty strings', () => {
      const result = jaccardSimilarity('', '');
      expect(result).toBe(1);
    });
  });

  describe('cosineSimilarity', () => {
    it('should return 1 for identical texts', () => {
      const text = 'hello world hello';
      expect(cosineSimilarity(text, text)).toBeCloseTo(1, 10);
    });

    it('should return 0 for completely different texts', () => {
      const result = cosineSimilarity('hello world', 'foo bar baz');
      expect(result).toBe(0);
    });

    it('should handle word frequency', () => {
      const text1 = 'hello hello hello';
      const text2 = 'hello world world';
      const result = cosineSimilarity(text1, text2);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(1);
    });

    it('should handle empty strings', () => {
      const result = cosineSimilarity('', '');
      expect(result).toBe(0);
    });

    it('should handle one empty string', () => {
      const result = cosineSimilarity('hello', '');
      expect(result).toBe(0);
    });
  });

  describe('levenshteinDistance', () => {
    it('should return 0 for identical strings', () => {
      expect(levenshteinDistance('hello', 'hello')).toBe(0);
    });

    it('should return correct distance for single character difference', () => {
      expect(levenshteinDistance('hello', 'hallo')).toBe(1);
    });

    it('should return string length for completely different strings', () => {
      expect(levenshteinDistance('abc', 'xyz')).toBe(3);
    });

    it('should handle insertions', () => {
      expect(levenshteinDistance('hello', 'helloo')).toBe(1);
    });

    it('should handle deletions', () => {
      expect(levenshteinDistance('hello', 'helo')).toBe(1);
    });

    it('should handle empty strings', () => {
      expect(levenshteinDistance('', 'hello')).toBe(5);
      expect(levenshteinDistance('hello', '')).toBe(5);
      expect(levenshteinDistance('', '')).toBe(0);
    });
  });

  describe('levenshteinSimilarity', () => {
    it('should return 1 for identical strings', () => {
      expect(levenshteinSimilarity('hello', 'hello')).toBe(1);
    });

    it('should return value between 0 and 1', () => {
      const result = levenshteinSimilarity('hello', 'hallo');
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(1);
    });

    it('should return 0 for completely different strings of same length', () => {
      const result = levenshteinSimilarity('abc', 'xyz');
      expect(result).toBe(0);
    });

    it('should handle empty strings', () => {
      expect(levenshteinSimilarity('', '')).toBe(1);
    });
  });

  describe('combinedSimilarity', () => {
    it('should return 1 for identical texts', () => {
      const text = 'hello world';
      expect(combinedSimilarity(text, text)).toBeCloseTo(1, 10);
    });

    it('should return value between 0 and 1 for different texts', () => {
      const result = combinedSimilarity('hello world', 'hello there');
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(1);
    });

    it('should combine jaccard and cosine similarity', () => {
      const text1 = 'the quick brown fox';
      const text2 = 'the slow brown dog';
      
      const jaccard = jaccardSimilarity(text1, text2);
      const cosine = cosineSimilarity(text1, text2);
      const combined = combinedSimilarity(text1, text2);
      
      // Combined should be weighted average
      const expected = jaccard * 0.4 + cosine * 0.6;
      expect(combined).toBeCloseTo(expected, 5);
    });
  });
});
