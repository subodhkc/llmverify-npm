/**
 * Usage Tracker for llmverify
 * 
 * Tracks daily API call usage locally via ~/.llmverify/usage.json.
 * No network calls. No telemetry. Resets at midnight local time.
 * 
 * @module usage/tracker
 * @author Haiec
 * @license MIT
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Shape of the local usage file (~/.llmverify/usage.json)
 */
export interface UsageData {
  /** ISO date string (YYYY-MM-DD) for the current day */
  date: string;
  /** Total API calls today (verify, guard, safe, parse, sentinel, monitor) */
  calls: number;
  /** Breakdown by function */
  breakdown: {
    verify: number;
    sentinel: number;
    monitor: number;
  };
  /** Current tier */
  tier: string;
}

const USAGE_DIR = path.join(os.homedir(), '.llmverify');
const USAGE_FILE = path.join(USAGE_DIR, 'usage.json');

/**
 * Get today's date as YYYY-MM-DD in local time
 */
function getToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Ensure the ~/.llmverify directory exists
 */
function ensureDir(): void {
  try {
    if (!fs.existsSync(USAGE_DIR)) {
      fs.mkdirSync(USAGE_DIR, { recursive: true });
    }
  } catch {
    // Silently fail — usage tracking is best-effort
  }
}

/**
 * Read current usage data. Returns fresh data if file doesn't exist or date has changed.
 */
export function readUsage(tier: string = 'free'): UsageData {
  const today = getToday();
  
  try {
    if (fs.existsSync(USAGE_FILE)) {
      const raw = fs.readFileSync(USAGE_FILE, 'utf-8');
      const data: UsageData = JSON.parse(raw);
      
      // Reset if new day
      if (data.date !== today) {
        return createFreshUsage(today, tier);
      }
      
      return data;
    }
  } catch {
    // Corrupted file — start fresh
  }
  
  return createFreshUsage(today, tier);
}

/**
 * Create a fresh usage record for today
 */
function createFreshUsage(date: string, tier: string): UsageData {
  return {
    date,
    calls: 0,
    breakdown: {
      verify: 0,
      sentinel: 0,
      monitor: 0
    },
    tier
  };
}

/**
 * Write usage data to disk. Best-effort — never throws.
 */
function writeUsage(data: UsageData): void {
  try {
    ensureDir();
    fs.writeFileSync(USAGE_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch {
    // Silently fail — usage tracking is best-effort
  }
}

/**
 * Increment the usage counter for a specific function type.
 * Returns the updated usage data.
 */
export function incrementUsage(
  functionType: 'verify' | 'sentinel' | 'monitor',
  tier: string = 'free'
): UsageData {
  const data = readUsage(tier);
  data.calls += 1;
  data.breakdown[functionType] = (data.breakdown[functionType] || 0) + 1;
  data.tier = tier;
  writeUsage(data);
  return data;
}

/**
 * Reset usage data — deletes the usage file.
 * Primarily for testing. Returns true if reset succeeded.
 */
export function resetUsage(): boolean {
  try {
    if (fs.existsSync(USAGE_FILE)) {
      fs.unlinkSync(USAGE_FILE);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Get a human-readable usage summary for CLI display
 */
export function getUsageSummary(tier: string = 'free'): string {
  const data = readUsage(tier);
  const lines = [
    `Date: ${data.date}`,
    `Tier: ${data.tier}`,
    `Total calls today: ${data.calls}`,
    `  verify: ${data.breakdown.verify}`,
    `  sentinel: ${data.breakdown.sentinel}`,
    `  monitor: ${data.breakdown.monitor}`
  ];
  return lines.join('\n');
}
