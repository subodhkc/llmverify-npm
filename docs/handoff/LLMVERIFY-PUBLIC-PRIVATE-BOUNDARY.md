# LLMVerify PUBLIC / PRIVATE / HELD Boundary Audit

**Scope:** `llmverify` npm package at PR #21 head `758c002aeb4668b42e41dc3bf397c952b8d2c2f6` — every publishable module, export, doc, and bundled file audited against HAIEC's proprietary assurance surface. `haiec-website` was used as a read-only boundary reference; no HAIEC code was copied or modified.

**Method:** inspected `dist` exports (158 named exports), all `src/` modules (88 files), shipped `docs/`, `examples/`, `recipes/`, `prompts/`, and `schema/`, plus the `npm pack` file list (237 files, 689 kB).

## Verdict vocabulary scan

`SATISFIED` / `NOT_SATISFIED` / `NOT_EVALUATED`, five-plane authority, TestSpec, tenant, delegation, and assurance-evaluation terms do **not** appear anywhere in `src/` as implemented semantics. The only `satisfied` match is a word inside a sentiment regex; `Delegate` appears once in a code comment. No control-verdict issuance exists in this package.

## Classification matrix

### PUBLIC — allowed developer-tool capabilities

| File/module | Exported capability | Evidence | Overlap risk | Action |
|---|---|---|---|---|
| `src/verify.ts`, `src/index.ts` | `verify()` — orchestrated local verification | Pattern/heuristic engines only; returns `risk`, `limitations`, `notChecked`, `audit` receipt | Low — risk score is content screening, not assurance verdict | Keep; language audit passed (§3) |
| `src/engines/hallucination/*` | `HallucinationEngine`, `getHallucinationLabel` | Heuristic claim extraction + risk signals; `low|medium|high` labels | Low | Keep |
| `src/engines/consistency/*` | `ConsistencyEngine` | Internal-consistency analysis; no fact-checking | Low | Keep |
| `src/engines/json-validator/*` | `JSONValidatorEngine` | Structure/schema validation only | None | Keep |
| `src/engines/risk-scoring/*` | `RiskScoringEngine` → `risk.level` + `risk.action` | `action: allow\|review\|block` is a **content-risk recommendation**, not authorization | Medium — `allow/block` vocabulary can be misread as control verdict | Keep API; clarify docs (done in `docs/RISK-LEVELS.md`) |
| `src/csm6/*` | `CSM6Baseline`, 38-rule heuristic control set | Heuristic rule checks; produces findings, not control verdicts | Medium — "control set" naming could imply HAIEC Control Tests | Keep; docs already say "baseline mapping only — not certification" |
| `src/csm6/security/*` | `checkPromptInjection`, `checkPII`, `redactPII`, `checkHarmfulContent`, risk scores | Regex/heuristic detectors with stated false-negative limits | Low | Keep |
| `src/engines/classification/*` | Intent, instruction-rule eval, compression, JSON repair | Local heuristic classification | Low | Keep |
| `src/engines/runtime/*` | Latency, token-rate, fingerprint, baseline, health-score engines | Statistical runtime monitors; `isHealthy`/`getAlertLevel` are health signals | Low | Keep |
| `src/sentinel/*` | `SentinelSuite`, probe tests | Deterministic self-test probes | Low | Keep |
| `src/audit/*`, `src/logging/audit.ts` | `AuditLogger`(V1/V2), `canonicalize`, `hashContent`, `digestAuditEntry`, `verifyAuditEntry`, `withIntegrity`, `AuditWriteResult` | Generic SHA-256/HMAC per-entry digests + append receipts. **Not** authenticated source truth, not control proof, no org/tenant binding | Medium — "integrity" must not be read as evidence qualification | Keep; receipts document what they are (persistence outcome + digest) and are not (authorization/assurance) |
| `src/result-contract.ts`, `schema/` | `RESULT_SCHEMA_VERSION`, `validateVerifyResult`, packaged JSON schemas | Versioned result contract; additive | None | Keep |
| `src/capabilities.ts` | `getEngineCapabilities`, `getPackageInfo` | Each capability states `observes`/`doesNotEstablish` — explicitly honest | None | Keep |
| `src/paths.ts` | `getLLMVerifyHome` + per-dir getters | Local path configuration | None | Keep |
| `src/baseline/storage.ts` | `BaselineStorage`, drift records | Local metrics storage, last-writer-wins | Low | Keep |
| `src/adapters/*` | Provider adapters (OpenAI, Anthropic, Groq, Google, DeepSeek, Mistral, Cohere, local, custom) | Thin HTTP wrappers to **user-configured** endpoints; no default network | Low | Keep |
| `src/compat/*`, `src/wrapper/*` | `guard`, `safe`, `monitorLLM`, `MonitoredClient` | Compatibility shims + client monitoring | Low | Keep |
| `src/plugins/*` | Plugin registry + built-in plugins | User-extensible hooks | Low | Keep |
| `src/security/validators.ts` | `validateInput`, `safeRegexTest`, `sanitizeForLogging`, `RateLimiter` | Generic input hygiene | None | Keep |
| `src/badge/generator.ts` | Badge markdown/HTML + `generateBadgeSignature`/`verifyBadgeSignature` | Keyless truncated SHA-256 — an **integrity tag**, not a signature | Medium — "signature"/"verify" naming overstates strength | Keep API (published); documented as P2 naming concern |
| `src/ide-extension.ts`, `src/server.ts`, `bin/` | IDE client + `llmverify-serve` HTTP server | Server binds localhost; all network is user-invoked | Low | Keep (serve bin fixed in this PR) |
| `src/cli.ts` (connect/disconnect/sync) | Opt-in HAIEC dashboard usage sync | `connect <apiKey>` → haiec.com; **usage metering sync only** — no evidence ingestion, no control data | Medium — touches proprietary SaaS | Keep (published feature, opt-in); see HELD note below |
| `src/usage/*` | Local usage tracker + tier limits | Local counters; pricing links only | Low | Keep |
| `src/config/*`, `src/logging/logger.ts`, `src/utils/*`, `src/types/*`, `src/constants.ts` | Config loaders, sanitized logger, text utils, result/config types, `TERMINOLOGY` | Support code; `TERMINOLOGY` already encodes honest-vocabulary rules | None | Keep |

