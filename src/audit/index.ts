/**
 * Audit Logger (v1 API)
 *
 * Local-only audit logging for verification results.
 * Supports file output and optional GitHub export.
 * No external API calls - all processing is local.
 *
 * Note: src/logging/audit.ts provides the newer AuditLogger used by
 * verify(). This module is retained for backward compatibility and now
 * shares the same integrity primitives (canonical digests, explicit
 * hash algorithms, persistence receipts) via src/audit/integrity.ts.
 *
 * @module audit
 * @author llmverify
 * @license MIT
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  AuditWriteResult,
  ContentHashAlgorithm,
  hashContent,
  persistenceResult
} from './integrity';

export type { AuditWriteResult, AuditPersistenceStatus } from './integrity';

export interface AuditEntry {
  id: string;
  timestamp: string;
  action: 'verify' | 'classify' | 'check_pii' | 'check_injection' | 'run';
  input: {
    contentLength: number;
    /**
     * Self-describing hash. v1.7+ emits 'sha256:<hex>' (or
     * 'hmac-sha256:<hex>' when hashKey is configured, 'legacy:<hex>'
     * under hashAlgorithm 'legacy'). Pre-1.7 records contain an
     * unlabelled 8-char non-cryptographic hash.
     */
    contentHash: string;
    /** Algorithm used for contentHash (v1.7+ records) */
    contentHashAlgorithm?: ContentHashAlgorithm | 'none';
    preset?: string;
  };
  output: {
    riskLevel: string;
    riskScore: number;
    action: string;
    findingsCount: number;
  };
  performance: {
    latencyMs: number;
    enginesUsed: string[];
  };
  metadata?: Record<string, unknown>;
}

export interface AuditConfig {
  enabled: boolean;
  outputPath?: string;
  maxEntries?: number;
  rotateDaily?: boolean;
  /**
   * Record a content hash. Default true.
   * WARNING: unkeyed hashes of low-entropy content can be reversed by
   * guessing. Set false or use hashKey for sensitive workloads.
   */
  includeContentHash?: boolean;
  /**
   * Hash algorithm for contentHash.
   *   'sha256'      — default, integrity-grade
   *   'hmac-sha256' — keyed (requires hashKey); preferred for
   *                   low-entropy/sensitive content
   *   'legacy'      — deprecated non-cryptographic hash, retained only
   *                   to reproduce pre-1.7 records
   */
  hashAlgorithm?: ContentHashAlgorithm;
  /** Key for 'hmac-sha256' content hashing */
  hashKey?: string;
  /**
   * Evidence-required mode: when true, a failed audit write throws
   * AuditPersistenceError instead of recording status FAILED.
   * Default false (developer mode).
   */
  requirePersistence?: boolean;
  /** Observer invoked with each write outcome */
  onWriteResult?: (result: AuditWriteResult) => void;
}

const DEFAULT_CONFIG: AuditConfig = {
  enabled: false,
  outputPath: './llmverify-audit.jsonl',
  maxEntries: 10000,
  rotateDaily: true,
  includeContentHash: true,
  hashAlgorithm: 'sha256'
};

/**
 * Generate unique ID
 */
