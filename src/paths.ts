/**
 * Local State Path Resolution
 *
 * Centralized resolution of llmverify's local filesystem locations.
 * All state is local-only — nothing here performs network access.
 *
 * Resolution order (first wins):
 *   1. Specific env var (e.g. LLMVERIFY_AUDIT_DIR)
 *   2. LLMVERIFY_HOME (overrides the ~/.llmverify base directory)
 *   3. Default: <os.homedir()>/.llmverify/<subdir>
 *
 * Values are resolved lazily on each call so tests and embedders can set
 * environment variables before use.
 *
 * @module paths
 * @author Haiec
 * @license MIT
 */

import * as path from 'path';
import * as os from 'os';

/**
 * Base directory for all llmverify local state.
 * Honors LLMVERIFY_HOME; defaults to ~/.llmverify.
 */
export function getLLMVerifyHome(): string {
  const override = process.env.LLMVERIFY_HOME;
  if (override && override.trim().length > 0) {
    return override;
  }
  return path.join(os.homedir(), '.llmverify');
}

/** Directory for operational logs (LLMVERIFY_LOG_DIR overrides). */
export function getLogDir(): string {
  return process.env.LLMVERIFY_LOG_DIR || path.join(getLLMVerifyHome(), 'logs');
}

/** Directory for integrity-verifiable audit records (LLMVERIFY_AUDIT_DIR overrides). */
export function getAuditDir(): string {
  return process.env.LLMVERIFY_AUDIT_DIR || path.join(getLLMVerifyHome(), 'audit');
}

/** Directory for baseline/drift state (LLMVERIFY_BASELINE_DIR overrides). */
export function getBaselineDir(): string {
  return process.env.LLMVERIFY_BASELINE_DIR || path.join(getLLMVerifyHome(), 'baseline');
}

/** Usage counter file (LLMVERIFY_USAGE_FILE overrides). */
export function getUsageFile(): string {
  return process.env.LLMVERIFY_USAGE_FILE || path.join(getLLMVerifyHome(), 'usage.json');
}

/** Dashboard/CLI config directory (LLMVERIFY_CONFIG_DIR overrides). */
export function getConfigDir(): string {
  return process.env.LLMVERIFY_CONFIG_DIR || getLLMVerifyHome();
}
