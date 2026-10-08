# LLMVerify — Contract Consistency, Audit Integrity & Privacy Hardening

Handoff for the hardening pass on branch
`fix/llmverify-contract-audit-hardening` (baseline: `llmverify@1.6.1`,
commit `6ecbef3`). Deliverable is a reviewable PR only — no release, no
merge, no tag changes.

## 1. Baseline findings

| Finding | Evidence |
|---|---|
| Published JSON Schema did not match runtime output | `schema/verify-result.schema.json` required `findings`, `engines`, `metadata`, `risk.score`; `verify()` actually returns `schemaVersion`, engine-keyed results, `risk.overall`, `meta`, `limitations`, `notChecked` |
| TypeScript declarations under-described runtime | `Claim.riskIndicators` missing `fabricatedStatRisk`, `overconfidenceRisk`, `fakeAuthorityRisk`, `combinedRisk`; no `audit` receipt field |
| Two divergent audit implementations | `src/audit/index.ts` (non-crypto string hash, disabled by default) vs `src/logging/audit.ts` (SHA-256, enabled by default, silent write failures) |
| Audit persistence failures invisible | Write errors were swallowed or only logged in development |
| Unsupported accuracy claims in runtime output | Methodology strings claimed "~60% recall", "~90% for standard formats", "~70-85% on known attacks" with no calibration evidence |
| `llmverify-serve` bin never started the server | `bin/llmverify-serve.js` did `require('../dist/server.js')`, but `server.ts` only starts under `require.main === module` — dead bin |
| Orphaned test suites | `tests/integration.test.js` and `tests/monitor.test.js` spawned `../start-server.js`, which did not exist (deleted in `d354337`); both failed 100% at baseline |
| Flaky shared-state test | `tests/usage-limit-2000.test.ts` raced on the shared `~/.llmverify/usage.json` across jest workers |

Baseline test result (on `main` @ `6ecbef3`): **28/31 suites, 648/672
tests passing** — failures were `integration.test.js`,
`monitor.test.js`, `usage-limit-2000.test.ts` (causes above).

## 2. Root causes

- Schema file was authored against an intended shape, not observed
  output; nothing enforced agreement between the two.
- The two audit modules grew independently; no shared integrity contract.
- Persistence was "best effort" with no receipt type, so callers could
  not distinguish PERSISTED/DISABLED/FAILED/NOT_ATTEMPTED.
- Test helpers hard-coded `os.homedir()` paths — no isolation knob.

## 3. Files changed

**New source**

- `src/paths.ts` — centralized local-state resolution (`LLMVERIFY_HOME`
  + per-directory env overrides; lazy resolution for test isolation).
- `src/audit/integrity.ts` — shared audit primitives: `canonicalize`,
  `hashContent` (`sha256` / `hmac-sha256` / `legacy`), `digestAuditEntry`,
  `verifyAuditEntry`, `withIntegrity`, `AuditWriteResult`,
  `AuditPersistenceStatus`, `persistenceResult`,
  `AUDIT_DIGEST_SCHEMA_VERSION`, `legacyHash` (interpretation only).
- `src/result-contract.ts` — `RESULT_SCHEMA_VERSION`, dependency-free
  `validateVerifyResult()`, `getVerifyResultSchemaPath()`.
- `src/capabilities.ts` — `getEngineCapabilities()`,
  `getPackageInfo()`, `EngineCapability` for downstream discovery.

**Modified source**

- `src/types/results.ts` — declarations aligned to real output (claim
  risk-indicator fields, `warnings`, `audit?: VerificationAuditStatus`).
- `src/logging/audit.ts` — uses shared integrity primitives; every write
  returns an `AuditWriteResult`; entries embed an `integrity` block
  (`digestSchemaVersion`, `digestAlgorithm`, `entryDigest`);
  `verifyAuditFile()` reports `verified` / `tampered` / `unverifiable`;
  `hashKey` → keyed `hmac-sha256`; `includeContentHash: false` → no
  content digest; env config `LLMVERIFY_AUDIT_HASH_KEY`,
  `LLMVERIFY_AUDIT_NO_CONTENT_HASH`, `LLMVERIFY_AUDIT_REQUIRED`.
