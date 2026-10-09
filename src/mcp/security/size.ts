/**
 * Serialized-response size budget.
 *
 * Individual field caps (LIMITS.maxTextFieldChars / maxOutputItems)
 * bound each array and string, but don't bound the whole response. This
 * module enforces an explicit serialized-bytes ceiling on the final
 * structuredContent payload — measured, not estimated.
 */

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

/**
 * Max serialized structuredContent bytes. Read lazily so tests can
 * stub the env per call. Default 256 KiB — comfortably above typical
 * results while bounding pathological outputs.
 */
export function getMaxOutputBytes(): number {
  return envInt('LLMVERIFY_MCP_MAX_OUTPUT_BYTES', 256 * 1024);
}

export function measureBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), 'utf-8');
}

export interface OutputSizeError extends Error {
  code: 'MCP_ADAPTER_OUTPUT_TOO_LARGE';
}

export function outputSizeError(
  actualBytes: number,
  budgetBytes: number,
  context?: string
): OutputSizeError {
  const err = new Error(
    `Serialized tool result is ${actualBytes} bytes, exceeding the ` +
      `${budgetBytes}-byte response budget (LLMVERIFY_MCP_MAX_OUTPUT_BYTES)` +
      (context ? ` — ${context}` : '')
  ) as OutputSizeError;
  err.name = 'OutputSizeError';
  err.code = 'MCP_ADAPTER_OUTPUT_TOO_LARGE';
  return err;
}

/**
 * If `structured` fits the budget, return it unchanged. Otherwise apply
 * `degrade` (progressive size reduction the caller defines, e.g. drop
 * bulky pass-through sections) and re-measure. Throws OutputSizeError
 * when still over budget — callers translate to an isError result.
 *
 * Nothing is dropped silently: `degrade` must record each removal in
 * the payload's `output.truncations`.
 */
export function enforceResponseBudget<T extends Record<string, unknown>>(
  structured: T,
  degrade: (value: T) => T
): T {
  const budget = getMaxOutputBytes();
  if (measureBytes(structured) <= budget) return structured;
  const degraded = degrade(structured);
  const finalBytes = measureBytes(degraded);
  if (finalBytes > budget) {
    throw outputSizeError(finalBytes, budget);
  }
  return degraded;
}
