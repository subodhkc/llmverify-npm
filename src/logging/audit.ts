/**
 * Audit Trail System
 *
 * Integrity-verifiable audit logging for verification operations.
 * Local-only: records are appended to JSONL files under the audit
 * directory (~/.llmverify/audit by default; configurable via the
 * auditDir option or the LLMVERIFY_AUDIT_DIR / LLMVERIFY_HOME
 * environment variables).
 *
 * Semantics:
 * - Every write returns an AuditWriteResult describing what ACTUALLY
 *   happened (PERSISTED | DISABLED | FAILED | NOT_ATTEMPTED).
 * - Stored entries carry an integrity block (sha256 digest over the
 *   canonical entry) that detects post-write tampering. A digest is
 *   evidence of integrity, NOT producer authenticity — it is not a
 *   digital signature.
 * - Raw prompts, responses, secrets, and PII are never written.
 *   Content is represented only as a length plus a hash (which can be
 *   disabled or keyed — see includeContentHash / hashKey).
 *
 * @module logging/audit
 */

import * as fs from 'fs';
import * as path from 'path';
import { getAuditDir } from '../paths';
import {
  AuditEntryIntegrity,
  AuditWriteResult,
  canonicalize,
  digestAuditEntry,
  hashContent,
  persistenceResult,
  verifyAuditEntry
} from '../audit/integrity';
import { AuditPersistenceError } from '../errors';

/**
 * Audit entry structure
 */
export interface AuditEntry {
  timestamp: string;
  requestId: string;
  operation: 'verify' | 'classify' | 'check-input' | 'check-pii' | 'plugin-execute';
  input: {
    contentLength: number;
    /** Self-describing hash: 'sha256:<hex>', 'hmac-sha256:<hex>', or '' when disabled */
    contentHash: string;
    /** Algorithm used for contentHash (absent in pre-1.7 records = truncated sha256) */
    contentHashAlgorithm?: 'sha256' | 'hmac-sha256' | 'none';
    hasPrompt: boolean;
  };
  output: {
    riskLevel: string;
    findingsCount: number;
    blocked: boolean;
  };
  metadata: {
    version: string;
    duration: number;
    enginesUsed: string[];
    configTier: string;
  };
  user?: {
    id?: string;
    ip?: string;
  };
  /** Integrity block added at write time (v1.7+ records) */
  integrity?: AuditEntryIntegrity;
}

/**
 * Audit configuration
 */
export interface AuditConfig {
  enabled: boolean;
  auditDir?: string;
  /**
   * Record an unkeyed SHA-256 content hash. Default true.
   * WARNING: for low-entropy content an unkeyed hash can be reversed by
   * guessing. Set false, or provide hashKey for a keyed HMAC instead.
   */
  includeContentHash?: boolean;
  /**
   * Optional key for keyed content hashing (HMAC-SHA256). Prefer this
   * over unkeyed hashes when audited content may be low-entropy or
   * sensitive.
   */
  hashKey?: string;
  includeUserInfo?: boolean;
  maxFileSize?: number;
  maxFiles?: number;
  /**
   * Evidence-required mode: when true, a failed audit write throws
   * AuditPersistenceError instead of returning status FAILED.
   * Default false (developer mode — failure is reported, not thrown).
   */
  requirePersistence?: boolean;
  /**
   * Optional observer invoked with the AuditWriteResult of every
   * attempted log call.
   */
  onWriteResult?: (result: AuditWriteResult) => void;
}

/**
 * Default audit configuration
 */
const DEFAULT_AUDIT_CONFIG: AuditConfig = {
  enabled: true,
  auditDir: undefined, // resolved lazily via getAuditDir()
  includeContentHash: true,
  includeUserInfo: false,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 50 // Keep more audit files
};

/**
 * Environment-driven audit configuration. Explicit constructor config
 * always wins over environment values.
 *
 *   LLMVERIFY_AUDIT=off|0|false        → disable audit logging
 *   LLMVERIFY_AUDIT_REQUIRE_PERSISTENCE=true → evidence-required mode
 *   LLMVERIFY_AUDIT_HASH_KEY=<key>     → keyed (HMAC) content hashing
 *   LLMVERIFY_AUDIT_NO_CONTENT_HASH=1  → omit content hashes entirely
 */
