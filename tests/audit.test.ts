/**
 * Audit Logger Tests
 */

import { AuditLogger, AuditEntry } from '../src/audit';

describe('AuditLogger', () => {
  let logger: AuditLogger;

  beforeEach(() => {
    logger = new AuditLogger({ enabled: true });
  });

  describe('log()', () => {
    it('should log entries when enabled', () => {
      const entry = logger.log({
        action: 'verify',
        input: {
          contentLength: 100,
          contentHash: 'abc123'
        },
        output: {
          riskLevel: 'low',
          riskScore: 0.1,
          action: 'allow',
          findingsCount: 0
        },
        performance: {
          latencyMs: 15,
          enginesUsed: ['hallucination', 'consistency']
        }
      });

      expect(entry.id).toBeDefined();
      expect(entry.timestamp).toBeDefined();
      expect(entry.action).toBe('verify');
    });

    it('should not log when disabled', () => {
      const disabledLogger = new AuditLogger({ enabled: false });
      
      const entry = disabledLogger.log({
        action: 'verify',
        input: { contentLength: 100, contentHash: '' },
        output: { riskLevel: 'low', riskScore: 0, action: 'allow', findingsCount: 0 },
        performance: { latencyMs: 10, enginesUsed: [] }
      });

      expect(entry.id).toBe('');
    });
  });

  describe('createEntry()', () => {
    it('should create entry from verification result', () => {
      const entry = logger.createEntry(
        'verify',
        'Test content here',
        {
          risk: { level: 'low', overall: 0.1, action: 'allow' },
          findings: [],
          meta: { latency_ms: 20, enginesUsed: ['hallucination'] }
        },
        'dev'
      );

      expect(entry.action).toBe('verify');
      expect(entry.input.contentLength).toBe(17);
      expect(entry.input.preset).toBe('dev');
      expect(entry.output.riskLevel).toBe('low');
      expect(entry.performance.latencyMs).toBe(20);
    });
  });

  describe('getRecent()', () => {
    it('should return recent entries', () => {
      // Log multiple entries
      for (let i = 0; i < 5; i++) {
        logger.log({
          action: 'verify',
          input: { contentLength: i * 10, contentHash: `hash${i}` },
          output: { riskLevel: 'low', riskScore: 0, action: 'allow', findingsCount: 0 },
          performance: { latencyMs: i, enginesUsed: [] }
        });
      }

      const recent = logger.getRecent(3);
      expect(recent.length).toBe(3);
    });
  });

  describe('getByRiskLevel()', () => {
    it('should filter by risk level', () => {
      logger.log({
        action: 'verify',
        input: { contentLength: 100, contentHash: '' },
        output: { riskLevel: 'low', riskScore: 0.1, action: 'allow', findingsCount: 0 },
        performance: { latencyMs: 10, enginesUsed: [] }
      });

      logger.log({
        action: 'verify',
        input: { contentLength: 100, contentHash: '' },
        output: { riskLevel: 'high', riskScore: 0.8, action: 'block', findingsCount: 3 },
        performance: { latencyMs: 15, enginesUsed: [] }
      });

      const highRisk = logger.getByRiskLevel('high');
      expect(highRisk.length).toBe(1);
      expect(highRisk[0].output.riskScore).toBe(0.8);
    });
  });

  describe('getSummary()', () => {
    it('should return summary statistics', () => {
      logger.log({
        action: 'verify',
        input: { contentLength: 100, contentHash: '' },
        output: { riskLevel: 'low', riskScore: 0.1, action: 'allow', findingsCount: 0 },
        performance: { latencyMs: 10, enginesUsed: [] }
      });

      logger.log({
        action: 'run',
        input: { contentLength: 200, contentHash: '' },
        output: { riskLevel: 'high', riskScore: 0.8, action: 'block', findingsCount: 2 },
        performance: { latencyMs: 20, enginesUsed: [] }
      });

      const summary = logger.getSummary();

      expect(summary.totalEntries).toBe(2);
      expect(summary.byRiskLevel['low']).toBe(1);
      expect(summary.byRiskLevel['high']).toBe(1);
      expect(summary.byAction['verify']).toBe(1);
      expect(summary.byAction['run']).toBe(1);
      expect(summary.blockedCount).toBe(1);
      expect(summary.avgLatencyMs).toBe(15);
    });
  });

  describe('clear()', () => {
    it('should clear all entries', () => {
      logger.log({
        action: 'verify',
        input: { contentLength: 100, contentHash: '' },
        output: { riskLevel: 'low', riskScore: 0, action: 'allow', findingsCount: 0 },
        performance: { latencyMs: 10, enginesUsed: [] }
      });

      expect(logger.getRecent().length).toBe(1);

      logger.clear();

      expect(logger.getRecent().length).toBe(0);
    });
  });

  describe('setEnabled()', () => {
    it('should enable/disable logging', () => {
      logger.setEnabled(false);

      const entry = logger.log({
        action: 'verify',
        input: { contentLength: 100, contentHash: '' },
        output: { riskLevel: 'low', riskScore: 0, action: 'allow', findingsCount: 0 },
        performance: { latencyMs: 10, enginesUsed: [] }
      });

      expect(entry.id).toBe('');

      logger.setEnabled(true);

      const entry2 = logger.log({
        action: 'verify',
        input: { contentLength: 100, contentHash: '' },
        output: { riskLevel: 'low', riskScore: 0, action: 'allow', findingsCount: 0 },
        performance: { latencyMs: 10, enginesUsed: [] }
      });

      expect(entry2.id).not.toBe('');
    });
  });
});