- `src/audit/index.ts` — legacy API preserved; now delegates hashing to
  the shared primitives (`contentHashAlgorithm` field added;
  `hashAlgorithm` option incl. `'legacy'` for historical interpretation);
  `logDetailed()` / `getLastPersistence()` expose receipts.
- `src/verify.ts` — `audit` option (`requirePersistence`, `onResult`);
  `result.audit` receipt; accurate `notChecked` for the JSON engine on
  non-JSON input.
- `src/errors.ts`, `src/errors/codes.ts` — `AuditPersistenceError`,
  `AUDIT_PERSISTENCE_FAILED = LLMVERIFY_8001`.
- `src/logging/logger.ts` — env-aware log dir; stronger nested-object
  sanitization of secret/PII-shaped keys.
- `src/usage/tracker.ts` — `LLMVERIFY_USAGE_FILE`-aware usage file.
- `src/baseline/storage.ts` — `LLMVERIFY_BASELINE_DIR`-aware default.
- `src/cli.ts` — lazy config-dir resolution after the paths refactor.
- `src/csm6/security/{harmful-content,pii-detection,prompt-injection}.ts`
  — unsupported accuracy percentages replaced with evidence-qualified
  methodology text.
- `bin/llmverify-serve.js` — now actually calls `startServer()` with
  parsed `--port`/`--host` args (was a dead bin).

**New/updated tests**

- `tests/schema-contract.test.ts` — runtime validator + packaged JSON
  Schema agreement across engine configurations.
- `tests/helpers/json-schema-lite.ts` — draft-07 subset validator (no
  new runtime dependency).
- `tests/audit-integrity.test.ts` — hashing, canonicalization, tamper
  detection, both loggers.
- `tests/audit-persistence.test.ts` — PERSISTED/DISABLED/FAILED/
  NOT_ATTEMPTED, `requirePersistence` throw, rotation, recovery.
- `tests/privacy-logging.test.ts` — no raw content in audit, sanitizer
  coverage, env-based paths.
- `tests/module-compat.test.js` — CJS `require`, real-ESM `import`
  (spawned node), schema file presence, CLI smoke (`--version`,
  `doctor`).
- `tests/usage-limit-2000.test.ts` — isolated `LLMVERIFY_USAGE_FILE`
  per test (fixes the shared-state race).
- `tests/integration.test.js`, `tests/monitor.test.js` — repointed to
  `bin/llmverify-serve.js`, distinct ports (9009/9010), isolated
  `LLMVERIFY_HOME`, stale expectations aligned to real contract
  (`risk.components`, `summary` vs `error` envelope), keep-alive socket
  cleanup that previously crashed jest workers.

**Docs/schema**

- `schema/verify-result.schema.json` — rewritten to the real v1.0
  contract; `schema/verify-result-1.0.schema.json` — versioned copy.
- `docs/handoff/LLMVERIFY-MCP-READINESS.md` — adapter handoff (this
  package does not implement MCP).
- `CHANGELOG.md` — Unreleased section.

## 4. Before/after schema (abridged)

Before (published schema vs runtime):

```json
// schema required — did not exist at runtime:
"required": ["findings", "engines", "metadata", "risk.score"]
// runtime actually emitted:
{ "schemaVersion": "1.0", "csm6": {...}, "risk": { "overall": 0.44 },
  "meta": {...}, "notChecked": [...] }
```

After: `schema/verify-result.schema.json` requires exactly what
`verify()` emits — `schemaVersion`, `risk` (with `overall`, `level`,
`components`, `blockers`, `action`, `confidence`, `interpretation`),
`meta`, `limitations`, `notChecked`; engine results are optional.

## 5. API compatibility

- No existing exports removed or renamed. `verify()` signature is
  additive-only (`audit` option, `audit` receipt field on the result —
  both optional).
