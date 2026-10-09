/**
 * Output bounding and privacy post-processing.
 *
 * Engine output arrays (findings, claims, contradictions, ...) can grow
 * with input size. Every tool result passes through bound helpers that
 * cap array lengths and text fields, and record what was omitted in
 * `truncations` — nothing is dropped silently.
 */

import { LIMITS } from './limits';
import { redactPII } from '../../index';

export interface TruncationRecord {
  /** JSON-path-ish location of the bounded array or field. */
  path: string;
  /** Number of items/characters omitted. */
  omitted: number;
}

export interface TruncationReport {
  truncated: boolean;
  truncations: TruncationRecord[];
}

/**
 * Privacy projection for engine output.
 *
 * Several VerifyResult fields echo caller-supplied content:
 * hallucination claim text, consistency sections/contradictions, JSON
 * schema-error strings, and CSM6 finding evidence. The engine's own
 * `evidence.textSample` is only PARTIALLY masked (keeps a prefix and
 * suffix of the matched value) and `evidence.context` is a raw excerpt
 * that can contain the match and adjacent PII verbatim.
 *
 * This scrubber reuses the engine's exported `redactPII()` (the same
 * pattern set detection uses — no second implementation) to replace
 * matched sensitive values in any input-echoing field, and hard-masks
 * `textSample` on privacy-category findings where the sample IS the
 * sensitive value. `maskedFields` counts fields that changed — recorded
 * in the response's `privacy` metadata so masking is provable, never
 * silent. Not exhaustive: novel PII formats the engine does not detect
 * still pass through.
 */
export class PrivacyScrubber {
  maskedFields = 0;

  /** Replace engine-detected PII inside an input-echoing string. */
  scrub(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const { redacted, piiCount } = redactPII(value);
    if (piiCount > 0) this.maskedFields++;
    return redacted;
  }
}

export class TruncationTracker {
  private records: TruncationRecord[] = [];

  bound<T>(items: readonly T[] | undefined, path: string): T[] {
    if (!items) return [];
    if (items.length <= LIMITS.maxOutputItems) return [...items];
    this.records.push({
      path,
      omitted: items.length - LIMITS.maxOutputItems
    });
    return items.slice(0, LIMITS.maxOutputItems);
  }

  text(value: unknown, path: string): string | undefined {
    if (typeof value !== 'string') return undefined;
    if (value.length <= LIMITS.maxTextFieldChars) return value;
    this.records.push({
      path,
      omitted: value.length - LIMITS.maxTextFieldChars
    });
    return `${value.slice(0, LIMITS.maxTextFieldChars)}… [truncated]`;
  }

  report(): TruncationReport {
    return { truncated: this.records.length > 0, truncations: this.records };
  }
}

/**
 * Bound a VerifyResult-shaped object for transport: caps every known
 * output array and long text field without altering semantics.
 * Returns `{ result, output }` where `result` is the bounded copy.
 */
