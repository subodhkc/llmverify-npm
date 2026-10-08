/**
 * Structured Logging System
 * 
 * Industry-grade logging with rotation, request tracking, and audit trails
 * 
 * @module logging/logger
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { ErrorCode } from '../errors/codes';
import { getLogDir } from '../paths';
import { sanitizeForLogging } from '../security/validators';

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

/**
 * Log entry structure
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  requestId: string;
  message: string;
  data?: any;
  duration?: number;
  error?: {
    message: string;
    code?: ErrorCode;
    stack?: string;
  };
  metadata?: {
    version: string;
    pid: number;
    hostname: string;
  };
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  enabled: boolean;
  level: LogLevel;
  logDir?: string;
  maxFileSize?: number; // bytes
  maxFiles?: number;
  includeMetadata?: boolean;
  sanitizePII?: boolean;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: LoggerConfig = {
  enabled: true,
  level: LogLevel.INFO,
  logDir: undefined, // resolved lazily via getLogDir() (LLMVERIFY_LOG_DIR / LLMVERIFY_HOME)
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 10,
  includeMetadata: true,
  sanitizePII: true
};

/**
 * Keys whose values are always redacted from structured log data.
 * Matches on substrings of the lowercased key to cover common variants
 * (apiKey, api_key, AWS_SECRET_ACCESS_KEY, bearerToken, ...).
 */
const SENSITIVE_KEY_PATTERNS = [
  'password',
  'passwd',
  'secret',
  'token',
  'apikey',
  'api_key',
  'api-key',
  'authorization',
  'credential',
  'private_key',
  'privatekey',
  'private-key',
  'access_key',
  'accesskey',
  'session',
  'cookie'
];

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_KEY_PATTERNS.some(p => lower.includes(p));
}

/**
 * Logger class
 */
export class Logger {
  private config: LoggerConfig;
  private currentRequestId: string | null = null;
  private requestStartTime: number | null = null;
  
  constructor(config?: Partial<LoggerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.ensureLogDirectory();
  }
  
  /** Resolved log directory (env-aware). */
  private resolvedLogDir(): string | undefined {
    return this.config.logDir || getLogDir();
  }