- `schemaVersion` stays `'1.0'`; `RESULT_SCHEMA_VERSION` is the
  canonical constant. Fields added are additive to a contract that
  already tolerated extra properties.
- `src/audit/index.ts` keeps its API; records gain a
  `contentHashAlgorithm` label and a `legacy:` prefix option to keep
  historical hashes interpretable rather than silently changed.
- New exports are additive: `result-contract`, `capabilities`, `paths`,
  `audit/integrity` primitives, `AuditPersistenceError`.

## 6. Audit hashing methodology

- Entry digest: `sha256:<hex>` over `canonicalize(entry)` — recursive
  key-sorted JSON, `undefined`-valued keys dropped to match
  `JSON.stringify` persistence. Stored in `entry.integrity` with
  `digestSchemaVersion`/`digestAlgorithm`.
- Content hash: self-describing `sha256:` (default), `hmac-sha256:`
  (keyed, via `hashKey` / `LLMVERIFY_AUDIT_HASH_KEY`), `legacy:`
  (pre-1.7 reproduction only). `includeContentHash: false` omits it.
- Verification: `verifyAuditEntry()` recomputes with constant-time
  comparison; `verifyAuditFile()` reports per-entry
  `verified`/`tampered`/`unverifiable` (legacy pre-digest records).
- Explicit non-claims: a digest proves content-integrity, not producer
  authenticity; no signing infrastructure was added.

## 7. Persistence status behavior

`AuditWriteResult.status ∈ {PERSISTED, DISABLED, FAILED, NOT_ATTEMPTED}`.

- `verify()` surfaces it at `result.audit` (and via `onResult`).
- Default = developer mode: a `FAILED` audit write does not fail
  verification, but is visible on the receipt.
- `audit.requirePersistence: true` = evidence-required mode: `FAILED`
  throws `AuditPersistenceError` (code `LLMVERIFY_8001`); no receipt is
  presented as persisted when it was not.

## 8. Privacy & retention

- Zero-network guarantee preserved; no telemetry added.
- Local state stays under `~/.llmverify/`, now fully relocatable via
  `LLMVERIFY_HOME` + per-purpose env vars (see `src/paths.ts`).
- Audit records carry digests + counts, never raw content; operational
  logs are sanitized (PII + common secret-key shapes, nested).
- Retention: audit/logger rotation uses existing `maxFiles` semantics;
  no retention behavior changed silently.

## 9. Tests executed

- `npx tsc` (typecheck+build): **pass**
- Full jest suite: **36/36 suites, 740/740 tests pass**
  (baseline was 28/31, 648/672)
- `npm pack --dry-run`: 235 files; both schema files present
- CLI smoke via `module-compat.test.js`: `--version`, `doctor` pass
- `npm ci`: clean install — see CI/PR record

## 10. Remaining issues & limitations

- No real JSON Schema runtime validation in production code —
  `validateVerifyResult` is structural, dependency-free, and slightly
  narrower than the shipped schema (by design; no new runtime deps).
- Audit files are append-only JSONL without cross-process locking;
  durable multi-writer guarantees are out of scope.
- `verifyAuditFile` detects modification, not forgery — no signatures.
- The `integration`/`monitor` suites require `dist/` to be built first
  (documented; CI builds before tests).

## 11. MCP readiness summary

See `docs/handoff/LLMVERIFY-MCP-READINESS.md`. The package is ready for
a thin adapter: stable `verify()` contract + schema + runtime validator,
capability discovery, typed errors, honest privacy boundaries. First
future tool: `verify_llm_content` (not implemented here).

## 12. Recommended follow-up

- Consider a real draft-07 validator (`ajv`) as an optional/test dep if
  downstream consumers need full schema fidelity.
- Optional HMAC signing story if producer authenticity becomes required.
- ESM dual-publish (`"type": "module"` + `.mjs`) if first-class ESM
  becomes a requirement; current interop is tested and works.
