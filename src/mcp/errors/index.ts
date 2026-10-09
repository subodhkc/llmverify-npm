/**
 * Safe error normalization.
 *
 * Tool handlers convert ALL thrown values into a CallToolResult with
 * `isError: true`. The structured `error` field carries a stable code
 * the client can branch on. Messages pass through sanitizeMessage()
 * so secrets and oversized payloads never reach the client.
 */

import { LIMITS } from '../security/limits';
import { redactPII } from '../../index';

export interface NormalizedToolError {
  name: string;
  code: string;
  message: string;
  /** True when the engine classifies this as a transient/quota error. */
  recoverable?: boolean;
  /** Extra machine-readable context (e.g. audit persistence status). */
  details?: Record<string, unknown>;
}

const SECRET_KEY_PATTERN =
  /(api[_-]?key|secret|token|password|credential|authorization|bearer|hashkey|hash[_-]?key)/i;

/** Remove likely secrets and bound the message length. */
export function sanitizeMessage(raw: string): string {
  // Redact key=value / "key": "value" pairs whose key looks secret-ish.
  let msg = raw.replace(
    new RegExp(
      `(${SECRET_KEY_PATTERN.source})\\s*[:=]\\s*["']?[^\\s"',}]+["']?`,
      'gi'
    ),
    '$1=[REDACTED]'
  );
  // Redact common high-entropy token shapes (sk-..., ghp_..., etc.).
  msg = msg.replace(
    /\b(sk-[A-Za-z0-9_-]{8,}|ghp_[A-Za-z0-9]{8,}|xox[bap]-[A-Za-z0-9-]{8,}|AKIA[0-9A-Z]{8,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})/g,
    '[REDACTED]'
  );
  if (msg.length > LIMITS.maxTextFieldChars) {
    msg = `${msg.slice(0, LIMITS.maxTextFieldChars)}… [truncated]`;
  }
  // Final privacy pass: if an engine error message echoes content
  // containing detectable PII, mask it. Uses the engine's own
  // redactPII — same pattern set as detection, no second scanner.
  return redactPII(msg).redacted;
}

interface EngineErrorShape {
  name?: string;
  code?: string | number;
  message?: string;
  severity?: string;
  recoverable?: boolean;
  details?: Record<string, unknown>;
}

/**
 * Convert an arbitrary thrown value into a NormalizedToolError.
 * Typed engine errors (LLMVerifyError subclasses) keep their code;
 * everything else collapses to an internal adapter error.
 */
export function normalizeError(err: unknown): NormalizedToolError {
  const e = (err ?? {}) as EngineErrorShape;

  if (e.name === 'AuditPersistenceError') {
    const details = (e.details ?? {}) as Record<string, unknown>;
    return {
      name: 'AuditPersistenceError',
      code: typeof e.code === 'string' ? e.code : 'AUDIT_PERSISTENCE_FAILED',
      message: sanitizeMessage(String(e.message ?? 'audit persistence required but not persisted')),
      recoverable: e.recoverable,
      details: {
        ...(typeof details.status === 'string' ? { status: details.status } : {}),
        ...(typeof details.filePath === 'string' ? { filePath: details.filePath } : {})
      }
    };
  }

  if ((err as AdapterTimeoutMarker)?.code === 'MCP_ADAPTER_TIMEOUT') {
    return {
      name: 'AdapterTimeoutError',
      code: 'MCP_ADAPTER_TIMEOUT',
      message: sanitizeMessage(String(e.message ?? 'tool execution timed out')),
      // Underlying work may still be running — outcome indeterminate.
      recoverable: true
    };
  }

  if ((err as AdapterTimeoutMarker)?.code === 'MCP_ADAPTER_QUEUE_EXPIRED') {
    return {
      name: 'QueueExpiredError',
      code: 'MCP_ADAPTER_QUEUE_EXPIRED',
      message: sanitizeMessage(
        String(e.message ?? 'request expired in queue before starting')
      ),
      // Definite NOT-RUN: safe to retry.
      recoverable: true
    };
  }

  if (typeof e.code === 'string' || typeof e.code === 'number') {
    return {
      name: String(e.name ?? 'LLMVerifyError'),
      code: String(e.code),
      message: sanitizeMessage(String(e.message ?? 'verification failed')),
      recoverable: e.recoverable
    };
  }

  return {
    name: 'InternalAdapterError',
    code: 'MCP_ADAPTER_INTERNAL',
    message: sanitizeMessage(
      `Unexpected adapter error: ${String(e.message ?? 'unknown')}`
    ),
    recoverable: true
  };
}

interface AdapterTimeoutMarker {
  code?: string;
}