  /**
   * Ensure log directory exists
   */
  private ensureLogDirectory(): void {
    const dir = this.resolvedLogDir();
    if (this.config.enabled && dir) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (error) {
        console.error('Failed to create log directory:', error);
        this.config.enabled = false;
      }
    }
  }
  
  /**
   * Generate new request ID
   */
  public startRequest(): string {
    this.currentRequestId = uuidv4();
    this.requestStartTime = Date.now();
    return this.currentRequestId;
  }
  
  /**
   * End request and return duration
   */
  public endRequest(): number | null {
    if (this.requestStartTime) {
      const duration = Date.now() - this.requestStartTime;
      this.requestStartTime = null;
      return duration;
    }
    return null;
  }
  
  /**
   * Get current request ID
   */
  public getRequestId(): string {
    if (!this.currentRequestId) {
      this.currentRequestId = uuidv4();
    }
    return this.currentRequestId;
  }
  
  /**
   * Get log file path for today
   */
  private getLogFilePath(): string {
    const date = new Date().toISOString().split('T')[0];
    return path.join(this.resolvedLogDir()!, `llmverify-${date}.jsonl`);
  }
  
  /**
   * Sanitize data to remove PII
   */
  private sanitizeData(data: any): any {
    if (!this.config.sanitizePII) return data;
    
    if (typeof data === 'string') {
      // Delegate to the shared sanitizer so diagnostic output applies
      // the same PII/secret patterns everywhere (email, phone, SSN,
      // card numbers, API keys, IP addresses).
      data = sanitizeForLogging(data);
    } else if (typeof data === 'object' && data !== null) {
      const sanitized: any = Array.isArray(data) ? [] : {};
      for (const key in data) {
        // Skip sensitive keys (common naming variants)
        if (isSensitiveKey(key)) {
          sanitized[key] = '[REDACTED]';
        } else {
          sanitized[key] = this.sanitizeData(data[key]);
        }
      }
      return sanitized;
    }
    
    return data;
  }
  
  /**
   * Write log entry
   */
  private writeLog(entry: LogEntry): void {
    if (!this.config.enabled) return;
    
    try {
      const logFile = this.getLogFilePath();
      const line = JSON.stringify(entry) + '\n';
      
      fs.appendFileSync(logFile, line, 'utf-8');
      
      // Check file size and rotate if needed
      this.rotateLogsIfNeeded(logFile);
    } catch (error) {
      // Fail silently to not disrupt main operation
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to write log:', error);
      }
    }
  }
  
  /**
   * Rotate logs if file exceeds max size
   */
  private rotateLogsIfNeeded(logFile: string): void {
    try {
      const stats = fs.statSync(logFile);
      
      if (stats.size > this.config.maxFileSize!) {
        const timestamp = Date.now();
        const rotatedFile = logFile.replace('.jsonl', `.${timestamp}.jsonl`);
        fs.renameSync(logFile, rotatedFile);
        
        // Clean up old files
        this.cleanupOldLogs();
      }
    } catch (error) {
      // Ignore rotation errors
    }
  }
  
  /**
   * Clean up old log files
   */
  private cleanupOldLogs(): void {
    const dir = this.resolvedLogDir();
    if (!dir) return;
    
    try {
      const files = fs.readdirSync(dir)
        .filter(f => f.startsWith('llmverify-') && f.endsWith('.jsonl'))
        .map(f => ({
          name: f,
          path: path.join(dir, f),
          time: fs.statSync(path.join(dir, f)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);
      
      // Keep only maxFiles
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
   * Create log entry
   */
  private createEntry(level: LogLevel, message: string, data?: any, error?: Error): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      requestId: this.getRequestId(),
      message: this.config.sanitizePII ? this.sanitizeData(message) : message
    };
    
    if (data) {
      entry.data = this.sanitizeData(data);
    }
    
    if (this.requestStartTime) {
      entry.duration = Date.now() - this.requestStartTime;
    }
    
    if (error) {
      entry.error = {
        message: this.config.sanitizePII ? sanitizeForLogging(error.message) : error.message,
        code: (error as any).code,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      };
    }
    
    if (this.config.includeMetadata) {
      entry.metadata = {
        version: require('../../package.json').version,
        pid: process.pid,
        hostname: os.hostname()
      };
    }
    
    return entry;
  }
  
  /**
   * Check if should log at level
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const configLevelIndex = levels.indexOf(this.config.level);
    const messageLevelIndex = levels.indexOf(level);
    
    return messageLevelIndex >= configLevelIndex;
  }
  
  /**
   * Log debug message
   */
  public debug(message: string, data?: any): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.writeLog(this.createEntry(LogLevel.DEBUG, message, data));
    }
  }
  
  /**
   * Log info message
   */
  public info(message: string, data?: any): void {
    if (this.shouldLog(LogLevel.INFO)) {
      this.writeLog(this.createEntry(LogLevel.INFO, message, data));
    }
  }
  
  /**
   * Log warning message
   */
  public warn(message: string, data?: any): void {
    if (this.shouldLog(LogLevel.WARN)) {
      this.writeLog(this.createEntry(LogLevel.WARN, message, data));
    }
  }
  
  /**
   * Log error message
   */
  public error(message: string, error?: Error, data?: any): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      this.writeLog(this.createEntry(LogLevel.ERROR, message, data, error));
    }
  }
  
  /**
   * Read logs for a specific date
   */
  public readLogs(date?: string): LogEntry[] {
    const dir = this.resolvedLogDir();
    if (!dir) return [];
    
    const dateStr = date || new Date().toISOString().split('T')[0];
    const logFile = path.join(dir, `llmverify-${dateStr}.jsonl`);
    
    if (!fs.existsSync(logFile)) return [];
    
    try {
      const content = fs.readFileSync(logFile, 'utf-8');
      return content
        .split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line) as LogEntry);
    } catch (error) {
      console.error('Failed to read logs:', error);
      return [];
    }
  }
  
  /**
   * Get log statistics
   */
  public getStats(date?: string): {
    totalEntries: number;
    byLevel: Record<LogLevel, number>;
    errorCount: number;
    avgDuration: number;
  } {
    const logs = this.readLogs(date);
    
    const stats = {
      totalEntries: logs.length,
      byLevel: {
        [LogLevel.DEBUG]: 0,
        [LogLevel.INFO]: 0,
        [LogLevel.WARN]: 0,
        [LogLevel.ERROR]: 0
      },
      errorCount: 0,
      avgDuration: 0
    };
    
    let totalDuration = 0;
    let durationCount = 0;
    
    logs.forEach(log => {
      stats.byLevel[log.level]++;
      if (log.error) stats.errorCount++;
      if (log.duration) {
        totalDuration += log.duration;
        durationCount++;
      }
    });
    
    if (durationCount > 0) {
      stats.avgDuration = totalDuration / durationCount;
    }
    
    return stats;
  }
}

/**
 * Global logger instance
 */
let globalLogger: Logger | null = null;

/**
 * Get global logger
 */
export function getLogger(config?: Partial<LoggerConfig>): Logger {
  if (!globalLogger) {
    globalLogger = new Logger(config);
  }
  return globalLogger;
}

/**
 * Set global logger
 */
export function setLogger(logger: Logger): void {
  globalLogger = logger;
}

/**
 * Reset global logger
 */
export function resetLogger(): void {
  globalLogger = null;
}
