import { verify } from '../src/verify';
import { resetUsage } from '../src/usage/tracker';
import { redactPII, containsPII, isInputSafe } from '../src/csm6/security';

describe('stdout/stdio safety (v1.6.1)', () => {
  beforeEach(() => {
    resetUsage();
    process.env.LLMVERIFY_TEST = '1';
  });

  it('programmatic import of llmverify produces zero stdout', () => {
    const cp = require('child_process');
    const result = cp.spawnSync(
      'node',
      ['-e', 'require("./dist/index.js");'],
      { encoding: 'utf8' }
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('verify() returns information without printing to stdout', async () => {
    const spy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const result = await verify({ content: 'Hello, this is safe text.' });
    expect(result).toBeDefined();
    expect(result.risk).toBeDefined();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('library errors throw without printing to stdout', async () => {
    const spy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await expect(verify({ content: '' })).rejects.toThrow();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('security utility functions do not print to stdout', () => {
    const spy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const input = 'Contact me at user@real-domain.co or call 555-123-4567';
    expect(containsPII(input)).toBe(true);
    expect(redactPII(input).redacted).toContain('[REDACTED');
    expect(isInputSafe('hello')).toBe(true);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
