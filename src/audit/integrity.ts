/**
 * Audit Integrity & Persistence Contract
 *
 * Shared primitives used by BOTH audit implementations
 * (src/audit/index.ts and src/logging/audit.ts) so that hashing,
 * canonical serialization, and persistence reporting are identical.
 *
 * Semantics:
 * - A content hash establishes WHICH content was audited. It is not a
 *   digital signature and does not prove producer authenticity.
 * - An entry digest establishes that an audit record has not been
 *   modified after writing. It detects tampering of stored records;
 *   it does not prove who produced the record.
 * - Persistence status describes what actually happened to the write,
 *   never what was merely configured.
 *
 * @module audit/integrity
 * @author Haiec
 * @license MIT
 */

import * as crypto from 'crypto';

/**
 * Result of an audit persistence attempt.
 * Describes the ACTUAL outcome, not merely the configuration.
 */
export type AuditPersistenceStatus =
  | 'PERSISTED'      // Entry was appended to the audit file
  | 'DISABLED'       // Audit logging is disabled by configuration
  | 'FAILED'         // Persistence was attempted and failed
  | 'NOT_ATTEMPTED'; // No persistence target was configured

/**
 * Structured receipt for an audit write attempt.
 */
export interface AuditWriteResult {
  /** What actually happened */
  status: AuditPersistenceStatus;
  /** File the entry was appended to (PERSISTED only) */
  filePath?: string;
  /** Error message when status is FAILED */
  error?: string;
  /** Integrity digest of the stored entry (sha256:<hex> over canonical form) */
  entryDigest?: string;
  /** When the write was attempted */
  timestamp: string;
}

/**
 * Schema version for audit record digests. Bump when the canonical
 * serialization or digest fields change so historical records remain
 * interpretable.
 */
export const AUDIT_DIGEST_SCHEMA_VERSION = '1.0';

/**
 * Canonical JSON serialization: object keys are sorted recursively so
 * that logically identical values always produce identical bytes.
 * Used for all structured evidence digests.
 */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  // Skip undefined-valued keys: JSON.stringify drops them, so the
  // canonical form must match what is actually persisted.
  const keys = Object.keys(obj).filter(k => obj[k] !== undefined).sort();
  const parts = keys.map(k => `${JSON.stringify(k)}:${canonicalize(obj[k])}`);
  return `{${parts.join(',')}}`;
}

export type ContentHashAlgorithm = 'sha256' | 'hmac-sha256' | 'legacy';

/**
 * Hash content for audit records.
 *
 * Output is always prefixed with the algorithm so stored hashes are
 * self-describing and historical interpretations are never ambiguous:
 *   - 'sha256:<64 hex>'      — unkeyed SHA-256 (default)
 *   - 'hmac-sha256:<64 hex>' — keyed HMAC-SHA256 (use for low-entropy or
 *                             sensitive content where an unkeyed digest
 *                             could be recovered by guessing)
 *   - 'legacy:<8 hex>'       — deprecated non-cryptographic hash, retained
 *                             only to reproduce pre-1.7 records
 *
 * WARNING: an unkeyed content hash of low-entropy content (e.g. "yes",
 * a short name) can be reversed by brute-force guessing. Prefer
 * includeContentHash=false or a keyed hash for sensitive workloads.
 */
export function hashContent(
  content: string,
  options: { algorithm?: ContentHashAlgorithm; key?: string } = {}
): string {
  const algorithm = options.algorithm || 'sha256';

  if (algorithm === 'legacy') {
    return `legacy:${legacyHash(content)}`;
  }

  if (algorithm === 'hmac-sha256') {
    if (!options.key) {
      throw new Error('hmac-sha256 requires a key');
    }
    const digest = crypto.createHmac('sha256', options.key).update(content, 'utf-8').digest('hex');
    return `hmac-sha256:${digest}`;
  }

  return `sha256:${crypto.createHash('sha256').update(content, 'utf-8').digest('hex')}`;
}

/**
 * Compute the integrity digest for an audit entry.
 * Covers the canonical serialization of the entry WITHOUT any existing
 * integrity block, so verification can recompute it on stored records.
 */
export function digestAuditEntry(entry: Record<string, unknown>): string {
  const { integrity: _ignored, ...rest } = entry as { integrity?: unknown };
  const canonical = canonicalize(rest);
  return `sha256:${crypto.createHash('sha256').update(canonical, 'utf-8').digest('hex')}`;
}

/**
 * Integrity block embedded in stored audit entries (v1.0+).
 */
export interface AuditEntryIntegrity {
  /** Digest schema version — governs canonicalization rules */
  digestSchemaVersion: string;
  /** Algorithm used for entryDigest */
  digestAlgorithm: 'sha256';
  /** sha256:<hex> over the canonical entry (excluding this block) */
  entryDigest: string;
}

/**
 * Attach an integrity block to an entry (mutates a copy).
 */
export function withIntegrity<T extends Record<string, unknown>>(entry: T): T & { integrity: AuditEntryIntegrity } {
  const entryDigest = digestAuditEntry(entry);
  return {
    ...entry,
    integrity: {
      digestSchemaVersion: AUDIT_DIGEST_SCHEMA_VERSION,
      digestAlgorithm: 'sha256',
      entryDigest
    }
  };
}

/**
 * Verify a stored audit entry's integrity digest.
 * Returns true when the entry was written with a digest that still
 * matches its content. Entries without an integrity block are legacy
 * records — they cannot be verified and return false.
 */
export function verifyAuditEntry(entry: Record<string, unknown>): boolean {
  const integrity = (entry as { integrity?: AuditEntryIntegrity }).integrity;
  if (!integrity || integrity.digestAlgorithm !== 'sha256' || !integrity.entryDigest) {
    return false;
  }
  const expected = digestAuditEntry(entry);
  // Constant-time comparison to avoid trivial timing oracles
  const a = Buffer.from(integrity.entryDigest, 'utf-8');
  const b = Buffer.from(expected, 'utf-8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Legacy non-cryptographic hash (pre-1.7 src/audit implementation).
 * Retained ONLY to reproduce/interpret historical records — do not use
 * for new records where integrity is claimed.
 */
export function legacyHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Build a successful/failed persistence receipt.
 */
export function persistenceResult(
  status: AuditPersistenceStatus,
  extra: Partial<AuditWriteResult> = {}
): AuditWriteResult {
  return { status, timestamp: new Date().toISOString(), ...extra };
}
