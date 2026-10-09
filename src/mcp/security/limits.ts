/**
 * Request and output limits for the MCP adapter.
 *
 * These bounds exist so an untrusted tool call cannot exhaust memory,
 * CPU, or response size on the host running this server. They are
 * deliberate adapter-layer limits — separate from (and smaller than)
 * the engine's own 10 MB absolute content ceiling.
 */

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export const LIMITS = {
  /**
   * Maximum characters accepted in a `content`/`input` tool argument.
   * Matches the engine's default free-tier content budget; raise via
   * env only when the deployment's tier limits support it.
   */
  maxInputChars: envInt('LLMVERIFY_MCP_MAX_INPUT_CHARS', 1_000_000),

  /**
   * Wall-clock ceiling for a single tool call. The engine enforces its
   * own per-engine timeout; this is the adapter-level safety net.
   */
  toolTimeoutMs: envInt('LLMVERIFY_MCP_TIMEOUT_MS', 60_000),

  /**
   * Maximum items returned in any single output array (findings,
   * claims, contradictions, ...). Omitted items are reported through
   * the `truncations` metadata field — never silently dropped.
   */
  maxOutputItems: envInt('LLMVERIFY_MCP_MAX_OUTPUT_ITEMS', 50),

  /**
   * Maximum characters of any single text field copied from engine
   * output into structuredContent (claim text, messages, evidence).
   */
  maxTextFieldChars: envInt('LLMVERIFY_MCP_MAX_TEXT_FIELD_CHARS', 2_000)
} as const;

export interface AdapterTimeoutError extends Error {
  code: 'MCP_ADAPTER_TIMEOUT';
}

export function adapterTimeoutError(ms: number): AdapterTimeoutError {
  const err = new Error(
    `Tool execution exceeded the adapter timeout of ${ms}ms. ` +
      'The underlying engine call is NOT cancelled — it continues in ' +
      'the serialized lane until it settles. The result is timed out, ' +
      'not terminated.'
  ) as AdapterTimeoutError;
  err.name = 'AdapterTimeoutError';
  err.code = 'MCP_ADAPTER_TIMEOUT';
  return err;
}

/** Race a promise against the adapter tool timeout. */
export async function withTimeout<T>(
  work: Promise<T>,
  ms: number = LIMITS.toolTimeoutMs
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(adapterTimeoutError(ms)), ms);
        // A pending timer must never keep the server process alive.
        if (typeof timer === 'object' && 'unref' in timer) timer.unref();
      })
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
