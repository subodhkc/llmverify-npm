/**
 * Serialized execution lane for stateful engine calls.
 *
 * The lane holds the REAL completion promise of the underlying work —
 * never a raced timeout. A caller that times out gets a
 * MCP_ADAPTER_TIMEOUT error, but the operation continues occupying the
 * lane until it actually settles, so a subsequent call can never start
 * while an earlier (timed-out) call is still mutating usage/audit/
 * baseline state.
 *
 * The queue is bounded: when `maxPending` calls are already in flight
 * or waiting, new calls fail fast with MCP_ADAPTER_QUEUE_FULL instead
 * of building an unbounded backlog.
 */

import { LIMITS, adapterTimeoutError } from './limits';

export interface LaneTimeoutError extends Error {
  code: 'MCP_ADAPTER_TIMEOUT';
}

export interface LaneQueueError extends Error {
  code: 'MCP_ADAPTER_QUEUE_FULL';
}

/** Caller deadline expired while the work was still QUEUED — it never ran. */
export interface LaneExpiredError extends Error {
  code: 'MCP_ADAPTER_QUEUE_EXPIRED';
  recoverable: true;
}

function queueExpiredError(ms: number): LaneExpiredError {
  const err = new Error(
    `Request expired in the execution queue after ${ms}ms without ` +
      'starting. The engine call was NEVER executed — it consumed no ' +
      'usage quota and produced no audit record. Safe to retry.'
  ) as LaneExpiredError;
  err.name = 'QueueExpiredError';
  err.code = 'MCP_ADAPTER_QUEUE_EXPIRED';
  err.recoverable = true;
  return err;
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export class ExecutionLane {
  /** Tail of the lane — always resolves; tracks real work completion. */
  private tail: Promise<unknown> = Promise.resolve();
  /** Calls queued or running. */
  private pending = 0;

  constructor(private readonly maxPending = envInt('LLMVERIFY_MCP_MAX_QUEUE_DEPTH', 16)) {}

  /** Current queued/running count — exposed for diagnostics/tests. */
  get pendingCount(): number {
    return this.pending;
  }

  /** Configured maximum queued/running calls. */
  get capacity(): number {
    return this.maxPending;
  }

  /**
   * Run `work` serialized, with a caller-facing timeout.
   *
   * Timeout semantics: the caller's promise rejects with
   * MCP_ADAPTER_TIMEOUT after `timeoutMs`, but the underlying work is
   * NOT cancelled (the engine has no abort hook) and continues to hold
   * the lane until it settles. We never claim a timed-out stateful
   * operation has stopped — the result is reported as timed out, and
   * `lastOutcome` records what eventually happened for diagnostics.
   */
  /**
   * Run `work` serialized, with a caller-facing deadline.
   *
   * Deadline semantics — two distinct outcomes:
   *
   * 1. Expired while QUEUED (`MCP_ADAPTER_QUEUE_EXPIRED`): the work
   *    never started and never will — the lane slot resolves as a
   *    skipped sentinel instead of invoking `work`, so an expired
   *    request cannot later consume usage quota or write audit state.
   *    This is a definite NOT-RUN; safe to retry.
   * 2. Timed out while RUNNING (`MCP_ADAPTER_TIMEOUT`): the engine has
   *    no abort hook, so the underlying call continues to hold the
   *    lane until it actually settles. Its outcome is INDETERMINATE —
   *    state may have been written; do not blindly retry.
   *
   * In both cases the lane frees the slot for subsequent work at the
   * correct moment (on expiry for queued work, on real completion for
   * running work) — later calls can never overlap a still-running one.
   */
  run<T>(
    work: () => Promise<T>,
    timeoutMs: number = LIMITS.toolTimeoutMs
  ): Promise<T> {
    if (this.pending >= this.maxPending) {
      const err = new Error(
        `Execution lane is full (${this.maxPending} pending calls) — retry later`
      ) as LaneQueueError;
      err.name = 'ExecutionQueueError';
      err.code = 'MCP_ADAPTER_QUEUE_FULL';
      return Promise.reject(err);
    }

    this.pending++;
    let started = false;
    let expired = false;

    // The lane tracks the REAL work — but only if it hasn't expired
    // in the queue first.
    const real = this.tail.then(() => {
      if (expired) {
        throw queueExpiredError(timeoutMs);
      }
      started = true;
      return work();
    });

    this.tail = real
      .then(
        () => undefined,
        () => undefined
      )
      .finally(() => {
        this.pending--;
      });

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (!started) expired = true;
        reject(
          started
            ? adapterTimeoutError(timeoutMs)
            : queueExpiredError(timeoutMs)
        );
      }, timeoutMs);
      if (typeof timer === 'object' && 'unref' in timer) timer.unref();
      real.then(
        (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        (e) => {
          clearTimeout(timer);
          reject(e);
        }
      );
    });
  }
}

/** Shared lane for verify() calls — the only stateful engine path. */
export const verifyLane = new ExecutionLane();

export { adapterTimeoutError };