### PRIVATE — reserved for HAIEC (verified ABSENT from this package)

| Capability | Status in package |
|---|---|
| Five-plane authority evaluation / authoritative binding | Not present — no plane model exists |
| Source-qualification & claim-level evidentiary sufficiency | Not present — risk scores are heuristics, not evidence qualification |
| Permission-vs-delegation determination | Not present |
| Consequential-action effect proof | Not present |
| UCP TestSpec approval/freeze governance | Not present |
| Deterministic qualified-control evaluator | Not present — CSM6 is heuristic rules, not qualified controls |
| Canonical Control Test verdicts (`SATISFIED`/`NOT_SATISFIED`/`NOT_EVALUATED`) | Not present — no such enum anywhere |
| Independent control-proof replay/qualification | Not present — `verifyAuditEntry` checks digest math only |
| Cross-tenant evidence/result ownership | Not present — single-user local state only |
| Enterprise assurance orchestration/decision logic | Not present — `risk.action` is a screening recommendation |

### HELD — requires explicit review before/after release

| Item | Concern | Disposition |
|---|---|---|
| `cli connect`/`sync` → `www.haiec.com` | Public package carries a live opt-in integration into the proprietary dashboard. Functionality = usage-counter sync only; not evidence ingestion. Per `MCP_TO_SAAS_EVIDENCE_INGESTION_HOLD`, no evidence path may be added through this channel. | **Needs product sign-off** that usage-sync stays; documented as pre-existing published behavior, unchanged by this PR |
| `AuditLogger` digest language | Audit digests could be marketed as "evidence". They are tamper-*detection* tags on local files — no provenance binding, no org identity, no qualification | Reviewer to confirm public docs language stays at "local audit integrity", which `docs/SECURITY` and handoffs now state |
| `generateBadgeSignature` | Name implies signing; implementation is keyless hash. Correcting the name is a breaking API change — left as-is, flagged | Product decision: accept misleading name on published API or schedule a `2.0` rename |
| `docs/release-1.6/14-AGENT-SECURITY-INTEGRATION.md` | Ships inside the package; references future HAIEC Agent Security surface | Acceptable — it describes `llmverify` staying independent and names `verify_llm_content` as the integration contract; contains no proprietary internals |

## Semantic-leakage review (USP language)

Audited `verify()`, `risk.action`, audit receipts, framework alignment, compliance scoring, content safety, verification results across `README.md`, `docs/` (20 files), `AI-GUIDE.md`, `QUICK-START.md`, examples.

**Compliant already:** `README` states "baseline mapping only — not certification" and "never mistake a clean score for a guarantee". `ACCURACY_STATEMENT`/`TERMINOLOGY` constants codify honest vocabulary (`avoid: 'foolproof detection'` etc.). `RISK-LEVELS.md` frames `action` as "Recommended action". The agent-security doc disclaims deploy gating.

**Clarified this task:** `docs/RISK-LEVELS.md` now explicitly states `risk.action` is a content-risk **recommendation**, never evidence that an action was authorized or a control satisfied.

**Non-equivalences enforced in docs** (must stay true):
- detection completed ≠ evidence qualified
- risk score ≠ assurance verdict
- audit digest ≠ authenticated source truth
- framework mapping ≠ compliance certification
- content validation ≠ authorization
- no findings ≠ complete coverage
- model/heuristic assessment ≠ deterministic control proof

## Bundled dependency surface

Runtime deps: `chalk`, `cli-table3`, `commander`, `uuid` + optional `express` (server mode only). After this task's express floor bump (`^4.22.3`) + `proxy-addr` override (`^2.0.8`), production audit is **0 vulnerabilities**. No bundled third-party code carries HAIEC IP.