function envAuditConfig(): Partial<AuditConfig> {
  const cfg: Partial<AuditConfig> = {};
  const flag = process.env.LLMVERIFY_AUDIT;
  if (flag && ['off', '0', 'false', 'disabled'].includes(flag.toLowerCase())) {
    cfg.enabled = false;
  }
  if (process.env.LLMVERIFY_AUDIT_REQUIRE_PERSISTENCE === 'true') {
    cfg.requirePersistence = true;
  }
  if (process.env.LLMVERIFY_AUDIT_HASH_KEY) {
    cfg.hashKey = process.env.LLMVERIFY_AUDIT_HASH_KEY;
  }
  if (process.env.LLMVERIFY_AUDIT_NO_CONTENT_HASH === '1' ||
      process.env.LLMVERIFY_AUDIT_NO_CONTENT_HASH === 'true') {
    cfg.includeContentHash = false;
  }
  return cfg;
}

/**
 * Audit logger class
 */
export class AuditLogger {
  private config: AuditConfig;
  private directoryAvailable: boolean | null = null;
  private static rotationCounter = 0;

  constructor(config?: Partial<AuditConfig>) {
    this.config = { ...DEFAULT_AUDIT_CONFIG, ...envAuditConfig(), ...config };
    this.ensureAuditDirectory();
  }

  /** Resolved audit directory (env-aware). */
  private resolvedAuditDir(): string | undefined {
    return this.config.auditDir || getAuditDir();
  }

  /**
   * Ensure audit directory exists
   */
  private ensureAuditDirectory(): void {
    const dir = this.resolvedAuditDir();
    if (this.config.enabled && dir) {
      try {
        fs.mkdirSync(dir, { recursive: true });
        this.directoryAvailable = true;
      } catch (error) {
        this.directoryAvailable = false;
        if (process.env.NODE_ENV === 'development') {
          console.error('Failed to create audit directory:', error);
        }
      }
    }
  }

  /**
   * Get audit file path
   */
  private getAuditFilePath(): string {
    const date = new Date().toISOString().split('T')[0];
    return path.join(this.resolvedAuditDir()!, `audit-${date}.jsonl`);
  }

  /**
   * Generate self-describing content hash
   */
  private hashContent(content: string): { hash: string; algorithm: 'sha256' | 'hmac-sha256' | 'none' } {
    if (!this.config.includeContentHash) {
      return { hash: '', algorithm: 'none' };
    }
    if (this.config.hashKey) {
      return {
        hash: hashContent(content, { algorithm: 'hmac-sha256', key: this.config.hashKey }),
        algorithm: 'hmac-sha256'
      };
    }
    return { hash: hashContent(content), algorithm: 'sha256' };
  }

