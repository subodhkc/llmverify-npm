/**
 * Audit integrity tests — hashing, canonical serialization, tamper
 * detection, and consistent behavior across both audit implementations.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  canonicalize,
  hashContent,
  digestAuditEntry,
  verifyAuditEntry,
  withIntegrity,
  legacyHash,
  AUDIT_DIGEST_SCHEMA_VERSION
} from '../src/audit/integrity';
import { AuditLogger as AuditLoggerV2 } from '../src/logging/audit';
import { AuditLogger as AuditLoggerV1 } from '../src/audit';

function tmpdir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'llmverify-audit-'));
}

describe('audit integrity primitives', () => {
  describe('canonicalize', () => {
    it('produces identical output regardless of key order', () => {
      const a = canonicalize({ b: 1, a: { d: [3, 2], c: 'x' } });
      const b = canonicalize({ a: { c: 'x', d: [3, 2] }, b: 1 });
      expect(a).toBe(b);
    });

    it('is deterministic for nested structures', () => {
      const obj = { z: [{ y: 2, x: 1 }], a: 'v' };
      expect(canonicalize(obj)).toBe(canonicalize(JSON.parse(JSON.stringify(obj))));
    });
  });

  describe('hashContent', () => {
    it('defaults to self-describing sha256', () => {
      const h = hashContent('hello');
      expect(h).toMatch(/^sha256:[0-9a-f]{64}$/);
    });

    it('supports keyed HMAC hashing', () => {
      const h = hashContent('hello', { algorithm: 'hmac-sha256', key: 'k1' });
      expect(h).toMatch(/^hmac-sha256:[0-9a-f]{64}$/);
      // Different key → different digest
      expect(hashContent('hello', { algorithm: 'hmac-sha256', key: 'k2' })).not.toBe(h);
    });

    it('hmac-sha256 requires a key', () => {
      expect(() => hashContent('x', { algorithm: 'hmac-sha256' })).toThrow();
    });

    it('legacy algorithm reproduces the pre-1.7 hash (explicitly labelled)', () => {
      const h = hashContent('hello', { algorithm: 'legacy' });
      expect(h).toBe(`legacy:${legacyHash('hello')}`);
    });
  });

  describe('entry digests', () => {
    it('verifies an entry written with integrity block', () => {
      const entry = withIntegrity({
        timestamp: '2026-01-01T00:00:00.000Z',
        requestId: 'r1',
        operation: 'verify',
        input: { contentLength: 5, contentHash: 'sha256:x', hasPrompt: false },
        output: { riskLevel: 'low', findingsCount: 0, blocked: false },
        metadata: { version: '1.7.0', duration: 1, enginesUsed: [], configTier: 'free' }
      });
      expect(verifyAuditEntry(entry)).toBe(true);
      expect(entry.integrity.digestAlgorithm).toBe('sha256');
      expect(entry.integrity.digestSchemaVersion).toBe(AUDIT_DIGEST_SCHEMA_VERSION);
      expect(entry.integrity.entryDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
    });

    it('detects tampering', () => {
      const entry = withIntegrity({ a: 1, b: 'x' });
      const tampered = { ...entry, b: 'y' };
      expect(verifyAuditEntry(tampered)).toBe(false);
    });

    it('detects tampered digest field', () => {
      const entry = withIntegrity({ a: 1 });
      const forged = {
        ...entry,
        integrity: { ...entry.integrity, entryDigest: 'sha256:' + '0'.repeat(64) }
      };
      expect(verifyAuditEntry(forged)).toBe(false);
    });

    it('returns false for legacy entries without integrity blocks', () => {
      expect(verifyAuditEntry({ a: 1 })).toBe(false);
    });
  });
});

describe('AuditLoggerV2 (src/logging/audit.ts)', () => {
  it('writes entries with integrity digests that verify', () => {
    const dir = tmpdir();
    const logger = new AuditLoggerV2({ enabled: true, auditDir: dir });
    const res = logger.logVerification({
      requestId: 'r1',
      content: 'secret content',
      riskLevel: 'low',
      findingsCount: 0,
      blocked: false,
      duration: 5,
      enginesUsed: ['csm6'],
      configTier: 'free'
    });
    expect(res.status).toBe('PERSISTED');
    expect(res.entryDigest).toMatch(/^sha256:/);

    const entries = logger.readAudit();
    expect(entries.length).toBe(1);
    expect(entries[0].integrity?.entryDigest).toBe(res.entryDigest);
    expect(entries[0].input.contentHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(entries[0].input.contentHashAlgorithm).toBe('sha256');
    // Raw content must never appear in the record
    expect(JSON.stringify(entries[0])).not.toContain('secret content');
  });

  it('verifyAuditFile detects tampering', () => {
    const dir = tmpdir();
    const logger = new AuditLoggerV2({ enabled: true, auditDir: dir });
    logger.logVerification({
      requestId: 'r1', content: 'a', riskLevel: 'low', findingsCount: 0,
      blocked: false, duration: 1, enginesUsed: [], configTier: 'free'
    });
    logger.logVerification({
      requestId: 'r2', content: 'b', riskLevel: 'low', findingsCount: 0,
      blocked: false, duration: 1, enginesUsed: [], configTier: 'free'
    });

    const file = path.join(dir, `audit-${new Date().toISOString().split('T')[0]}.jsonl`);
    // Tamper with the first record
    const lines = fs.readFileSync(file, 'utf-8').split('\n').filter(Boolean);
    const first = JSON.parse(lines[0]);
    first.output.riskLevel = 'critical';
    fs.writeFileSync(file, JSON.stringify(first) + '\n' + lines.slice(1).join('\n') + '\n');

    const report = logger.verifyAuditFile();
    expect(report.totalEntries).toBe(2);
    expect(report.verified).toBe(1);
    expect(report.tampered).toEqual([0]);
  });

  it('uses keyed hashing when hashKey is configured', () => {
    const dir = tmpdir();
    const logger = new AuditLoggerV2({ enabled: true, auditDir: dir, hashKey: 'test-key' });
    logger.logVerification({
      requestId: 'r1', content: 'x', riskLevel: 'low', findingsCount: 0,
      blocked: false, duration: 1, enginesUsed: [], configTier: 'free'
    });
    const entries = logger.readAudit();
    expect(entries[0].input.contentHash).toMatch(/^hmac-sha256:/);
    expect(entries[0].input.contentHashAlgorithm).toBe('hmac-sha256');
  });

  it('omits content hash when includeContentHash is false', () => {
    const dir = tmpdir();
    const logger = new AuditLoggerV2({ enabled: true, auditDir: dir, includeContentHash: false });
    logger.logVerification({
      requestId: 'r1', content: 'x', riskLevel: 'low', findingsCount: 0,
      blocked: false, duration: 1, enginesUsed: [], configTier: 'free'
    });
    const entries = logger.readAudit();
    expect(entries[0].input.contentHash).toBe('');
    expect(entries[0].input.contentHashAlgorithm).toBe('none');
  });
});

describe('AuditLoggerV1 (src/audit/index.ts)', () => {
  it('emits sha256-labelled content hashes by default', () => {
    const file = path.join(tmpdir(), 'audit.jsonl');
    const logger = new AuditLoggerV1({ enabled: true, outputPath: file });
    const entry = logger.createEntry('verify', 'content here', {
      risk: { level: 'low', overall: 0.1, action: 'allow' },
      findings: [],
      meta: { latency_ms: 5, enginesUsed: [] }
    });
    expect(entry.input.contentHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(entry.input.contentHashAlgorithm).toBe('sha256');
  });

  it('supports explicit legacy hash interpretation', () => {
    const logger = new AuditLoggerV1({
      enabled: true,
      outputPath: path.join(tmpdir(), 'audit.jsonl'),
      hashAlgorithm: 'legacy'
    });
    const entry = logger.createEntry('verify', 'abc', {
      risk: { level: 'low', overall: 0, action: 'allow' },
      meta: {}
    });
    expect(entry.input.contentHash).toBe(`legacy:${legacyHash('abc')}`);
    expect(entry.input.contentHashAlgorithm).toBe('legacy');
  });

  it('exposes persistence outcome via logDetailed / getLastPersistence', () => {
    const file = path.join(tmpdir(), 'audit.jsonl');
    const logger = new AuditLoggerV1({ enabled: true, outputPath: file });
    const { entry, persistence } = logger.logDetailed(logger.createEntry('verify', 'x', { meta: {} }));
    expect(entry.id).not.toBe('');
    expect(persistence.status).toBe('PERSISTED');
    expect(persistence.filePath).toBe(file);
    expect(logger.getLastPersistence().status).toBe('PERSISTED');
  });

  it('reports DISABLED when logging is off', () => {
    const logger = new AuditLoggerV1({ enabled: false, outputPath: path.join(tmpdir(), 'a.jsonl') });
    const { entry, persistence } = logger.logDetailed(logger.createEntry('verify', 'x', { meta: {} }));
    expect(entry.id).toBe('');
    expect(persistence.status).toBe('DISABLED');
  });

  it('reports NOT_ATTEMPTED when no outputPath is configured', () => {
    const logger = new AuditLoggerV1({ enabled: true, outputPath: undefined });
    const { persistence } = logger.logDetailed(logger.createEntry('verify', 'x', { meta: {} }));
    expect(persistence.status).toBe('NOT_ATTEMPTED');
  });
});
