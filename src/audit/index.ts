/**
 * Audit Logger
 * 
 * Local-only audit logging for verification results.
 * Supports file output and optional GitHub export.
 * No external API calls - all processing is local.
 * 
 * @module audit
 * @author llmverify
 * @license MIT
 */

import * as fs from 'fs';
import * as path from 'path';

export interface AuditEntry {
  id: string;
  timestamp: string;
  action: 'verify' | 'classify' | 'check_pii' | 'check_injection' | 'run';
  input: {
    contentLength: number;
    contentHash: string;
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
  includeContentHash?: boolean;
}

const DEFAULT_CONFIG: AuditConfig = {
  enabled: false,
  outputPath: './llmverify-audit.jsonl',
  maxEntries: 10000,
  rotateDaily: true,
  includeContentHash: true
};

/**
 * Simple hash function for content (no crypto dependency)
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

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

  constructor(config: Partial<AuditConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.currentDate = new Date().toISOString().split('T')[0];
  }

  /**
   * Log a verification action
   */
  log(entry: Omit<AuditEntry, 'id' | 'timestamp'>): AuditEntry {
    if (!this.config.enabled) {
      return { ...entry, id: '', timestamp: '' };
    }

    const fullEntry: AuditEntry = {
      ...entry,
      id: generateId(),
      timestamp: new Date().toISOString()
    };

    this.entries.push(fullEntry);

    // Write to file if configured
    if (this.config.outputPath) {
      this.writeToFile(fullEntry);
    }

    // Rotate if needed
    if (this.entries.length > (this.config.maxEntries || 10000)) {
      this.entries = this.entries.slice(-1000);
    }

    return fullEntry;
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
    return {
      action,
      input: {
        contentLength: content.length,
        contentHash: this.config.includeContentHash ? simpleHash(content) : '',
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
   * Write entry to file (JSONL format)
   */
  private writeToFile(entry: AuditEntry): void {
    if (!this.config.outputPath) return;

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
    } catch (error) {
      // Silently fail - audit should not break main functionality
      console.error('[llmverify audit] Failed to write:', error);
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