  /**
   * Report (and optionally escalate) a persistence outcome.
   */
  private report(result: AuditWriteResult): AuditWriteResult {
    try {
      this.config.onWriteResult?.(result);
    } catch {
      // Observer failures must not break verification
    }

    // Evidence-required mode: only PERSISTED satisfies the contract.
    // DISABLED and NOT_ATTEMPTED mean no audit record exists — a caller
    // that required durable evidence must never see a silent success.
    if (this.config.requirePersistence && result.status !== 'PERSISTED') {
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
   * Write audit entry. Returns the actual persistence outcome —
   * callers can determine whether the record was persisted, failed,
   * or audit logging was disabled.
   */
  public log(entry: Omit<AuditEntry, 'timestamp'>): AuditWriteResult {
    if (!this.config.enabled) {
      return this.report(persistenceResult('DISABLED'));
    }

    const dir = this.resolvedAuditDir();
    if (!dir) {
      return this.report(persistenceResult('NOT_ATTEMPTED'));
    }

    if (this.directoryAvailable === false) {
      // Directory creation failed at init — retry once in case the
      // failure was transient (e.g. directory created later).
      this.ensureAuditDirectory();
      if (this.directoryAvailable === false) {
        return this.report(persistenceResult('FAILED', {
          error: `Audit directory unavailable: ${dir}`
        }));
      }
    }

    const fullEntry: AuditEntry = {
      timestamp: new Date().toISOString(),
      ...entry
    };

    // Attach integrity digest over the canonical entry (excluding the
    // integrity block itself). Detects post-write modification.
    const storedEntry = { ...fullEntry } as Record<string, unknown>;
    const entryDigest = digestAuditEntry(storedEntry);
    fullEntry.integrity = {
      digestSchemaVersion: '1.0',
      digestAlgorithm: 'sha256',
      entryDigest
    };

    const auditFile = this.getAuditFilePath();
    try {
      const line = JSON.stringify(fullEntry) + '\n';
      fs.appendFileSync(auditFile, line, 'utf-8');
      this.rotateIfNeeded(auditFile);
      return this.report(persistenceResult('PERSISTED', {
        filePath: auditFile,
        entryDigest
      }));
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to write audit entry:', error);
      }
      return this.report(persistenceResult('FAILED', {
        filePath: auditFile,
        error: (error as Error).message,
        entryDigest
      }));
    }
  }

  /**
   * Log verification operation. Returns the persistence outcome.
   */
  public logVerification(params: {
    requestId: string;
    content: string;
    prompt?: string;
    riskLevel: string;
    findingsCount: number;
    blocked: boolean;
    duration: number;
    enginesUsed: string[];
    configTier: string;
    userId?: string;
    userIp?: string;
  }): AuditWriteResult {
    const { hash, algorithm } = this.hashContent(params.content);
    return this.log({
      requestId: params.requestId,
      operation: 'verify',
      input: {
        contentLength: params.content.length,
        contentHash: hash,
        contentHashAlgorithm: algorithm,
        hasPrompt: !!params.prompt
      },
      output: {
        riskLevel: params.riskLevel,
        findingsCount: params.findingsCount,
        blocked: params.blocked
      },
      metadata: {
        version: require('../../package.json').version,
        duration: params.duration,
        enginesUsed: params.enginesUsed,
        configTier: params.configTier
      },
      user: this.config.includeUserInfo ? {
        id: params.userId,
        ip: params.userIp
      } : undefined
    });
  }

  /**
   * Rotate audit files
   */
  private rotateIfNeeded(auditFile: string): void {
    try {
      const stats = fs.statSync(auditFile);

      if (stats.size > this.config.maxFileSize!) {
        // Date.now() alone can collide when several rotations happen within
        // the same millisecond — a collision either silently overwrites the
        // previous rotated file (POSIX rename) or aborts rotation (Windows).
        const timestamp = Date.now();
        const rotatedFile = auditFile.replace(
          '.jsonl',
          `.${timestamp}-${AuditLogger.rotationCounter++}.jsonl`
        );
        fs.renameSync(auditFile, rotatedFile);

        this.cleanupOldAudits();
      }
    } catch (error) {
      // Ignore rotation errors
    }
  }

  /**
   * Clean up old audit files
   */
  private cleanupOldAudits(): void {
    const dir = this.resolvedAuditDir();
    if (!dir) return;

    try {
      const files = fs.readdirSync(dir)
        .filter(f => f.startsWith('audit-') && f.endsWith('.jsonl'))
        .map(f => ({
          name: f,
          path: path.join(dir, f),
          time: fs.statSync(path.join(dir, f)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);

      if (files.length > this.config.maxFiles!) {
        files.slice(this.config.maxFiles!).forEach(file => {
          try {
            fs.unlinkSync(file.path);
          } catch (error) {
            // Ignore deletion errors
          }
        });
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  /**
   * Read audit entries
   */
  public readAudit(date?: string): AuditEntry[] {
    const dir = this.resolvedAuditDir();
    if (!dir) return [];

    const dateStr = date || new Date().toISOString().split('T')[0];
    const auditFile = path.join(dir, `audit-${dateStr}.jsonl`);

    if (!fs.existsSync(auditFile)) return [];

    try {
      const content = fs.readFileSync(auditFile, 'utf-8');
      return content
        .split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line) as AuditEntry);
    } catch (error) {
      console.error('Failed to read audit:', error);
      return [];
    }
  }

  /**
   * Verify the integrity digests of every entry in an audit file.
   * Detects post-write tampering. Legacy entries written before
   * integrity digests existed are reported as 'unverifiable' rather
   * than silently trusted.
   */
  public verifyAuditFile(date?: string): {
    filePath: string;
    totalEntries: number;
    verified: number;
    tampered: number[];
    unverifiable: number;
  } {
    const dir = this.resolvedAuditDir();
    const dateStr = date || new Date().toISOString().split('T')[0];
    const auditFile = dir
      ? path.join(dir, `audit-${dateStr}.jsonl`)
      : `audit-${dateStr}.jsonl`;

    const result = {
      filePath: auditFile,
      totalEntries: 0,
      verified: 0,
      tampered: [] as number[],
      unverifiable: 0
    };

    if (!dir || !fs.existsSync(auditFile)) return result;

    const lines = fs.readFileSync(auditFile, 'utf-8')
      .split('\n')
      .filter(line => line.trim());

    lines.forEach((line, index) => {
      result.totalEntries++;
      let entry: Record<string, unknown>;
      try {
        entry = JSON.parse(line);
      } catch {
        result.tampered.push(index);
        return;
      }
      if (!entry.integrity) {
        result.unverifiable++;
      } else if (verifyAuditEntry(entry)) {
        result.verified++;
      } else {
        result.tampered.push(index);
      }
    });

    return result;
  }

  /**
   * Get audit statistics
   */
  public getStats(date?: string): {
    totalOperations: number;
    byOperation: Record<string, number>;
    blockedCount: number;
    avgDuration: number;
    riskDistribution: Record<string, number>;
  } {
    const entries = this.readAudit(date);

    const stats = {
      totalOperations: entries.length,
      byOperation: {} as Record<string, number>,
      blockedCount: 0,
      avgDuration: 0,
      riskDistribution: {} as Record<string, number>
    };

    let totalDuration = 0;

    entries.forEach(entry => {
      // Count by operation
      stats.byOperation[entry.operation] = (stats.byOperation[entry.operation] || 0) + 1;

      // Count blocked
      if (entry.output.blocked) stats.blockedCount++;

      // Sum duration
      totalDuration += entry.metadata.duration;

      // Risk distribution
      const risk = entry.output.riskLevel;
      stats.riskDistribution[risk] = (stats.riskDistribution[risk] || 0) + 1;
    });

    if (entries.length > 0) {
      stats.avgDuration = totalDuration / entries.length;
    }

    return stats;
  }

  /**
   * Export audit trail for compliance.
   * Note: exporting an audit file proves the records existed locally —
   * it does not establish producer authenticity or legal evidentiary
   * status on its own.
   */
  public exportAuditTrail(startDate: string, endDate: string, outputPath: string): void {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const allEntries: AuditEntry[] = [];

    // Collect all entries in date range
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const entries = this.readAudit(dateStr);
      allEntries.push(...entries);
    }

    // Write to output file. Canonicalized manifest digest lets consumers
    // detect post-export modification of the aggregate report.
    const report = {
      exportDate: new Date().toISOString(),
      dateRange: { start: startDate, end: endDate },
      totalEntries: allEntries.length,
      entries: allEntries
    };

    const manifest = {
      digestAlgorithm: 'sha256',
      digestSchemaVersion: '1.0',
      entriesDigest: `sha256:${require('crypto')
        .createHash('sha256')
        .update(canonicalize(allEntries), 'utf-8')
        .digest('hex')}`
    };

    fs.writeFileSync(outputPath, JSON.stringify({ ...report, manifest }, null, 2), 'utf-8');
  }
}

/**
 * Global audit logger
 */
let globalAuditLogger: AuditLogger | null = null;

/**
 * Get global audit logger
 */
export function getAuditLogger(config?: Partial<AuditConfig>): AuditLogger {
  if (!globalAuditLogger) {
    globalAuditLogger = new AuditLogger(config);
  }
  return globalAuditLogger;
}

/**
 * Set global audit logger
 */
export function setAuditLogger(logger: AuditLogger): void {
  globalAuditLogger = logger;
}

/**
 * Reset global audit logger (primarily for tests)
 */
export function resetAuditLogger(): void {
  globalAuditLogger = null;
}
