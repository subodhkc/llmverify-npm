/**
 * Risk Analyzer Tests
 */

import { analyzeRiskIndicators, checkContradictions } from '../src/engines/hallucination/risk-analyzer';
import { Claim, ConfidenceScore } from '../src/types/results';

describe('Risk Analyzer', () => {
  const defaultConfidence: ConfidenceScore = {
    value: 0.8,
    interval: [0.7, 0.9],
    method: 'heuristic'
  };

  const createClaim = (text: string, overrides?: Partial<Claim>): Claim => ({
    text,
    span: [0, text.length],
    type: 'factual',
    verifiable: true,
    confidence: defaultConfidence,
    riskIndicators: {
      lackOfSpecificity: 0,
      missingCitation: false,
      vagueLanguage: false,
      contradictionSignal: false
    },
    limitations: [],
    ...overrides
  });

  describe('analyzeRiskIndicators', () => {
    it('should analyze claim and add risk indicators', () => {
      const claim = createClaim('The sky is blue.');
      const result = analyzeRiskIndicators(claim, {} as any);
      
      // Should preserve original properties
      expect(result.text).toBe(claim.text);
      expect(result.span).toEqual(claim.span);
      expect(result.type).toBe(claim.type);
      
      // Should have risk indicators
      expect(result.riskIndicators).toBeDefined();
    });

    it('should preserve existing risk indicators', () => {
      const claim = createClaim('This is definitely true.', {
        riskIndicators: {
          lackOfSpecificity: 0.5,
          missingCitation: true,
          vagueLanguage: false,
          contradictionSignal: false
        }
      });
      
      const result = analyzeRiskIndicators(claim, {} as any);
      
      expect(result.riskIndicators.missingCitation).toBe(true);
    });

    it('should detect overconfident language', () => {
      const claim = createClaim('This is absolutely certain and definitely true.');
      const result = analyzeRiskIndicators(claim, {} as any);
      
      // Should detect overconfidence
      expect((result.riskIndicators as any).overconfidenceRisk).toBeGreaterThan(0);
    });

    it('should detect fabricated statistics', () => {
      const claim = createClaim('Exactly 73.47% of users reported a 94.2% improvement.');
      const result = analyzeRiskIndicators(claim, {} as any);
      
      // Should detect fabricated stats
      expect((result.riskIndicators as any).fabricatedStatRisk).toBeGreaterThan(0);
    });

    it('should detect fake authority appeals', () => {
      const claim = createClaim('Studies show that experts agree this is proven.');
      const result = analyzeRiskIndicators(claim, {} as any);
      
      // Should detect fake authority
      expect((result.riskIndicators as any).fakeAuthorityRisk).toBeGreaterThan(0);
    });
  });

  describe('checkContradictions', () => {
    it('should return empty array for empty input', () => {
      const result = checkContradictions([]);
      expect(result).toHaveLength(0);
    });

    it('should return single claim unchanged', () => {
      const claims = [createClaim('The weather is nice.')];
      const result = checkContradictions(claims);
      
      expect(result).toHaveLength(1);
      expect(result[0].riskIndicators.contradictionSignal).toBe(false);
    });

    it('should detect is/is not contradiction', () => {
      const claims = [
        createClaim('The product is available for purchase today.'),
        createClaim('The product is not available for purchase today.')
      ];
      
      const result = checkContradictions(claims);
      
      expect(result[0].riskIndicators.contradictionSignal).toBe(true);
      expect(result[1].riskIndicators.contradictionSignal).toBe(true);
    });

    it('should detect will/will not contradiction', () => {
      const claims = [
        createClaim('The company will release the update tomorrow.'),
        createClaim('The company will not release the update tomorrow.')
      ];
      
      const result = checkContradictions(claims);
      
      expect(result[0].riskIndicators.contradictionSignal).toBe(true);
      expect(result[1].riskIndicators.contradictionSignal).toBe(true);
    });

    it('should detect can/cannot contradiction', () => {
      const claims = [
        createClaim('Users can access the premium features.'),
        createClaim('Users cannot access the premium features.')
      ];
      
      const result = checkContradictions(claims);
      
      expect(result[0].riskIndicators.contradictionSignal).toBe(true);
    });

    it('should detect true/false contradiction', () => {
      const claims = [
        createClaim('The statement about climate change is true.'),
        createClaim('The statement about climate change is false.')
      ];
      
      const result = checkContradictions(claims);
      
      expect(result[0].riskIndicators.contradictionSignal).toBe(true);
    });

    it('should detect always/never contradiction', () => {
      const claims = [
        createClaim('The system always performs backup operations.'),
        createClaim('The system never performs backup operations.')
      ];
      
      const result = checkContradictions(claims);
      
      expect(result[0].riskIndicators.contradictionSignal).toBe(true);
    });

    it('should detect all/none contradiction', () => {
      const claims = [
        createClaim('All employees received the training materials.'),
        createClaim('None of the employees received the training materials.')
      ];
      
      const result = checkContradictions(claims);
      
      expect(result[0].riskIndicators.contradictionSignal).toBe(true);
    });

    it('should not flag unrelated claims as contradictions', () => {
      const claims = [
        createClaim('The weather is sunny today.'),
        createClaim('The stock market closed higher.')
      ];
      
      const result = checkContradictions(claims);
      
      expect(result[0].riskIndicators.contradictionSignal).toBe(false);
      expect(result[1].riskIndicators.contradictionSignal).toBe(false);
    });

    it('should not flag claims without sufficient overlap', () => {
      const claims = [
        createClaim('The car is fast.'),
        createClaim('The boat is not slow.')
      ];
      
      const result = checkContradictions(claims);
      
      expect(result[0].riskIndicators.contradictionSignal).toBe(false);
    });

    it('should handle multiple claims with some contradictions', () => {
      const claims = [
        createClaim('The service is available worldwide.'),
        createClaim('The price is reasonable.'),
        createClaim('The service is not available worldwide.')
      ];
      
      const result = checkContradictions(claims);
      
      expect(result[0].riskIndicators.contradictionSignal).toBe(true);
      expect(result[1].riskIndicators.contradictionSignal).toBe(false);
      expect(result[2].riskIndicators.contradictionSignal).toBe(true);
    });

    it('should preserve other claim properties', () => {
      const confidence1: ConfidenceScore = { value: 0.9, interval: [0.8, 1], method: 'heuristic' };
      const confidence2: ConfidenceScore = { value: 0.8, interval: [0.7, 0.9], method: 'heuristic' };
      
      const claims = [
        createClaim('The feature is enabled.', { type: 'factual', confidence: confidence1 }),
        createClaim('The feature is not enabled.', { type: 'factual', confidence: confidence2 })
      ];
      
      const result = checkContradictions(claims);
      
      expect(result[0].type).toBe('factual');
      expect(result[0].confidence.value).toBe(0.9);
      expect(result[1].confidence.value).toBe(0.8);
    });
  });
});
