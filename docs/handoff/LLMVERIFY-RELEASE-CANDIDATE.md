# LLMVerify Release Candidate — Version, Compatibility, Gates

**Audited head:** `758c002aeb4668b42e41dc3bf397c952b8d2c2f6` (PR #21) plus this task's commit (express floor bump + proxy-addr override + docs).

## Version identity — RECOMMENDATION: `1.7.0`

### The collision problem (must fix before publish)

The working tree identifies as `1.6.1`, but `llmverify@1.6.1` was **already published** (2026-08-21). The published artifact (213 files) does **not** contain PR #21's contract/audit hardening. A local `1.6.1` ≠ the published `1.6.1`. Publishing or rebuilding under `1.6.1` would collide with registry immutability — npm will reject it outright.

### Semver analysis (verified against `dist/index.d.ts` diff vs published `1.6.1`)

- **Removed exports:** none — every published `1.6.1` export still resolves.
- **Added exports (23+):** `AuditLoggerV2`, `getAuditLoggerV2`, `setAuditLogger`, `resetAuditLogger`, `canonicalize`, `hashContent`, `digestAuditEntry`, `verifyAuditEntry`, `withIntegrity`, `persistenceResult`, `AUDIT_DIGEST_SCHEMA_VERSION`, `RESULT_SCHEMA_VERSION`, `RESULT_SCHEMA_FILE`, `validateVerifyResult`, `getVerifyResultSchemaPath`, `getEngineCapabilities`, `getPackageInfo`, `getLLMVerifyHome`, `getLogDir`, `getAuditDir`, `getBaselineDir`, `getUsageFile`, `getConfigDir`, plus `VerificationAuditStatus` type.
- **Behavior changes (fixes, documented):** result JSON schema now matches runtime; audit writes emit `PERSISTED`/`DISABLED`/`FAILED`/`NOT_ATTEMPTED` receipts; `audit.requirePersistence` fails closed (`LLMVERIFY_8001`); atomic baseline writes; `llmverify-serve` bin actually starts; `risk`/`schemaVersion` fields corrected.

Additive + corrective, no removals → **semver MINOR: `1.7.0`**.
Not `1.6.2` — new public API surface is more than a patch. Not `2.0.0` — no breaking changes found.

**Version bump is NOT applied in this PR** — staged for owner approval (per task: only stage version-file changes after the release identity is explicitly approved).

## Release notes (draft for `1.7.0`)

**Added**
- Versioned `VerifyResult` contract: `RESULT_SCHEMA_VERSION`, `validateVerifyResult()`, packaged `schema/verify-result-1.0.schema.json`, `getVerifyResultSchemaPath()`.
- Observable audit persistence: `result.audit` receipt (`PERSISTED`/`DISABLED`/`FAILED`/`NOT_ATTEMPTED`), `audit.requirePersistence` + `AuditPersistenceError` (`LLMVERIFY_8001`).
- Cryptographic audit integrity: canonicalization, self-describing `sha256:`/`hmac-sha256:`/`legacy:` content hashes, `digestAuditEntry`/`verifyAuditEntry`/`withIntegrity`, `verifyAuditFile()` verified/tampered/unverifiable.
- `getEngineCapabilities()`/`getPackageInfo()` for downstream integrations.
- Centralized local-state paths (`getLLMVerifyHome` et al.) with `LLMVERIFY_*` env overrides.

**Fixed**
- Result JSON schema corrected to match actual runtime output.
- `llmverify-serve` bin now starts.
- Concurrent test-worker state isolation; atomic baseline writes.
- Logger sanitization hardened for nested objects/secret-key variants.

**Security**
- Optional `express` floor raised to `^4.22.3`; `proxy-addr` overridden to `^2.0.8` — production dependency audit is clean.

## API compatibility matrix

| Surface | 1.6.1 → 1.7.0 | Notes |
|---|---|---|
| `verify(content, opts)` | Compatible | Result gains `audit` receipt + corrected optional fields |
| All `1.6.1` exports | Compatible | Zero removals (verified by export diff) |
| Result JSON schema | **Changed (fix)** | Schema previously did NOT match runtime; versioned `1.0` file shipped alongside |
| Audit records | Compatible + upgraded | Legacy entries readable, labeled `legacy:` unverifiable |
| `risk.action` semantics | Compatible | Recommendation unchanged; docs clarify it is not authorization |
| `llmverify-serve` | Now works | Previously never started — fix |
| CJS `require` / ESM `import` | Compatible | Verified at head |
| Node 18/20/22/24 | Compatible | CI matrix green; local Node 24 verified |

## Upgrade notes

- Existing `verify()` consumers: no code changes required. If you validated results against the old schema file, switch to `schema/verify-result-1.0.schema.json` (the honest schema) or `validateVerifyResult()`.
- Consumers relying on `requirePersistence`-style guarantees should opt in explicitly via `audit.requirePersistence: true`.
- Downstream integrations (e.g. `llmverify-mcp`) should pin `^1.7.0` — the adapter's imports do not exist on published `1.6.1`.

## Rollback

- npm: `npm install llmverify@1.6.1` (published bits unchanged).
- Local state: `1.7.0` writes digested audit entries; `1.6.1` reads them as ordinary JSONL (digests are additive fields, old code ignores them).

## Dependency impact

- New runtime deps: none.
- `express` optional dep: floor `^4.18.2` → `^4.22.3` (patched). `overrides` pins `proxy-addr@^2.0.8` in this repo's tree — consumers of the optional server dep resolve express's own range; the residual `proxy-addr` advisory inside express 4.x is documented (affects only opt-in server mode; no upstream 4.x fix exists that includes it).
- Dev-tree advisories (jest chain) are not shipped.

## Consumer compatibility requirements

- `llmverify-mcp` adapter requires exactly this hardened surface — see `LLMVERIFY-MCP-COMPATIBILITY.md`. It must never silently fall back to published `1.6.1`.

## Defect found in Task 03D — non-reproducible `npm pack` (P1)

`files: ["docs", …]` packs whatever is on **disk**, but `.gitignore` hides a set of doc files (`*-GUIDE.md`, `AUTO-*.md`, `AI-*.md`, `docs/SERVER-MODE.md`, `docs/QUICK-START-*`, `*-PLAN.md`, …). Result: **13 files ship in a locally-built tarball that are not in git** — `AI-GUIDE.md`, `prompts/llmverify-assistants.md`, `docs/{AI-INTEGRATION,ALGORITHMS,AUTO-VERIFY-IDE,BADGE-GUIDE,ERROR-GUIDE,FOR-DEVELOPERS,IDE-INTEGRATION,INTEGRATION-GUIDE,QUICK-START-IDE,SERVER-MODE}.md`, `docs/release-1.6/01-CHANGE-PLAN.md`.

- Published `1.6.1` (built via CI clean checkout) contains **none** of them → the registry artifact and a maintainer-machine `npm pack` differ.
- `AI-GUIDE.md` is *explicitly* whitelisted in `files` yet gitignored (`AI-*.md`) — intent conflict: either it was never meant to hide, or `files` lists it optimistically. Same class for `prompts/llmverify-assistants.md`.
- Side effect already in flight: the vendored `llmverify-1.6.1-758c002.tgz` inside `llmverify-mcp` was built from this working tree and therefore contains these untracked docs (docs only — harmless, but provenance-relevant: the tarball is not byte-reproducible from commit `758c002` alone).
- **Owner decision required:** (a) commit the docs and keep them public, or (b) keep them private and add `docs/.npmignore` + remove `AI-GUIDE.md`/`prompts/` from `files` so the artifact is reproducible regardless of machine state. Until decided, **publish only from a clean CI checkout / workflow** — never `npm publish` from a working tree containing untracked docs.

## Release decision table

| Gate | Status |
|---|---|
| Public/private boundary audit | **READY** — no PRIVATE capabilities present; HELD items flagged for product review |
| Export compatibility vs published 1.6.1 | **READY** — additive only |
| Tests (37 suites / 751 tests, Node 24 local; Node 18–24 CI) | **READY** |
| Production dependency audit | **READY** — 0 vulns after express/proxy-addr fix |
| Artifact reproducibility (local pack ≠ git checkout) | **NEEDS_FIX** — decide (a)/(b) above; enforce clean-checkout publish in the meantime |
| Version identity `1.7.0` | **NEEDS_APPROVAL** — bump staged, not applied |
| LICENSE/attribution (KingCaliber vs HAIEC vs Subodh KC) | **NEEDS_APPROVAL** — legal review, see LICENSING-REVIEW |
| `cli connect`/`sync` SaaS path stays in OSS package | **NEEDS_APPROVAL** — product decision |
| npm publish | **BLOCKED** — pending all approvals; do not publish under 1.6.1 |

## Staged release checklist (explicit owner approval required at each step)

1. [ ] Owner approves version `1.7.0` → apply `package.json`/CHANGELOG version bump.
2. [ ] Legal signs off LICENSE/attribution (LICENSING-REVIEW).
3. [ ] Product signs off `connect`/`sync` remaining in the OSS CLI.
4. [ ] Resolve the untracked-docs packaging split (commit them, or npmignore them) so `npm pack` output equals a clean-checkout build.
5. [ ] Merge PR #21 (squash or merge per repo convention).
6. [ ] Tag `v1.7.0` on main; publish **only** via `npm-publish.yml` (clean checkout) — never a local `npm publish`.
7. [ ] Verify registry artifact (`npm view llmverify@1.7.0`, install smoke).
8. [ ] Update `llmverify-mcp` dep from bundled tarball to `^1.7.0`; re-run its packed-install gate.
9. [ ] Only then proceed to Task 04 extraction work.
