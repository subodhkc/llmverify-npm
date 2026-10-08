# LLMVerify — MCP Adapter Readiness

Handoff for building a dedicated MCP server/adapter on top of the `llmverify`
npm package. **Do not implement MCP inside this package.** The adapter should
live in its own repository and consume only the public API surface described
below (`import ... from 'llmverify'` — never internal `dist/` paths).

Baseline for this document: `llmverify` on branch
`fix/llmverify-contract-audit-hardening` (post-1.6.1 hardening).

## 1. Stable callable functions

Recommended surface for the adapter (all exported from the package root):

| Function | Purpose | Notes |
|---|---|---|
| `verify(options)` | General content verification | Primary entrypoint. Returns `VerifyResult`. |
| `isInputSafe(input)` | Prompt-injection gate | Boolean; synchronous. |
| `sanitizePromptInjection(input)` | Injection sanitization | Returns `{ sanitized, wasModified, ... }`. |
| `containsPII(content)` / `checkPII(content)` | PII detection | Pattern-based. |
| `redactPII(content)` | PII redaction | Conservative/aggressive mode by default. |
| `checkHarmfulContent(content)` | Harmful-content indicators | Pattern-based, no intent judgement. |
| `classify(prompt, output)` / `detectIntent(...)` | Classification | Heuristic; not calibrated. |
| `run(options)` + presets (`devVerify`, `prodVerify`, `strictVerify`, `fastVerify`, `ciVerify`) | Core pipeline | Same engine, preset configs. |
| `validateVerifyResult(value)` | Contract validation | Returns `{ valid, errors }`. Dependency-free. |
| `getVerifyResultSchemaPath()` | Path to packaged JSON Schema | `null` if schema dir not shipped. |
| `getEngineCapabilities()` | Capability discovery | Returns `EngineCapability[]` (see §6). |
| `getPackageInfo()` | Name/version/result schema/Node range | Static metadata. |
| `RESULT_SCHEMA_VERSION` | Result contract version | Currently `'1.0'`. |

Audit/logging surface (optional for the adapter):

| Function | Purpose |
|---|---|
| `AuditLoggerV2` (from root, class) | Integrity-digested JSONL audit log with persistence receipts |
| `verifyAuditEntry(entry)` | Verify a stored record's SHA-256 digest |
| `getLogDir()`, `getAuditDir()`, `getLLMVerifyHome()` | Local-state location discovery |

## 2. Input schema (verify)

`verify(options)` — see `VerifyOptions` in `src/verify.ts`:

- `content` (string, required) — text to verify. Plain-string shorthand
  (`verify('text')`) is also accepted.
- `config` — partial `Config`; engine toggles live at
  `config.engines.{hallucination,consistency,jsonValidator,csm6}.enabled`
  along with per-engine thresholds and CSM6 profile.
- `context` — `{ isJSON?, expectedSchema?, skipEngines? }`. `isJSON`
  gates the JSON engine onto non-JSON input; `skipEngines` removes
  engines per call. Skipped/disabled engines land in `notChecked`.
- `tier` — `'free' | 'pro' | ...`; controls usage/content limits.
- `audit` — `{ requirePersistence?, onResult? }` (v1.7+):
  `requirePersistence: true` = evidence-required mode (failed audit
  writes throw `AuditPersistenceError`); `onResult` observes the
  `AuditWriteResult` receipt. Content-hash controls
  (`includeContentHash`, `hashAlgorithm`, `hashKey`) live on the
  `AuditLoggerV2` config/env, not per call.

## 3. Output schema (verify)

Direct return type: `VerifyResult` (`schemaVersion: '1.0'`).

- Machine contract: `schema/verify-result.schema.json` (also shipped at
  `schema/verify-result-1.0.schema.json`; both are in the npm tarball).
- Programmatic validation: `validateVerifyResult(result)`.
- Optional top-level fields: `hallucination`, `consistency`, `json`,
  `csm6`, `warnings`, `audit`.
- Required top-level fields: `schemaVersion`, `risk`, `meta`,
  `limitations`, `notChecked`.

Semantic rules the adapter MUST preserve:

- `notChecked` lists engines that did not run — it is **not** success.
- `risk` is a heuristic triage signal, not a factual-verification verdict.
- `audit.status` describes actual persistence (`PERSISTED`/`DISABLED`/`FAILED`/`NOT_ATTEMPTED`); a successful `verify()` does not imply a persisted audit record.
- HTTP wrapper note: `src/server.ts` wraps results in `{ success, result, summary, meta }` — that envelope is a server contract, **not** the `verify()` contract.

## 4. Error contract

`verify()` throws typed errors (`src/errors.ts`, codes in
`src/errors/codes.ts`). All package errors derive from `LLMVerifyError`
with `code`, `severity`, `recoverable`, and structured `details`:

| Condition | Error / code |
|---|---|
| Missing/invalid content | `ValidationError` (`INVALID_INPUT`, `CONTENT_TOO_LARGE`) |
| Content over absolute max (10 MB) | `ValidationError` |
| Content over tier limit | `UsageLimitError` (`USAGE_LIMIT_EXCEEDED`) |
| Tier monthly limit reached | `UsageLimitError` |
| `audit.requirePersistence: true` and audit write fails | `AuditPersistenceError` (`AUDIT_PERSISTENCE_FAILED`) |
| Engine timeout | `TimeoutError` |

