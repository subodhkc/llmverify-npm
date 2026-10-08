/**
 * VerifyResult Contract (schema version 1.0)
 *
 * Canonical, dependency-free validation for verify() output.
 * The JSON Schema published at schema/verify-result.schema.json
 * describes the same contract; this module provides a runtime
 * validator for consumers that do not ship a JSON Schema engine.
 *
 * Compatibility: schemaVersion '1.0' covers every VerifyResult shape
 * emitted by llmverify >= 1.0. Fields added in later releases are
 * optional and never change the meaning of existing fields.
 *
 * @module result-contract
 * @author Haiec
 * @license MIT
 */

import * as fs from 'fs';
import * as path from 'path';

/** Result contract version emitted by verify() (independent of package version). */
export const RESULT_SCHEMA_VERSION = '1.0';

/** Filename of the packaged JSON Schema for result contract 1.0. */
export const RESULT_SCHEMA_FILE = 'verify-result.schema.json';

const RISK_LEVELS = new Set(['low', 'moderate', 'high', 'critical']);
const RISK_ACTIONS = new Set(['allow', 'review', 'block']);
const SEVERITIES = new Set(['info', 'low', 'medium', 'high', 'critical']);
const CATEGORIES = new Set(['security', 'privacy', 'safety', 'fairness', 'reliability', 'governance']);
const SURFACES = new Set(['input', 'output', 'behavior']);
const CONFIDENCE_METHODS = new Set(['heuristic', 'bootstrap', 'bayesian', 'empirical']);
const AUDIT_STATUSES = new Set(['PERSISTED', 'DISABLED', 'FAILED', 'NOT_ATTEMPTED']);

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isNumber(v: unknown): boolean {
  return typeof v === 'number' && Number.isFinite(v);
}

function isStringArray(v: unknown): boolean {
  return Array.isArray(v) && v.every(item => typeof item === 'string');
}

function checkConfidence(v: unknown, path: string, errors: string[]): void {
  if (!isObject(v)) { errors.push(`${path}: expected confidence object`); return; }
  if (!isNumber(v.value)) errors.push(`${path}.value: expected number`);
  if (!Array.isArray(v.interval) || v.interval.length !== 2 || !v.interval.every(isNumber)) {
    errors.push(`${path}.interval: expected [number, number]`);
  }
  if (typeof v.method !== 'string' || !CONFIDENCE_METHODS.has(v.method)) {
    errors.push(`${path}.method: expected one of ${[...CONFIDENCE_METHODS].join(', ')}`);
  }
}

function checkFinding(v: unknown, path: string, errors: string[]): void {
  if (!isObject(v)) { errors.push(`${path}: expected finding object`); return; }
  if (typeof v.id !== 'string') errors.push(`${path}.id: expected string`);
  if (typeof v.category !== 'string' || !CATEGORIES.has(v.category)) {
    errors.push(`${path}.category: invalid category`);
  }
  if (typeof v.severity !== 'string' || !SEVERITIES.has(v.severity)) {
    errors.push(`${path}.severity: invalid severity`);
  }
  if (typeof v.surface !== 'string' || !SURFACES.has(v.surface)) {
    errors.push(`${path}.surface: invalid surface`);
  }
  if (typeof v.message !== 'string') errors.push(`${path}.message: expected string`);
  if (typeof v.recommendation !== 'string') errors.push(`${path}.recommendation: expected string`);
  checkConfidence(v.confidence, `${path}.confidence`, errors);
  if (!isStringArray(v.limitations)) errors.push(`${path}.limitations: expected string[]`);
  if (typeof v.methodology !== 'string') errors.push(`${path}.methodology: expected string`);
}

/**
 * Validate a value against the VerifyResult contract (schema 1.0).
 *
 * Returns { valid, errors } — errors are human-readable paths, never
 * thrown. Unknown additional properties are permitted (forward
 * compatibility).
 */
