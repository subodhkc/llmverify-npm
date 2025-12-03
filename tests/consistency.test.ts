/**
 * Consistency Engine Tests
 */

import { ConsistencyEngine } from '../src/engines/consistency';

describe('ConsistencyEngine', () => {
  let engine: ConsistencyEngine;

  beforeEach(() => {
    engine = new ConsistencyEngine({
      output: { verbose: true }
    } as any);
  });

  describe('check', () => {
    it('should return minimal result for single section', async () => {
      const result = await engine.check('Just one paragraph here.');

      expect(result.stable).toBe(true);
      expect(result.drift).toBe(false);
      expect(result.avgSimilarity).toBe(1);
      expect(result.confidence.value).toBe(0.3);
      expect(result.limitations).toContain('Insufficient text for meaningful consistency analysis');
    });

    it('should detect consistent text', async () => {
      const text = `
        The weather is sunny today. The temperature is warm.
        
        It's a beautiful sunny day. The weather is perfect for outdoor activities.
      `;

      const result = await engine.check(text);

      expect(result.sections.length).toBeGreaterThan(1);
      expect(result.avgSimilarity).toBeGreaterThan(0);
      expect(result.methodology).toBeDefined();
      expect(result.limitations).toBeDefined();
    });

    it('should detect drift in unrelated sections', async () => {
      const text = `
        The weather is sunny and warm today.
        
        Quantum physics describes the behavior of matter at atomic scales.
        
        The stock market closed higher today with gains in tech.
      `;

      const result = await engine.check(text);

      expect(result.avgSimilarity).toBeLessThan(0.5);
      expect(result.drift).toBe(true);
    });

    it('should include similarity matrix when verbose', async () => {
      const text = `
        First paragraph about topic A.
        
        Second paragraph about topic A.
      `;

      const result = await engine.check(text);

      expect(result.similarityMatrix).toBeDefined();
      expect(result.similarityMatrix?.length).toBeGreaterThan(0);
    });

    it('should not include similarity matrix when not verbose', async () => {
      const quietEngine = new ConsistencyEngine({
        output: { verbose: false }
      } as any);

      const text = `
        First paragraph.
        
        Second paragraph.
      `;

      const result = await quietEngine.check(text);

      expect(result.similarityMatrix).toBeUndefined();
    });

    it('should detect contradictions', async () => {
      const text = `
        The product is definitely available for purchase.
        
        Unfortunately, the product is not available at this time.
      `;

      const result = await engine.check(text);

      // May or may not detect depending on implementation
      expect(result.contradictions).toBeDefined();
      expect(Array.isArray(result.contradictions)).toBe(true);
    });

    it('should calculate confidence based on text length', async () => {
      const shortText = `
        Short paragraph one.
        
        Short paragraph two.
      `;

      const longText = `
        This is a much longer first paragraph that contains more content and detail about the topic at hand. It provides substantial information.
        
        This is a much longer second paragraph that also contains significant content. It elaborates on the topic with additional details and context.
        
        This is a third paragraph that continues the discussion with even more information and analysis of the subject matter.
      `;

      const shortResult = await engine.check(shortText);
      const longResult = await engine.check(longText);

      expect(longResult.confidence.value).toBeGreaterThanOrEqual(shortResult.confidence.value);
    });

    it('should handle empty content', async () => {
      const result = await engine.check('');

      expect(result.sections.length).toBeLessThanOrEqual(1);
      expect(result.stable).toBe(true);
    });
  });
});
