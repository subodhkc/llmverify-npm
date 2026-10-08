/**
 * Baseline Drift Storage and Calibration
 * 
 * Tracks baseline metrics and detects drift over time
 * 
 * @module baseline/storage
 */

import * as fs from 'fs';
import * as path from 'path';
import { getBaselineDir } from '../paths';

/**
 * Baseline metrics
 */
export interface BaselineMetrics {
  version: string;
  createdAt: string;
  updatedAt: string;
  sampleCount: number;
  metrics: {
    averageLatency: number;
    averageContentLength: number;
    averageRiskScore: number;
    riskDistribution: {
      low: number;
      moderate: number;
      high: number;
      critical: number;
    };
    engineScores: {
      hallucination?: number;
      consistency?: number;
      csm6?: number;
    };
  };
}

/**
 * Drift record
 */
export interface DriftRecord {
  timestamp: string;
  metric: string;
  baseline: number;
  current: number;
  drift: number;
  driftPercent: number;
  severity: 'minor' | 'moderate' | 'significant';
}

/**
 * Baseline configuration
 */
export interface BaselineConfig {
  baselineDir?: string;
  driftThreshold?: number; // percentage
  maxDriftHistory?: number;
  autoCalibrate?: boolean;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: BaselineConfig = {
  baselineDir: undefined, // resolved via getBaselineDir() (LLMVERIFY_BASELINE_DIR / LLMVERIFY_HOME)
  driftThreshold: 20, // 20% drift triggers warning
  maxDriftHistory: 1000,
  autoCalibrate: false
};

/**
 * Baseline storage class
 */
export class BaselineStorage {
  private config: BaselineConfig;
  private baselineFile: string;
  private driftFile: string;
  
  constructor(config?: Partial<BaselineConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    const dir = this.config.baselineDir || getBaselineDir();
    this.baselineFile = path.join(dir, 'baseline.json');
    this.driftFile = path.join(dir, 'drift-history.jsonl');
    this.ensureDirectory();
  }
  
  /**
   * Ensure baseline directory exists
   */
  private ensureDirectory(): void {
    const dir = this.config.baselineDir || getBaselineDir();
    if (dir) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (error) {
        console.error('Failed to create baseline directory:', error);
      }
    }
  }
  