The adapter should map these to MCP tool errors carrying `code` + message,
and must not swallow `FAILED` persistence receipts when
`requirePersistence` was requested.

## 5. Network / privacy boundaries

- Default execution path performs **zero network access**. `verify()` and
  all engines are local-only heuristics.
- No telemetry is emitted. Local state (logs, audit files, usage counter,
  baselines, CLI config) lives under `~/.llmverify/` by default.
- Local-state locations are configurable via env vars:
  `LLMVERIFY_HOME` (base), `LLMVERIFY_LOG_DIR`, `LLMVERIFY_AUDIT_DIR`,
  `LLMVERIFY_BASELINE_DIR`, `LLMVERIFY_USAGE_FILE`, `LLMVERIFY_CONFIG_DIR`.
- "Zero network" does NOT mean "writes nothing" — document the
  distinction between no telemetry and local filesystem logging.
- Audit records store content **digests**, never raw content — both
  `AuditLogger` (v1) and `AuditLoggerV2` accept `includeContentHash: false`
  and `hashKey` (keyed `hmac-sha256`, for low-entropy/sensitive workloads).
  `LLMVERIFY_AUDIT_HASH_KEY` and `LLMVERIFY_AUDIT_NO_CONTENT_HASH=1` are
  the env equivalents for the global logger.
- Opt-in provider adapters (`createAdapter` etc.) only touch the network
  when the caller explicitly supplies a provider client/key.

## 6. Capability metadata

`getEngineCapabilities()` returns `EngineCapability[]` — one entry per
capability with `entrypoints`, `observes`, `doesNotEstablish`,
`networkAccess`, `persistsContent`. Use it to populate MCP tool
descriptions without inventing claims. Key truth constraints:

- Hallucination output = risk signals, not proof.
- PII/injection/harmful detection = pattern-based, not exhaustive.
- Classification = heuristic intent, not calibrated probability.
- Audit digests = tamper-evidence, not signatures or off-host durability.

## 7. Content size limits

- `SECURITY_LIMITS.MAX_CONTENT_LENGTH` = 10 MB absolute ceiling
  (validation rejects above this).
- Tier limit: `checkContentLength()` enforces `maxContentLength` per tier
  (free default ~1,000,000 chars) via `TIER_USAGE_LIMITS`.
- Free-tier monthly verification quota is enforced by the usage counter
  (`checkUsageLimit()`); the adapter should surface `UsageLimitError`
  distinctly so callers know it is quota, not a verification failure.

## 8. Supported Node versions

- `engines`: `node >= 18.0.0`. Validated on Node 24 locally.
- Package is CJS-first (`dist/index.js`); ESM consumers work through
  Node's CJS/ESM interop (`import` resolves named exports via the
  `default`/`module.exports` namespace). A real-ESM smoke test runs in
  `tests/module-compat.test.js`.

## 9. Logging defaults

- `AuditLoggerV2` enabled-by-default JSONL writer to `getAuditDir()` —
  entries carry `integrity.entryDigest` (`sha256:` over the canonical
  record) and every write returns an `AuditWriteResult` receipt.
- `Logger` (operational logs) writes to `getLogDir()` with PII/secret
  sanitization applied to messages and nested metadata.
- `verify()` emits an audit entry per call through the global v2 logger;
  `result.audit` is the persistence receipt.

## 10. Security considerations for the adapter

- Do not pass `context.isJSON = true` blindly — it changes which engines
  run; reflect it in the tool input schema.
- Do not weaken audit privacy silently: `includeContentHash: false` and
  keyed hashing (`hashKey`) are deliberate operator choices — surface them
  as explicit adapter configuration.
- `verifyAuditEntry`/`verifyAuditFile` detect modification, not forgery —
  do not present them as signature verification.
- `isInputSafe` is a gate heuristic; sanitize + policy is the caller's job.
- The HTTP server (`llmverify-serve`) binds localhost-only with rate
  limits and restricted CORS — an MCP adapter should expose tools over
  stdio, not reuse the HTTP server.

## 11. Recommended read-only MCP tools

First tool (required): **`verify_llm_content`**

| Tool | Maps to | Read-only? |
|---|---|---|
| `verify_llm_content` | `verify()` | Yes (aside from local usage counter + optional audit write) |
| `check_prompt_injection` | `isInputSafe` / `checkPromptInjection` / `getInjectionRiskScore` | Yes |
| `check_pii` | `containsPII` / `checkPII` | Yes |
| `redact_pii` | `redactPII` | Yes |
| `classify_output` | `classify` / `detectIntent` | Yes |
| `get_llmverify_capabilities` | `getEngineCapabilities` + `getPackageInfo` | Yes |
| `validate_llmverify_result` | `validateVerifyResult` | Yes |

Avoid tools that mutate (`resetUsage`, `resetBaselineStorage`, log
rotation) in the first adapter iteration.

## 12. Remaining blockers / notes for the adapter

- `VerifyResult` is interface-typed; a generated JSON Schema is shipped,
  but the adapter should still call `validateVerifyResult` defensively on
  values it did not produce.
- Audit receipts are per-call in-process results — there is no async
  durability guarantee beyond the append to a local JSONL file.
- Multi-process access to the same audit/usage files is append-oriented
  but not lock-coordinated; serialize adapter calls if durability matters.
- ESM consumers get CJS interop (no dual-publish); document the
  `import llmverify from 'llmverify'` default-export pattern.
- No streaming/partial results — `verify()` is a single-shot promise.
