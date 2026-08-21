import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { TIER_USAGE_LIMITS } from '../src/types/config';
import { checkUsageLimit } from '../src/usage/limits';
import { resetUsage } from '../src/usage/tracker';

const USAGE_FILE = path.join(os.homedir(), '.llmverify', 'usage.json');

function setUsage(calls: number, date = getToday()): void {
  const usage = {
    date,
    calls,
    breakdown: { verify: calls, sentinel: 0, monitor: 0 },
    tier: 'free'
  };
  fs.mkdirSync(path.dirname(USAGE_FILE), { recursive: true });
  fs.writeFileSync(USAGE_FILE, JSON.stringify(usage, null, 2), 'utf8');
}

function getToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

describe('free tier 2000/day limit (v1.6.1)', () => {
  beforeEach(() => {
    resetUsage();
  });

  afterAll(() => {
    resetUsage();
  });

  it('TIER_USAGE_LIMITS.free.dailyCallLimit is 2000', () => {
    expect(TIER_USAGE_LIMITS.free.dailyCallLimit).toBe(2000);
  });

  it('first call is allowed with 2000 remaining', () => {
    const result = checkUsageLimit('free');
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(2000);
    expect(result.remaining).toBe(2000);
    expect(result.used).toBe(0);
    expect(result.inGracePeriod).toBe(false);
  });

  it('call 1999 (used=1) is allowed with 1999 remaining', () => {
    setUsage(1);
    const result = checkUsageLimit('free');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1999);
    expect(result.inGracePeriod).toBe(false);
  });

  it('call 2000 (used=1999) is allowed with 1 remaining', () => {
    setUsage(1999);
    const result = checkUsageLimit('free');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
    expect(result.inGracePeriod).toBe(false);
  });

  it('call 2001 (used=2000) starts grace period (allowed with warning)', () => {
    setUsage(2000);
    const result = checkUsageLimit('free');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
    expect(result.inGracePeriod).toBe(true);
    expect(result.warning).toContain('2000');
  });

  it('call 2199 (used=2199) is the last allowed grace call', () => {
    setUsage(2199);
    const result = checkUsageLimit('free');
    expect(result.allowed).toBe(true);
    expect(result.inGracePeriod).toBe(true);
  });

  it('call 2200 (used=2200) is blocked (over 110% grace)', () => {
    setUsage(2200);
    const result = checkUsageLimit('free');
    expect(result.allowed).toBe(false);
    expect(result.inGracePeriod).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.used).toBe(2200);
    expect(result.warning).toContain('2200');
  });

  it('missing/corrupt usage file starts fresh (allowed)', () => {
    resetUsage();
    const result = checkUsageLimit('free');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2000);
  });

  it('day rollover resets usage automatically', () => {
    setUsage(9999, '2020-01-01');
    const result = checkUsageLimit('free');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2000);
    expect(result.used).toBe(0);
  });
});
