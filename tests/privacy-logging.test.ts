/**
 * Privacy & logging regression tests — diagnostic and audit output
 * must not leak raw content, secrets, or PII.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { verify } from '../src/verify';
import { Logger } from '../src/logging/logger';
import { AuditLogger, resetAuditLogger } from '../src/logging/audit';
import { sanitizeForLogging, sanitizeObject } from '../src/security/validators';

function tmpdir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'llmverify-privacy-'));
}

describe('log sanitization', () => {
  it('redacts common secret-key variants in nested objects', () => {
    const logger = new Logger({ enabled: true, logDir: tmpdir() });
    logger.info('test', {
      apiKey: 'sk-test-1234567890',
      nested: {
        AWS_SECRET_ACCESS_KEY: 'wJalrXUtnFEMI',
        authToken: 'tok',
        config: { my_password: 'hunter2', normal: 'visible' }
      },
      headers: { Authorization: 'Bearer abc' }
    });

    const logs = logger.readLogs();
    expect(logs.length).toBe(1);
    const raw = JSON.stringify(logs[0].data);
    expect(raw).not.toContain('sk-test-1234567890');
    expect(raw).not.toContain('wJalrXUtnFEMI');
    expect(raw).not.toContain('hunter2');
    expect(raw).not.toContain('Bearer abc');
    expect(raw).toContain('visible');
  });

  it('sanitizes secrets inside error messages', () => {
    const logger = new Logger({ enabled: true, logDir: tmpdir() });
    const err = new Error('auth failed for key AKIAIOSFODNN7EXAMPLEKEY1234567890 and user a@b.com');
    logger.error('operation failed', err);
    const logs = logger.readLogs();
    const serialized = JSON.stringify(logs[0]);
    expect(serialized).not.toContain('AKIAIOSFODNN7EXAMPLEKEY1234567890');
    expect(serialized).not.toContain('a@b.com');
  });

  it('does not write stack traces outside development', () => {
    const prev = process.env.NODE_ENV;
    delete process.env.NODE_ENV;
    try {
      const logger = new Logger({ enabled: true, logDir: tmpdir() });
      logger.error('x', new Error('boom'));
      const logs = logger.readLogs();
      expect(logs[0].error?.stack).toBeUndefined();
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it('sanitizeForLogging covers PII and key-like strings', () => {
    const out = sanitizeForLogging(
      'email a@b.co phone 555-123-4567 ssn 123-45-6789 key ABCDEFGHIJKLMNOPQRSTUVWXYZ123456 ip 10.0.0.1'
    );
    expect(out).not.toContain('a@b.co');
    expect(out).not.toContain('555-123-4567');
    expect(out).not.toContain('123-45-6789');
    expect(out).not.toContain('ABCDEFGHIJKLMNOPQRSTUVWXYZ123456');
    expect(out).not.toContain('10.0.0.1');
  });

  it('sanitizeObject covers nested sensitive keys', () => {
    const out = sanitizeObject({
      deep: { deeper: { api_key: 'zzz', ok: 'keep' } },
      list: [{ secret: 's' }, 'plain']
    });
    expect(out.deep.deeper.api_key).toBe('[REDACTED]');
    expect(out.deep.deeper.ok).toBe('keep');
    expect(out.list[0].secret).toBe('[REDACTED]');
    expect(out.list[1]).toBe('plain');
  });
});

describe('audit privacy', () => {
  it('never writes raw content or prompts to audit files', async () => {
    const dir = tmpdir();
    const logger = new AuditLogger({ enabled: true, auditDir: dir });
    const content = 'My SSN is 123-45-6789 and email is private@person.com';
    logger.logVerification({
      requestId: 'r1',
      content,
      prompt: 'my prompt contains sk-secretkeyvalue1234567890',
      riskLevel: 'high',
      findingsCount: 2,
      blocked: true,
      duration: 5,
      enginesUsed: ['csm6'],
      configTier: 'free'
    });

    const raw = fs.readFileSync(
      path.join(dir, `audit-${new Date().toISOString().split('T')[0]}.jsonl`),
      'utf-8'
    );
    expect(raw).not.toContain('123-45-6789');
    expect(raw).not.toContain('private@person.com');
    expect(raw).not.toContain('sk-secretkeyvalue1234567890');
    expect(raw).not.toContain(content);
    // Only length + hash recorded
    const entry = JSON.parse(raw.trim().split('\n')[0]);
    expect(entry.input.contentLength).toBe(content.length);
    expect(entry.input.contentHash).toMatch(/^sha256:/);
  });

  it('verify() result contains no raw content in the audit receipt', async () => {
    process.env.LLMVERIFY_HOME = tmpdir();
    resetAuditLogger();
    const content = 'confidential payload zzz9';
    const result = await verify({ content });
    expect(JSON.stringify(result.audit)).not.toContain(content);
  });
});

describe('local-first guarantees', () => {
  it('verify() does not write outside the configured LLMVERIFY_HOME', async () => {
    const home = tmpdir();
    process.env.LLMVERIFY_HOME = home;
    resetAuditLogger();
    const result = await verify({ content: 'local-first check' });
    expect(result.audit?.status).toBe('PERSISTED');
    expect(result.audit?.filePath?.startsWith(home)).toBe(true);
  });
});