function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}`;
}

/**
 * Audit Logger class
 */
export class AuditLogger {
  private config: AuditConfig;
  private entries: AuditEntry[] = [];
  private currentDate: string = '';
  private lastPersistence: AuditWriteResult = persistenceResult('NOT_ATTEMPTED');

  constructor(config: Partial<AuditConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.currentDate = new Date().toISOString().split('T')[0];
  }

  /**
   * Log a verification action.
   *
   * Returns the stored entry. The actual persistence outcome is
   * available via getLastPersistence() or the logDetailed() form —
   * a returned entry does NOT by itself prove the record was written
   * to disk.
   */
  log(entry: Omit<AuditEntry, 'id' | 'timestamp'>): AuditEntry {
    return this.logDetailed(entry).entry;
  }

  /**
   * Log an entry and receive both the entry and its persistence receipt.
   */
  logDetailed(entry: Omit<AuditEntry, 'id' | 'timestamp'>): { entry: AuditEntry; persistence: AuditWriteResult } {
    if (!this.config.enabled) {
      this.lastPersistence = this.report(persistenceResult('DISABLED'));
      return { entry: { ...entry, id: '', timestamp: '' }, persistence: this.lastPersistence };
    }

    const fullEntry: AuditEntry = {
      ...entry,
      id: generateId(),
      timestamp: new Date().toISOString()
    };

    this.entries.push(fullEntry);

    // Write to file if configured
    if (this.config.outputPath) {
      this.lastPersistence = this.writeToFile(fullEntry);
    } else {
      this.lastPersistence = persistenceResult('NOT_ATTEMPTED');
    }
    this.report(this.lastPersistence);

    // Rotate if needed
    if (this.entries.length > (this.config.maxEntries || 10000)) {
      this.entries = this.entries.slice(-1000);
    }

    return { entry: fullEntry, persistence: this.lastPersistence };
  }

  /**
   * Outcome of the most recent write attempt by this logger.
   */
  getLastPersistence(): AuditWriteResult {
    return this.lastPersistence;
  }

  /**
   * Compute the content hash for an entry input according to config.
   */
  private computeContentHash(content: string): { hash: string; algorithm: ContentHashAlgorithm | 'none' } {
    if (!this.config.includeContentHash) {
      return { hash: '', algorithm: 'none' };
    }
    const algorithm = this.config.hashAlgorithm || 'sha256';
    return {
      hash: hashContent(content, { algorithm, key: this.config.hashKey }),
      algorithm
    };
  }

  /**
   * Create audit entry from verification result
   */
  createEntry(
    action: AuditEntry['action'],
    content: string,
    result: {
      risk?: { level: string; overall: number; action: string };
      findings?: unknown[];
      meta?: { latency_ms?: number; enginesUsed?: string[] };
    },
    preset?: string
  ): Omit<AuditEntry, 'id' | 'timestamp'> {
    const { hash, algorithm } = this.computeContentHash(content);
    return {
      action,
      input: {
        contentLength: content.length,
        contentHash: hash,
        contentHashAlgorithm: algorithm,
        preset
      },
      output: {
        riskLevel: result.risk?.level || 'unknown',
        riskScore: result.risk?.overall || 0,
        action: result.risk?.action || 'unknown',
        findingsCount: result.findings?.length || 0
      },
      performance: {
        latencyMs: result.meta?.latency_ms || 0,
        enginesUsed: result.meta?.enginesUsed || []
      }
    };
  }

  /**
   * Report a persistence outcome; escalate to a typed error when the
   * caller required durable persistence.
   */
  private report(result: AuditWriteResult): AuditWriteResult {
    try {
      this.config.onWriteResult?.(result);
    } catch {
      // Observer failures must not break verification
    }
    // Evidence-required mode: only PERSISTED is acceptable. DISABLED and
    // NOT_ATTEMPTED mean no record was stored — escalate them too.
    if (this.config.requirePersistence && result.status !== 'PERSISTED') {
      const { AuditPersistenceError } = require('../errors');
      const reason = result.status === 'DISABLED'
        ? 'audit logging is disabled'
        : result.status === 'NOT_ATTEMPTED'
          ? 'no audit target was configured'
          : result.error || 'unknown error';
      throw new AuditPersistenceError(
        `Audit persistence required but status was ${result.status}: ${reason}`,
        { status: result.status, filePath: result.filePath }
      );
    }
    return result;
  }

  /**
   * Write entry to file (JSONL format). Returns the actual outcome.
   */
  private writeToFile(entry: AuditEntry): AuditWriteResult {
    if (!this.config.outputPath) return persistenceResult('NOT_ATTEMPTED');

    try {
      // Check for daily rotation
      const today = new Date().toISOString().split('T')[0];
      let filePath = this.config.outputPath;

      if (this.config.rotateDaily && today !== this.currentDate) {
        this.currentDate = today;
        const ext = path.extname(filePath);
        const base = filePath.slice(0, -ext.length);
        filePath = `${base}-${today}${ext}`;
      }

      // Append to file
      const line = JSON.stringify(entry) + '\n';
      fs.appendFileSync(filePath, line, 'utf-8');
      return persistenceResult('PERSISTED', { filePath });
    } catch (error) {
      // Audit must not break main functionality unless the caller
      // explicitly required persistence (handled by report()).
      if (process.env.NODE_ENV === 'development') {
        console.error('[llmverify audit] Failed to write:', error);
      }
      return persistenceResult('FAILED', {
        error: (error as Error).message
      });
    }
  }

  /**
   * Get recent entries
   */
  getRecent(count: number = 100): AuditEntry[] {
    return this.entries.slice(-count);
  }

  /**
   * Get entries by risk level
   */
  getByRiskLevel(level: string): AuditEntry[] {
    return this.entries.filter(e => e.output.riskLevel === level);
  }

  /**
   * Get summary statistics
   */
  getSummary(): {
    totalEntries: number;
    byRiskLevel: Record<string, number>;
    byAction: Record<string, number>;
    avgLatencyMs: number;
    blockedCount: number;
  } {
    const byRiskLevel: Record<string, number> = {};
    const byAction: Record<string, number> = {};
    let totalLatency = 0;
    let blockedCount = 0;

    for (const entry of this.entries) {
      byRiskLevel[entry.output.riskLevel] = (byRiskLevel[entry.output.riskLevel] || 0) + 1;
      byAction[entry.action] = (byAction[entry.action] || 0) + 1;
      totalLatency += entry.performance.latencyMs;
      if (entry.output.action === 'block') {
        blockedCount++;
      }
    }

    return {
      totalEntries: this.entries.length,
      byRiskLevel,
      byAction,
      avgLatencyMs: this.entries.length > 0 ? totalLatency / this.entries.length : 0,
      blockedCount
    };
  }

  /**
   * Export to JSON file
   */
  exportToFile(filePath: string): void {
    const data = {
      exportedAt: new Date().toISOString(),
      summary: this.getSummary(),
      entries: this.entries
    };
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * Export for GitHub (creates markdown report)
   */
  exportForGitHub(filePath: string): void {
    const summary = this.getSummary();
    const recent = this.getRecent(10);

    let markdown = `# llmverify Audit Report\n\n`;
    markdown += `Generated: ${new Date().toISOString()}\n\n`;
    markdown += `## Summary\n\n`;
    markdown += `| Metric | Value |\n`;
    markdown += `|--------|-------|\n`;
    markdown += `| Total Verifications | ${summary.totalEntries} |\n`;
    markdown += `| Blocked | ${summary.blockedCount} |\n`;
    markdown += `| Avg Latency | ${summary.avgLatencyMs.toFixed(2)}ms |\n\n`;

    markdown += `## Risk Distribution\n\n`;
    markdown += `| Level | Count |\n`;
    markdown += `|-------|-------|\n`;
    for (const [level, count] of Object.entries(summary.byRiskLevel)) {
      markdown += `| ${level} | ${count} |\n`;
    }
    markdown += `\n`;

    markdown += `## Recent Entries\n\n`;
    markdown += `| Time | Action | Risk | Latency |\n`;
    markdown += `|------|--------|------|--------|\n`;
    for (const entry of recent) {
      const time = entry.timestamp.split('T')[1].split('.')[0];
      markdown += `| ${time} | ${entry.action} | ${entry.output.riskLevel} | ${entry.performance.latencyMs}ms |\n`;
    }

    fs.writeFileSync(filePath, markdown, 'utf-8');
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.entries = [];
  }

  /**
   * Enable/disable logging
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }
}

// Singleton instance
let defaultLogger: AuditLogger | null = null;

/**
 * Get or create default audit logger
 */
export function getAuditLogger(config?: Partial<AuditConfig>): AuditLogger {
  if (!defaultLogger || config) {
    defaultLogger = new AuditLogger(config);
  }
  return defaultLogger;
}

/**
 * Quick log function
 */
export function auditLog(
  action: AuditEntry['action'],
  content: string,
  result: {
    risk?: { level: string; overall: number; action: string };
    findings?: unknown[];
    meta?: { latency_ms?: number; enginesUsed?: string[] };
  },
  preset?: string
): AuditEntry | null {
  const logger = getAuditLogger();
  if (!logger) return null;

  const entry = logger.createEntry(action, content, result, preset);
  return logger.log(entry);
}

export default AuditLogger;
