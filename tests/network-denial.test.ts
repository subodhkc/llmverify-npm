import { verify } from '../src/verify';
import { resetUsage } from '../src/usage/tracker';
import { containsPII, redactPII, isInputSafe } from '../src/csm6/security';

describe('zero-network local behavior (v1.6.0)', () => {
  beforeEach(() => {
    resetUsage();
    process.env.LLMVERIFY_TEST = '1';
  });

  afterAll(() => {
    resetUsage();
  });

  it('verify() completes without throwing on free tier (no network)', async () => {
    const result = await verify({ content: 'The sky is blue.' });
    expect(result).toBeDefined();
    expect(result.risk).toBeDefined();
    expect(result.meta.tier).toBe('free');
    expect(result.meta.version).toBe('1.6.0');
    expect(result.schemaVersion).toBe('1.0');
  });

  it('verify() does not require an API key or network config', async () => {
    const result = await verify({
      content: 'Hello from user@real-domain.co'
    });
    expect(result).toBeDefined();
    expect(result.risk).toBeDefined();
    expect(result.meta.tier).toBe('free');
  });

  it('PII utilities work entirely offline', () => {
    const input = 'Contact me at user@real-domain.co or call 555-123-4567';
    expect(containsPII(input)).toBe(true);
    const redaction = redactPII(input);
    expect(redaction.redacted).toContain('[REDACTED');
    expect(redaction.piiCount).toBeGreaterThan(0);
    expect(isInputSafe('hello world')).toBe(true);
  });
});
