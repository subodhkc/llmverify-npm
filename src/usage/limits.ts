/**
 * Usage Limit Checker for llmverify
 * 
 * Checks whether the current tier's daily call limit has been reached.
 * Implements soft cap (warning) and hard cap (block) with grace period.
 * 
 * @module usage/limits
 * @author Haiec
 * @license MIT
 */

import { Tier, TIER_USAGE_LIMITS, TierUsageLimits } from '../types/config';
import { readUsage } from './tracker';

/**
 * Result of a usage limit check
 */
export interface UsageLimitResult {
  /** Whether the call is allowed to proceed */
  allowed: boolean;
  /** Number of calls remaining today */
  remaining: number;
  /** Total calls used today */
  used: number;
  /** Daily limit for this tier */
  limit: number;
  /** Warning message if approaching or exceeding limit */
  warning?: string;
  /** Whether this call is in the grace period (101-110% of limit) */
  inGracePeriod: boolean;
}

/** Grace period: 10% above the daily limit */
const GRACE_PERCENT = 0.10;

/**
 * Check whether the current usage is within the tier's daily limit.
 * 
 * - Under limit: allowed, no warning
 * - At limit (100%): allowed with warning
 * - Grace period (100-110%): allowed with strong warning
 * - Over grace (>110%): blocked with error
 * 
 * @param tier - Current tier (defaults to 'free')
 * @returns UsageLimitResult with allowed status and optional warning
 */
export function checkUsageLimit(tier: Tier = 'free'): UsageLimitResult {
  const limits: TierUsageLimits = TIER_USAGE_LIMITS[tier] || TIER_USAGE_LIMITS.free;
  const usage = readUsage(tier);
  const used = usage.calls;
  const limit = limits.dailyCallLimit;
  
  // Unlimited tier
  if (limit === Infinity) {
    return {
      allowed: true,
      remaining: Infinity,
      used,
      limit,
      inGracePeriod: false
    };
  }
  
  const graceLimit = Math.ceil(limit * (1 + GRACE_PERCENT));
  const remaining = Math.max(0, limit - used);
  
  // Under limit — all good
  if (used < limit) {
    return {
      allowed: true,
      remaining,
      used,
      limit,
      inGracePeriod: false
    };
  }
  
  // At or over limit but within grace period
  if (used >= limit && used < graceLimit) {
    return {
      allowed: true,
      remaining: 0,
      used,
      limit,
      warning: `Daily free limit reached (${limit}/day). Your verifications still work for ${graceLimit - used} more calls. Upgrade: https://haiec.com/llmverify/pricing`,
      inGracePeriod: true
    };
  }
  
  // Over grace period — blocked
  return {
    allowed: false,
    remaining: 0,
    used,
    limit,
    warning: `Daily limit exceeded (${used}/${limit}). Upgrade your plan for more calls: https://haiec.com/llmverify/pricing`,
    inGracePeriod: false
  };
}

/**
 * Check content length against tier limit
 */
export function checkContentLength(contentLength: number, tier: Tier = 'free'): { allowed: boolean; warning?: string } {
  const limits = TIER_USAGE_LIMITS[tier] || TIER_USAGE_LIMITS.free;
  
  if (limits.maxContentLength === Infinity) {
    return { allowed: true };
  }
  
  if (contentLength > limits.maxContentLength) {
    const maxKB = Math.round(limits.maxContentLength / 1024);
    const actualKB = Math.round(contentLength / 1024);
    return {
      allowed: false,
      warning: `Content too large (${actualKB}KB). ${tier} tier limit: ${maxKB}KB. Upgrade: https://haiec.com/llmverify/pricing`
    };
  }
  
  return { allowed: true };
}
