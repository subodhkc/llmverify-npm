/**
 * Audit persistence status tests — callers must be able to observe
 * whether the audit write actually succeeded.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { verify } from '../src/verify';
import {
  AuditLogger,
  setAuditLogger,
  resetAuditLogger
} from '../src/logging/audit';
import { AuditPersistenceError } from '../src/errors';
import { ErrorCode } from '../src/errors/codes';

function tmpdir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'llmverify-persist-'));
}

/** A path that is an existing FILE — mkdir/append inside it must fail. */
function fileAsDir(): { dir: string; cleanup: () => void } {
  const dir = tmpdir();
  const blocker = path.join(dir, 'blocker');
  fs.writeFileSync(blocker, 'not a directory');
  return { dir: blocker, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

describe('audit persistence status', () => {
  afterEach(() => {
    resetAuditLogger();
    delete process.env.LLMVERIFY_AUDIT;
    delete process.env.LLMVERIFY_AUDIT_REQUIRE_PERSISTENCE;
  });

  it('PERSISTED on successful append', () => {
    const dir = tmpdir();
    const logger = new AuditLogger({ enabled: true, auditDir: dir });
    const res = logger.logVerification({
      requestId: 'r1', content: 'x', riskLevel: 'low', findingsCount: 0,
      blocked: false, duration: 1, enginesUsed: [], configTier: 'free'
    });
    expect(res.status).toBe('PERSISTED');
    expect(res.filePath).toContain(dir);
    expect(fs.existsSync(res.filePath!)).toBe(true);
  });

  it('DISABLED when audit is off', () => {
    const logger = new AuditLogger({ enabled: false, auditDir: tmpdir() });
    const res = logger.logVerification({
      requestId: 'r1', content: 'x', riskLevel: 'low', findingsCount: 0,
      blocked: false, duration: 1, enginesUsed: [], configTier: 'free'
    });
    expect(res.status).toBe('DISABLED');
    expect(res.filePath).toBeUndefined();
  });

  it('FAILED when directory is unavailable', () => {
    const { dir, cleanup } = fileAsDir();
    try {
      const logger = new AuditLogger({ enabled: true, auditDir: dir });
      const res = logger.logVerification({
        requestId: 'r1', content: 'x', riskLevel: 'low', findingsCount: 0,
        blocked: false, duration: 1, enginesUsed: [], configTier: 'free'
      });
      expect(res.status).toBe('FAILED');
      expect(res.error).toBeDefined();
    } finally {
      cleanup();
    }
  });

  it('FAILED when the write itself errors (directory removed after init)', () => {
    const dir = tmpdir();
    const logger = new AuditLogger({ enabled: true, auditDir: dir });
    fs.rmSync(dir, { recursive: true, force: true });
    // Block recreation with a file at the dir path
    fs.writeFileSync(dir, 'occupied');
    try {
      const res = logger.logVerification({
        requestId: 'r1', content: 'x', riskLevel: 'low', findingsCount: 0,
        blocked: false, duration: 1, enginesUsed: [], configTier: 'free'
      });
      expect(res.status).toBe('FAILED');
    } finally {
      fs.rmSync(dir, { force: true });
    }
  });

  it('recovers after a transient failure', () => {
    const { dir, cleanup } = fileAsDir();
    const logger = new AuditLogger({ enabled: true, auditDir: dir });
    expect(logger.logVerification({
      requestId: 'r1', content: 'x', riskLevel: 'low', findingsCount: 0,
      blocked: false, duration: 1, enginesUsed: [], configTier: 'free'
    }).status).toBe('FAILED');

    // Fix the environment — next write should retry directory creation
    cleanup();
    const res = logger.logVerification({
      requestId: 'r2', content: 'x', riskLevel: 'low', findingsCount: 0,
      blocked: false, duration: 1, enginesUsed: [], configTier: 'free'
    });
    expect(res.status).toBe('PERSISTED');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('rotates files when maxFileSize is exceeded', () => {
    const dir = tmpdir();
    const logger = new AuditLogger({ enabled: true, auditDir: dir, maxFileSize: 200 });
    for (let i = 0; i < 5; i++) {
      logger.logVerification({
        requestId: `r${i}`, content: 'x'.repeat(100), riskLevel: 'low',
        findingsCount: 0, blocked: false, duration: 1,
        enginesUsed: [], configTier: 'free'
      });
    }
    const files = fs.readdirSync(dir).filter(f => f.startsWith('audit-'));
    expect(files.length).toBeGreaterThan(1);
  });

  it('handles many sequential writes without loss', () => {
    const dir = tmpdir();
    const logger = new AuditLogger({ enabled: true, auditDir: dir });
    const results = [];
    for (let i = 0; i < 25; i++) {
      results.push(logger.logVerification({
        requestId: `r${i}`, content: `content ${i}`, riskLevel: 'low',
        findingsCount: 0, blocked: false, duration: 1,
        enginesUsed: [], configTier: 'free'
      }));
    }
    expect(results.every(r => r.status === 'PERSISTED')).toBe(true);
    expect(logger.readAudit().length).toBe(25);
  });

  it('onWriteResult observer receives every outcome', () => {
    const seen: string[] = [];
    const logger = new AuditLogger({
      enabled: false,
      onWriteResult: r => seen.push(r.status)
    });
    logger.logVerification({
      requestId: 'r1', content: 'x', riskLevel: 'low', findingsCount: 0,
      blocked: false, duration: 1, enginesUsed: [], configTier: 'free'
    });
    expect(seen).toEqual(['DISABLED']);
  });

  it('requirePersistence throws AuditPersistenceError on failure', () => {
    const { dir, cleanup } = fileAsDir();
    try {
      const logger = new AuditLogger({ enabled: true, auditDir: dir, requirePersistence: true });
      expect(() => logger.logVerification({
        requestId: 'r1', content: 'x', riskLevel: 'low', findingsCount: 0,
        blocked: false, duration: 1, enginesUsed: [], configTier: 'free'
      })).toThrow(AuditPersistenceError);
    } finally {
      cleanup();
    }
  });

  it('requirePersistence throws on DISABLED — disabled logging is not persistence', () => {
    const logger = new AuditLogger({ enabled: false, requirePersistence: true });
    expect(() => logger.logVerification({
      requestId: 'r1', content: 'x', riskLevel: 'low', findingsCount: 0,
      blocked: false, duration: 1, enginesUsed: [], configTier: 'free'
    })).toThrow(AuditPersistenceError);
  });

  it('requirePersistence returns normally on PERSISTED', () => {
    const dir = tmpdir();
    const logger = new AuditLogger({ enabled: true, auditDir: dir, requirePersistence: true });
    const res = logger.logVerification({
      requestId: 'r1', content: 'x', riskLevel: 'low', findingsCount: 0,
      blocked: false, duration: 1, enginesUsed: [], configTier: 'free'
    });
    expect(res.status).toBe('PERSISTED');
  });
});

describe('verify() audit integration', () => {
  beforeAll(() => {
    process.env.LLMVERIFY_HOME = tmpdir();
  });

  afterEach(() => {
    resetAuditLogger();
  });

  it('exposes the persistence receipt on the result', async () => {
    const result = await verify({ content: 'audit receipt check' });
    expect(result.audit).toBeDefined();
    expect(['PERSISTED', 'DISABLED', 'FAILED', 'NOT_ATTEMPTED']).toContain(result.audit!.status);
    if (result.audit!.status === 'PERSISTED') {
      expect(result.audit!.entryDigest).toMatch(/^sha256:/);
    }
  });

  it('reports FAILED (without throwing) in developer mode', async () => {
    const { dir, cleanup } = fileAsDir();
    try {
      setAuditLogger(new AuditLogger({ enabled: true, auditDir: dir }));
      const result = await verify({ content: 'still returns a result' });
      expect(result.risk).toBeDefined();
      expect(result.audit!.status).toBe('FAILED');
    } finally {
      cleanup();
    }
  });

  it('throws AuditPersistenceError in evidence-required mode', async () => {
    const { dir, cleanup } = fileAsDir();
    try {
      setAuditLogger(new AuditLogger({ enabled: true, auditDir: dir }));
      await expect(verify({
        content: 'must persist or fail',
        audit: { requirePersistence: true }
      })).rejects.toMatchObject({
        name: 'AuditPersistenceError',
        code: ErrorCode.AUDIT_PERSISTENCE_FAILED
      });
    } finally {
      cleanup();
    }
  });

  it('invokes the per-call onResult observer', async () => {
    const receipts: string[] = [];
    await verify({
      content: 'observer test',
      audit: { onResult: r => receipts.push(r.status) }
    });
    expect(receipts.length).toBe(1);
  });

  it('throws in evidence-required mode when audit is DISABLED', async () => {
    setAuditLogger(new AuditLogger({ enabled: false }));
    await expect(verify({
      content: 'disabled audit must not satisfy evidence-required mode',
      audit: { requirePersistence: true }
    })).rejects.toMatchObject({
      name: 'AuditPersistenceError',
      code: ErrorCode.AUDIT_PERSISTENCE_FAILED
    });
  });

  it('returns normally in evidence-required mode when PERSISTED', async () => {
    const dir = tmpdir();
    setAuditLogger(new AuditLogger({ enabled: true, auditDir: dir }));
    const result = await verify({
      content: 'evidence-required success path',
      audit: { requirePersistence: true }
    });
    expect(result.audit!.status).toBe('PERSISTED');
    expect(result.audit!.entryDigest).toMatch(/^sha256:/);
  });

  it('developer mode still reports DISABLED without throwing', async () => {
    setAuditLogger(new AuditLogger({ enabled: false }));
    const result = await verify({ content: 'developer mode check' });
    expect(result.risk).toBeDefined();
    expect(result.audit!.status).toBe('DISABLED');
  });
});

describe('legacy audit logger (src/audit/index.ts) persistence semantics', () => {
  it('requirePersistence throws on NOT_ATTEMPTED (no outputPath)', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { AuditLogger: AuditLoggerV1 } = require('../src/audit');
    const logger = new AuditLoggerV1({
      enabled: true,
      outputPath: undefined,
      requirePersistence: true
    });
    expect(() => logger.log(logger.createEntry('verify', 'x', { meta: {} })))
      .toThrow(AuditPersistenceError);
  });

  it('requirePersistence throws on DISABLED', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { AuditLogger: AuditLoggerV1 } = require('../src/audit');
    const logger = new AuditLoggerV1({
      enabled: false,
      outputPath: path.join(tmpdir(), 'a.jsonl'),
      requirePersistence: true
    });
    expect(() => logger.log(logger.createEntry('verify', 'x', { meta: {} })))
      .toThrow(AuditPersistenceError);
  });
});