export function boundVerifyResult(result: any): {
  result: any;
  output: TruncationReport;
  privacy: { piiFieldsMasked: number; policy: string };
} {
  const t = new TruncationTracker();
  const p = new PrivacyScrubber();
  const bounded: any = { ...result };

  if (result.hallucination) {
    const h = result.hallucination;
    bounded.hallucination = {
      ...h,
      claims: t
        .bound(h.claims, 'hallucination.claims')
        .map(boundClaim(t, p, 'hallucination.claims')),
      suspiciousClaims: t
        .bound(h.suspiciousClaims, 'hallucination.suspiciousClaims')
        .map(boundClaim(t, p, 'hallucination.suspiciousClaims'))
    };
  }

  if (result.consistency) {
    const c = result.consistency;
    bounded.consistency = {
      ...c,
      sections: t
        .bound(c.sections, 'consistency.sections')
        .map((s: unknown, i: number) =>
          p.scrub(t.text(s, `consistency.sections[${i}]`))
        ),
      contradictions: t
        .bound(c.contradictions, 'consistency.contradictions')
        .map((cd: any, i: number) => ({
          ...cd,
          claim1: p.scrub(
            t.text(cd?.claim1, `consistency.contradictions[${i}].claim1`)
          ),
          claim2: p.scrub(
            t.text(cd?.claim2, `consistency.contradictions[${i}].claim2`)
          )
        })),
      // Similarity matrix can be O(n²) — drop it for transport, note it.
      similarityMatrix: undefined
    };
  }

  if (result.json) {
    const j = result.json;
    bounded.json = {
      ...j,
      // Validator messages may quote offending JSON — scrub them.
      schemaErrors: t
        .bound(j.schemaErrors, 'json.schemaErrors')
        .map((e: unknown) => p.scrub(e)),
      // `parsed` echoes the input document; too large for tool output.
      parsed: undefined
    };
  }

  if (result.csm6) {
    const s = result.csm6;
    bounded.csm6 = {
      ...s,
      findings: t
        .bound(s.findings, 'csm6.findings')
        .map(boundFinding(t, p, 'csm6.findings'))
    };
  }

  if (result.risk && typeof result.risk === 'object') {
    bounded.risk = {
      ...result.risk,
      interpretation: p.scrub(result.risk.interpretation)
    };
  }

  bounded.limitations = t.bound(result.limitations, 'limitations');
  bounded.notChecked = t.bound(result.notChecked, 'notChecked');
  if (result.warnings) {
    bounded.warnings = t
      .bound(result.warnings, 'warnings')
      .map((w: unknown) => p.scrub(w));
  }

  return {
    result: bounded,
    output: t.report(),
    privacy: {
      piiFieldsMasked: p.maskedFields,
      policy:
        'engine-redactPII on input-echoing fields; hard mask on ' +
        'privacy-finding textSample; not exhaustive'
    }
  };
}

function boundClaim(t: TruncationTracker, p: PrivacyScrubber, base: string) {
  return (claim: any, i: number) => ({
    ...claim,
    text: p.scrub(t.text(claim?.text, `${base}[${i}].text`)),
    limitations: t.bound(claim?.limitations, `${base}[${i}].limitations`)
  });
}

function boundFinding(t: TruncationTracker, p: PrivacyScrubber, base: string) {
  return (finding: any, i: number) => ({
    ...finding,
    message: t.text(finding?.message, `${base}[${i}].message`),
    recommendation: t.text(
      finding?.recommendation,
      `${base}[${i}].recommendation`
    ),
    evidence: boundEvidence(t, p, `${base}[${i}].evidence`, finding),
    limitations: t.bound(finding?.limitations, `${base}[${i}].limitations`)
  });
}

/**
 * Evidence handling for verify() findings:
 * - privacy-category findings: `textSample` is the sensitive match
 *   itself (the engine only partial-masks it) → hard '[REDACTED]';
 *   `context` is a raw excerpt → PII-scrubbed.
 * - other findings (injection etc.): text fields echo input but are
 *   usually benign → PII-scrubbed, not hard-masked, so they stay useful.
 */
function boundEvidence(
  t: TruncationTracker,
  p: PrivacyScrubber,
  path: string,
  finding: any
): any {
  const evidence = finding?.evidence;
  if (!evidence || typeof evidence !== 'object') return evidence;
  const isPrivacyFinding =
    finding?.category === 'privacy' ||
    (typeof finding?.id === 'string' && finding.id.startsWith('PII_'));
  return {
    ...evidence,
    textSample: isPrivacyFinding
      ? '[REDACTED]'
      : p.scrub(t.text(evidence.textSample, `${path}.textSample`)),
    context: p.scrub(t.text(evidence.context, `${path}.context`))
  };
}

/**
 * Findings that may contain the actual sensitive values (PII scan
 * results). For these, evidence text samples are masked rather than
 * truncated — a PII tool must not echo the PII it found.
 */
export function maskFindingEvidence(finding: any): any {
  if (!finding || typeof finding !== 'object') return finding;
  const masked = { ...finding };
  if (masked.evidence && typeof masked.evidence === 'object') {
    masked.evidence = { ...masked.evidence };
    if (masked.evidence.textSample !== undefined) {
      masked.evidence.textSample = '[REDACTED]';
    }
    if (masked.evidence.context !== undefined) {
      masked.evidence.context = '[REDACTED]';
    }
  }
  return masked;
}