export function validateVerifyResult(value: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!isObject(value)) {
    return { valid: false, errors: ['result: expected object'] };
  }

  // schemaVersion
  if (typeof value.schemaVersion !== 'string') {
    errors.push('schemaVersion: expected string (e.g. "1.0")');
  }

  // risk
  if (!isObject(value.risk)) {
    errors.push('risk: required object missing');
  } else {
    const risk = value.risk;
    if (!isNumber(risk.overall)) errors.push('risk.overall: expected number');
    if (typeof risk.level !== 'string' || !RISK_LEVELS.has(risk.level)) {
      errors.push('risk.level: invalid level');
    }
    if (typeof risk.action !== 'string' || !RISK_ACTIONS.has(risk.action)) {
      errors.push('risk.action: invalid action');
    }
    if (!isObject(risk.components)) {
      errors.push('risk.components: expected object');
    } else {
      for (const k of ['hallucination', 'consistency', 'csm6'] as const) {
        if (!isNumber(risk.components[k])) errors.push(`risk.components.${k}: expected number`);
      }
      if (risk.components.json !== undefined && !isNumber(risk.components.json)) {
        errors.push('risk.components.json: expected number when present');
      }
    }
    if (!isStringArray(risk.blockers)) errors.push('risk.blockers: expected string[]');
    checkConfidence(risk.confidence, 'risk.confidence', errors);
    if (typeof risk.interpretation !== 'string') errors.push('risk.interpretation: expected string');
  }

  // meta
  if (!isObject(value.meta)) {
    errors.push('meta: required object missing');
  } else {
    const meta = value.meta;
    if (typeof meta.verification_id !== 'string') errors.push('meta.verification_id: expected string');
    if (typeof meta.timestamp !== 'string') errors.push('meta.timestamp: expected string');
    if (!isNumber(meta.latency_ms)) errors.push('meta.latency_ms: expected number');
    if (typeof meta.version !== 'string') errors.push('meta.version: expected string');
    if (typeof meta.tier !== 'string') errors.push('meta.tier: expected string');
    if (!isStringArray(meta.enginesUsed)) errors.push('meta.enginesUsed: expected string[]');
  }

  // limitations / notChecked
  if (!isStringArray(value.limitations)) errors.push('limitations: expected string[]');
  if (!isStringArray(value.notChecked)) errors.push('notChecked: expected string[]');

  // optional arrays
  if (value.warnings !== undefined && !isStringArray(value.warnings)) {
    errors.push('warnings: expected string[] when present');
  }

  // optional engine results
  if (value.hallucination !== undefined) {
    const h = value.hallucination;
    if (!isObject(h)) {
      errors.push('hallucination: expected object');
    } else {
      if (!Array.isArray(h.claims)) errors.push('hallucination.claims: expected array');
      if (!Array.isArray(h.suspiciousClaims)) errors.push('hallucination.suspiciousClaims: expected array');
      if (!isNumber(h.riskScore)) errors.push('hallucination.riskScore: expected number');
      checkConfidence(h.confidence, 'hallucination.confidence', errors);
      if (!isObject(h.riskIndicators)) errors.push('hallucination.riskIndicators: expected object');
      if (!isStringArray(h.limitations)) errors.push('hallucination.limitations: expected string[]');
      if (typeof h.methodology !== 'string') errors.push('hallucination.methodology: expected string');
    }
  }

  if (value.consistency !== undefined) {
    const c = value.consistency;
    if (!isObject(c)) {
      errors.push('consistency: expected object');
    } else {
      if (!Array.isArray(c.sections)) errors.push('consistency.sections: expected array');
      if (!isNumber(c.avgSimilarity)) errors.push('consistency.avgSimilarity: expected number');
      if (typeof c.stable !== 'boolean') errors.push('consistency.stable: expected boolean');
      if (typeof c.drift !== 'boolean') errors.push('consistency.drift: expected boolean');
      if (!Array.isArray(c.contradictions)) errors.push('consistency.contradictions: expected array');
      checkConfidence(c.confidence, 'consistency.confidence', errors);
      if (!isStringArray(c.limitations)) errors.push('consistency.limitations: expected string[]');
      if (typeof c.methodology !== 'string') errors.push('consistency.methodology: expected string');
    }
  }

  if (value.json !== undefined) {
    const j = value.json;
    if (!isObject(j)) {
      errors.push('json: expected object');
    } else {
      if (typeof j.valid !== 'boolean') errors.push('json.valid: expected boolean');
      if (typeof j.schemaValid !== 'boolean') errors.push('json.schemaValid: expected boolean');
      if (!isStringArray(j.schemaErrors)) errors.push('json.schemaErrors: expected string[]');
      if (typeof j.repaired !== 'boolean') errors.push('json.repaired: expected boolean');
      if (!isObject(j.structure)) errors.push('json.structure: expected object');
      if (!isStringArray(j.limitations)) errors.push('json.limitations: expected string[]');
    }
  }

  if (value.csm6 !== undefined) {
    const c = value.csm6;
    if (!isObject(c)) {
      errors.push('csm6: expected object');
    } else {
      if (!Array.isArray(c.findings)) {
        errors.push('csm6.findings: expected array');
      } else {
        c.findings.forEach((f, i) => checkFinding(f, `csm6.findings[${i}]`, errors));
      }
      if (!isObject(c.summary)) {
        errors.push('csm6.summary: expected object');
      } else {
        if (!isNumber(c.summary.total)) errors.push('csm6.summary.total: expected number');
        if (!isObject(c.summary.bySeverity)) errors.push('csm6.summary.bySeverity: expected object');
        if (!isObject(c.summary.byCategory)) errors.push('csm6.summary.byCategory: expected object');
      }
      if (!isNumber(c.riskScore)) errors.push('csm6.riskScore: expected number');
      if (typeof c.passed !== 'boolean') errors.push('csm6.passed: expected boolean');
      if (typeof c.profile !== 'string') errors.push('csm6.profile: expected string');
      if (!isStringArray(c.checksPerformed)) errors.push('csm6.checksPerformed: expected string[]');
      if (!isStringArray(c.limitations)) errors.push('csm6.limitations: expected string[]');
    }
  }

  // optional audit receipt
  if (value.audit !== undefined) {
    const a = value.audit;
    if (!isObject(a)) {
      errors.push('audit: expected object');
    } else if (typeof a.status !== 'string' || !AUDIT_STATUSES.has(a.status)) {
      errors.push('audit.status: invalid persistence status');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Absolute path to the packaged JSON Schema for the VerifyResult
 * contract, or null when the schema directory is not installed
 * (e.g. a bundler that dropped non-code files).
 */
export function getVerifyResultSchemaPath(): string | null {
  const candidate = path.join(__dirname, '..', 'schema', RESULT_SCHEMA_FILE);
  return fs.existsSync(candidate) ? candidate : null;
}