  /**
   * Load baseline metrics
   */
  public loadBaseline(): BaselineMetrics | null {
    if (!fs.existsSync(this.baselineFile)) {
      return null;
    }
    
    try {
      const content = fs.readFileSync(this.baselineFile, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error('Failed to load baseline:', error);
      return null;
    }
  }
  
  /**
   * Save baseline metrics
   */
  public saveBaseline(baseline: BaselineMetrics): void {
    try {
      fs.writeFileSync(
        this.baselineFile,
        JSON.stringify(baseline, null, 2),
        'utf-8'
      );
    } catch (error) {
      console.error('Failed to save baseline:', error);
    }
  }
  
  /**
   * Update baseline with new sample
   */
  public updateBaseline(sample: {
    latency: number;
    contentLength: number;
    riskScore: number;
    riskLevel: string;
    engineScores?: {
      hallucination?: number;
      consistency?: number;
      csm6?: number;
    };
  }): BaselineMetrics {
    let baseline = this.loadBaseline();
    
    if (!baseline) {
      // Create new baseline
      baseline = {
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sampleCount: 0,
        metrics: {
          averageLatency: 0,
          averageContentLength: 0,
          averageRiskScore: 0,
          riskDistribution: {
            low: 0,
            moderate: 0,
            high: 0,
            critical: 0
          },
          engineScores: {}
        }
      };
    }
    
    // Update sample count
    const n = baseline.sampleCount;
    baseline.sampleCount = n + 1;
    
    // Update running averages using incremental mean formula
    baseline.metrics.averageLatency = 
      (baseline.metrics.averageLatency * n + sample.latency) / (n + 1);
    
    baseline.metrics.averageContentLength = 
      (baseline.metrics.averageContentLength * n + sample.contentLength) / (n + 1);
    
    baseline.metrics.averageRiskScore = 
      (baseline.metrics.averageRiskScore * n + sample.riskScore) / (n + 1);
    
    // Update risk distribution
    const riskKey = sample.riskLevel as keyof typeof baseline.metrics.riskDistribution;
    if (riskKey in baseline.metrics.riskDistribution) {
      baseline.metrics.riskDistribution[riskKey]++;
    }
    
    // Update engine scores
    if (sample.engineScores) {
      for (const [engine, score] of Object.entries(sample.engineScores)) {
        if (score !== undefined) {
          const currentScore = (baseline.metrics.engineScores as any)[engine] || 0;
          (baseline.metrics.engineScores as any)[engine] = 
            (currentScore * n + score) / (n + 1);
        }
      }
    }
    
    baseline.updatedAt = new Date().toISOString();
    
    this.saveBaseline(baseline);
    return baseline;
  }
  
  /**
   * Check for drift
   */
  public checkDrift(current: {
    latency?: number;
    contentLength?: number;
    riskScore?: number;
  }): DriftRecord[] {
    const baseline = this.loadBaseline();
    if (!baseline) return [];
    
    const drifts: DriftRecord[] = [];
    const threshold = this.config.driftThreshold!;
    
    // Check latency drift
    if (current.latency !== undefined && baseline.metrics.averageLatency > 0) {
      const drift = current.latency - baseline.metrics.averageLatency;
      const driftPercent = (drift / baseline.metrics.averageLatency) * 100;
      
      if (Math.abs(driftPercent) > threshold) {
        drifts.push({
          timestamp: new Date().toISOString(),
          metric: 'latency',
          baseline: baseline.metrics.averageLatency,
          current: current.latency,
          drift,
          driftPercent,
          severity: this.getDriftSeverity(Math.abs(driftPercent))
        });
      }
    }
    
    // Check content length drift
    if (current.contentLength !== undefined && baseline.metrics.averageContentLength > 0) {
      const drift = current.contentLength - baseline.metrics.averageContentLength;
      const driftPercent = (drift / baseline.metrics.averageContentLength) * 100;
      
      if (Math.abs(driftPercent) > threshold) {
        drifts.push({
          timestamp: new Date().toISOString(),
          metric: 'contentLength',
          baseline: baseline.metrics.averageContentLength,
          current: current.contentLength,
          drift,
          driftPercent,
          severity: this.getDriftSeverity(Math.abs(driftPercent))
        });
      }
    }
    
    // Check risk score drift
    if (current.riskScore !== undefined && baseline.metrics.averageRiskScore > 0) {
      const drift = current.riskScore - baseline.metrics.averageRiskScore;
      const driftPercent = (drift / baseline.metrics.averageRiskScore) * 100;
      
      if (Math.abs(driftPercent) > threshold) {
        drifts.push({
          timestamp: new Date().toISOString(),
          metric: 'riskScore',
          baseline: baseline.metrics.averageRiskScore,
          current: current.riskScore,
          drift,
          driftPercent,
          severity: this.getDriftSeverity(Math.abs(driftPercent))
        });
      }
    }
    
    // Record drifts
    if (drifts.length > 0) {
      this.recordDrifts(drifts);
    }
    
    return drifts;
  }
  
  /**
   * Get drift severity
   */
  private getDriftSeverity(driftPercent: number): 'minor' | 'moderate' | 'significant' {
    if (driftPercent < 30) return 'minor';
    if (driftPercent < 50) return 'moderate';
    return 'significant';
  }
  
  /**
   * Record drift history
   */
  private recordDrifts(drifts: DriftRecord[]): void {
    try {
      const lines = drifts.map(d => JSON.stringify(d) + '\n').join('');
      fs.appendFileSync(this.driftFile, lines, 'utf-8');
      
      // Trim history if needed
      this.trimDriftHistory();
    } catch (error) {
      console.error('Failed to record drift:', error);
    }
  }
  
  /**
   * Trim drift history to max size
   */
  private trimDriftHistory(): void {
    if (!fs.existsSync(this.driftFile)) return;
    
    try {
      const content = fs.readFileSync(this.driftFile, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());
      
      if (lines.length > this.config.maxDriftHistory!) {
        const trimmed = lines.slice(-this.config.maxDriftHistory!);
        fs.writeFileSync(this.driftFile, trimmed.join('\n') + '\n', 'utf-8');
      }
    } catch (error) {
      console.error('Failed to trim drift history:', error);
    }
  }
  
  /**
   * Read drift history
   */
  public readDriftHistory(limit?: number): DriftRecord[] {
    if (!fs.existsSync(this.driftFile)) return [];
    
    try {
      const content = fs.readFileSync(this.driftFile, 'utf-8');
      const records = content
        .split('\n')
        .filter(l => l.trim())
        .map(l => JSON.parse(l) as DriftRecord);
      
      if (limit) {
        return records.slice(-limit);
      }
      
      return records;
    } catch (error) {
      console.error('Failed to read drift history:', error);
      return [];
    }
  }
  
  /**
   * Reset baseline
   */
  public resetBaseline(): void {
    if (fs.existsSync(this.baselineFile)) {
      fs.unlinkSync(this.baselineFile);
    }
    
    if (fs.existsSync(this.driftFile)) {
      fs.unlinkSync(this.driftFile);
    }
  }
  
  /**
   * Get baseline statistics
   */
  public getStatistics(): {
    hasBaseline: boolean;
    sampleCount: number;
    createdAt?: string;
    updatedAt?: string;
    driftRecordCount: number;
    recentDrifts: DriftRecord[];
  } {
    const baseline = this.loadBaseline();
    const driftHistory = this.readDriftHistory(10);
    
    return {
      hasBaseline: baseline !== null,
      sampleCount: baseline?.sampleCount || 0,
      createdAt: baseline?.createdAt,
      updatedAt: baseline?.updatedAt,
      driftRecordCount: this.readDriftHistory().length,
      recentDrifts: driftHistory
    };
  }
  
  /**
   * Calibrate baseline (reset and start fresh)
   */
  public calibrate(): void {
    this.resetBaseline();
  }
}

/**
 * Global baseline storage instance
 */
let globalBaseline: BaselineStorage | null = null;

/**
 * Get global baseline storage
 */
export function getBaselineStorage(config?: Partial<BaselineConfig>): BaselineStorage {
  if (!globalBaseline) {
    globalBaseline = new BaselineStorage(config);
  }
  return globalBaseline;
}

/**
 * Reset global baseline storage
 */
export function resetBaselineStorage(): void {
  globalBaseline = null;
}
