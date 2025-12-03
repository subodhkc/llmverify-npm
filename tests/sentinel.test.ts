/**
 * Sentinel Tests Module Tests
 */

import {
  staticEchoTest,
  duplicateQueryTest,
  structuredListTest,
  shortReasoningTest,
  runAllSentinelTests
} from '../src/sentinel';

// Mock LLM client
const createMockClient = (responses: Record<string, string>) => ({
  generate: jest.fn().mockImplementation(async ({ prompt }: { prompt: string }) => {
    for (const [key, value] of Object.entries(responses)) {
      if (prompt.includes(key)) {
        return { text: value };
      }
    }
    return { text: 'Default response' };
  })
});

describe('Sentinel Tests', () => {
  describe('staticEchoTest', () => {
    it('should pass when LLM echoes correctly', async () => {
      const client = {
        generate: jest.fn().mockResolvedValue({ 
          text: 'The quick brown fox jumps over the lazy dog.' 
        })
      };

      const result = await staticEchoTest({ client, model: 'test' });

      expect(result.test).toBe('staticEchoTest');
      expect(result.passed).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.limitations).toBeDefined();
    });

    it('should detect when response contains the phrase', async () => {
      const client = {
        generate: jest.fn().mockResolvedValue({ 
          text: 'Here is the phrase: The quick brown fox jumps over the lazy dog.' 
        })
      };

      const result = await staticEchoTest({ client, model: 'test' });

      // Contains phrase but similarity may not be > 0.9 due to extra words
      expect(result.details.containsPhrase).toBe(true);
    });

    it('should fail when LLM returns wrong text', async () => {
      const client = {
        generate: jest.fn().mockResolvedValue({ text: 'I cannot repeat that phrase.' })
      };

      const result = await staticEchoTest({ client, model: 'test' });

      expect(result.passed).toBe(false);
      expect(result.message).toContain('did not match');
    });

    it('should handle errors gracefully', async () => {
      const client = {
        generate: jest.fn().mockRejectedValue(new Error('API Error'))
      };

      const result = await staticEchoTest({ client, model: 'test' });

      expect(result.passed).toBe(false);
      expect(result.message).toContain('error');
      expect(result.confidence).toBe(0.5);
    });

    it('should handle non-Error exceptions', async () => {
      const client = {
        generate: jest.fn().mockRejectedValue('String error')
      };

      const result = await staticEchoTest({ client, model: 'test' });

      expect(result.passed).toBe(false);
      expect(result.details.error).toBe('Unknown error');
    });
  });

  describe('duplicateQueryTest', () => {
    it('should pass when responses are consistent and correct', async () => {
      const client = {
        generate: jest.fn().mockResolvedValue({ text: '4' })
      };

      const result = await duplicateQueryTest({ client, model: 'test' });

      expect(result.test).toBe('duplicateQueryTest');
      expect(result.passed).toBe(true);
      expect(result.details.consistencyRatio).toBe(1);
    });

    it('should fail when responses are inconsistent', async () => {
      let callCount = 0;
      const client = {
        generate: jest.fn().mockImplementation(async () => {
          callCount++;
          return { text: callCount === 1 ? '4' : '5' };
        })
      };

      const result = await duplicateQueryTest({ client, model: 'test' });

      expect(result.passed).toBe(false);
      expect(result.message).toContain('Inconsistent');
    });

    it('should fail when responses are wrong', async () => {
      const client = {
        generate: jest.fn().mockResolvedValue({ text: '5' })
      };

      const result = await duplicateQueryTest({ client, model: 'test' });

      expect(result.passed).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      const client = {
        generate: jest.fn().mockRejectedValue(new Error('Network error'))
      };

      const result = await duplicateQueryTest({ client, model: 'test' });

      expect(result.passed).toBe(false);
      expect(result.message).toContain('error');
    });
  });

  describe('structuredListTest', () => {
    it('should pass when LLM returns proper numbered list with colors', async () => {
      const client = {
        generate: jest.fn().mockResolvedValue({ text: '1. Red\n2. Blue\n3. Green' })
      };

      const result = await structuredListTest({ client, model: 'test' });

      expect(result.test).toBe('structuredListTest');
      expect(result.passed).toBe(true);
    });

    it('should pass with bullet points and colors', async () => {
      const client = {
        generate: jest.fn().mockResolvedValue({ text: '- Red\n- Blue\n- Green' })
      };

      const result = await structuredListTest({ client, model: 'test' });

      expect(result.passed).toBe(true);
    });

    it('should fail when no list structure detected', async () => {
      const client = {
        generate: jest.fn().mockResolvedValue({ text: 'I like colors.' })
      };

      const result = await structuredListTest({ client, model: 'test' });

      expect(result.passed).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      const client = {
        generate: jest.fn().mockRejectedValue(new Error('Timeout'))
      };

      const result = await structuredListTest({ client, model: 'test' });

      expect(result.passed).toBe(false);
    });
  });

  describe('shortReasoningTest', () => {
    it('should pass when LLM answers correctly', async () => {
      const client = {
        generate: jest.fn().mockImplementation(async ({ prompt }: { prompt: string }) => {
          if (prompt.includes('Whiskers')) return { text: 'yes' };
          if (prompt.includes('apples')) return { text: '3' };
          if (prompt.includes('larger')) return { text: '100' };
          return { text: 'unknown' };
        })
      };

      const result = await shortReasoningTest({ client, model: 'test' });

      expect(result.test).toBe('shortReasoningTest');
      expect(result.passed).toBe(true);
    });

    it('should fail when LLM answers incorrectly', async () => {
      const client = {
        generate: jest.fn().mockResolvedValue({ text: 'wrong answer' })
      };

      const result = await shortReasoningTest({ client, model: 'test' });

      expect(result.passed).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      const client = {
        generate: jest.fn().mockRejectedValue(new Error('Rate limited'))
      };

      const result = await shortReasoningTest({ client, model: 'test' });

      expect(result.passed).toBe(false);
    });
  });

  describe('runAllSentinelTests', () => {
    it('should run all sentinel tests', async () => {
      const client = {
        generate: jest.fn().mockResolvedValue({ 
          text: 'The quick brown fox jumps over the lazy dog.' 
        })
      };

      const suite = await runAllSentinelTests({ client, model: 'test' });

      expect(suite.results.length).toBe(4);
      expect(suite.results.every((r: any) => 'test' in r && 'passed' in r)).toBe(true);
      expect(suite.totalCount).toBe(4);
      expect(suite.passRate).toBeDefined();
    });

    it('should calculate pass rate correctly', async () => {
      let callCount = 0;
      const client = {
        generate: jest.fn().mockImplementation(async () => {
          callCount++;
          // First test passes, rest fail
          if (callCount <= 2) {
            return { text: 'The quick brown fox jumps over the lazy dog.' };
          }
          return { text: 'Wrong response' };
        })
      };

      const suite = await runAllSentinelTests({ client, model: 'test' });

      expect(suite.passedCount).toBeLessThan(suite.totalCount);
      expect(suite.passRate).toBeLessThan(1);
    });

    it('should skip tests when specified', async () => {
      const client = {
        generate: jest.fn().mockResolvedValue({ text: 'Test' })
      };

      const suite = await runAllSentinelTests(
        { client, model: 'test' },
        { skipTests: ['staticEchoTest', 'duplicateQueryTest'] }
      );

      expect(suite.totalCount).toBe(2);
    });

    it('should call onTestComplete callback', async () => {
      const client = {
        generate: jest.fn().mockResolvedValue({ text: 'Test' })
      };
      const onTestComplete = jest.fn();

      await runAllSentinelTests(
        { client, model: 'test' },
        { onTestComplete }
      );

      expect(onTestComplete).toHaveBeenCalledTimes(4);
    });

    it('should handle test errors gracefully', async () => {
      const client = {
        generate: jest.fn().mockRejectedValue(new Error('API Error'))
      };

      const suite = await runAllSentinelTests({ client, model: 'test' });

      expect(suite.results.every((r: any) => r.passed === false)).toBe(true);
      expect(suite.passed).toBe(false);
    });

    it('should include timing information', async () => {
      const client = {
        generate: jest.fn().mockResolvedValue({ text: 'Test' })
      };

      const suite = await runAllSentinelTests({ client, model: 'test' });

      expect(suite.timestamp).toBeDefined();
      expect(suite.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should generate summary message', async () => {
      const client = {
        generate: jest.fn().mockResolvedValue({ 
          text: 'The quick brown fox jumps over the lazy dog.' 
        })
      };

      const suite = await runAllSentinelTests({ client, model: 'test' });

      expect(suite.summary).toBeDefined();
      expect(typeof suite.summary).toBe('string');
    });
  });
});
