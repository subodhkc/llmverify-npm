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
- `express` optional dep: floor `^4.18.2` → `^4.22.3` (patched). `overrides` pins `proxy-addr@^2.0.8` for this repo's lockfile.
- **Consumer-side audit (verified 03E):** express `~2.0.7` admits `2.0.8`, so downstream installs resolve the patched `proxy-addr@2.0.8` automatically — a clean consumer project installing the packed tarball reports **0 vulnerabilities** (`npm audit --omit=dev`), with working CJS/ESM imports, CLI, and server mode (`--port=` verified). The root `overrides` entry protects only this repo's own tree; consumers need nothing.
- Dev-tree advisories (jest chain) are not shipped.

## Consumer compatibility requirements

- `llmverify-mcp` adapter requires exactly this hardened surface — see `LLMVERIFY-MCP-COMPATIBILITY.md`. It must never silently fall back to published `1.6.1`.

## Defect found in Task 03D — non-reproducible `npm pack` (P0, **fixed in 03E**)

`files: ["docs", …]` packed whatever was on **disk**, while `.gitignore` hid a set of doc files (`*-GUIDE.md`, `AUTO-*.md`, `AI-*.md`, `docs/SERVER-MODE.md`, `docs/QUICK-START-*`, `*-PLAN.md`, …). A maintainer-machine `npm pack` shipped **13 untracked files** that a clean CI checkout never produced — the registry artifact and local packs diverged.

**Fix applied (03E):** `files` is now an explicit **public-package allowlist** — every doc is named individually; `AI-GUIDE.md` and `prompts/` (gitignored, never shipped in any published version) were removed as dead manifest entries; `docs/handoff/` (internal release documents) is deliberately **not** listed. Directory entries remain only where extension is legitimate (`dist`, `bin`, `schema`, `examples`, `recipes`).

**Enforcement:** `scripts/check-package-files.mjs` (npm script `check:package`) + jest test `tests/package-inventory.test.js` assert every shipped non-`dist/` file is git-tracked — fails loudly on drift. Verified: stray untracked files planted in `examples/` and `schema/` are caught (exit 1); clean tree passes. The publish workflow runs this check before `npm publish`.

**Reproducibility test (03E):** same revision packed clean vs. with simulated untracked docs/artifacts → identical member lists (222 files). Non-byte-reproducibility caveat: npm embeds no timestamps in tar member listing but gzip headers/ordering may vary by npm version — member-list equality is asserted, not byte-identity.

## Publish-pipeline hardening (03E)

**Fixed in `npm-publish.yml`:**

| Before | After |
|---|---|
| `npm test -- --testPathIgnorePatterns="integration\|monitor"` — release shipped without integration/server-suite coverage | `npm test` — full suite gates publication |
| No typecheck step | explicit `npx tsc --noEmit` |
| No tag↔version check — a `vX.Y.Z` tag could publish any `package.json` version | fails unless tag name equals `package.json` version |
| No provenance-of-source check | tagged commit must be an ancestor of `origin/main` (`git merge-base --is-ancestor`) |
| Secrets grep only | plus `scripts/check-package-files.mjs` inventory validation |

**PR CI vs release CI:** PR CI = per-commit gates (install → typecheck → build → full tests × Node 18/20/22/24 → pack verify). Release CI = same gates on Node 22 + tag↔version identity + main-ancestry check + package-inventory validation + secrets scan, then trusted publishing (`--provenance`, OIDC, no token). Release gates are now a strict superset of PR gates.

**`release` GitHub environment:** exists but has **no required reviewers and no deployment branch policy** (`protection_rules: []`, `can_admins_bypass: true`). A tag push alone currently reaches `npm publish`. **NEEDS_APPROVAL:** configure required reviewers on the environment (repo Settings → Environments → release).

**Public document exposure (repo is public):**

| Document | Classification | Note |
|---|---|---|
| `docs/release-1.6/*` (16 files) | PUBLIC_DOCUMENTATION | already shipped publicly in 1.6.1 |
| `docs/handoff/LLMVERIFY-CONTRACT-AUDIT-HARDENING.md` | RELEASE_METADATA | technical change record; harmless public |
| `docs/handoff/LLMVERIFY-MCP-READINESS.md` | REQUIRES_OWNER_REVIEW | names the private adapter repo |
| `docs/handoff/LLMVERIFY-PUBLIC-PRIVATE-BOUNDARY.md` | REQUIRES_OWNER_REVIEW | enumerates the PRIVATE capability taxonomy (names only, no implementation) |
| `docs/handoff/LLMVERIFY-RELEASE-CANDIDATE.md` | REQUIRES_OWNER_REVIEW | release governance, open blockers |
| `docs/handoff/LLMVERIFY-MCP-COMPATIBILITY.md` | REQUIRES_OWNER_REVIEW | names the private adapter repo |
| `docs/handoff/LLMVERIFY-LICENSING-REVIEW.md` | INTERNAL_HANDOFF | open legal/ownership questions |

All `docs/handoff/` files are **excluded from the npm artifact** (allowlist). They remain public on the PR branch — Git history already contains them; removing them from the branch does not erase history. **Recommended:** before merge, relocate `REQUIRES_OWNER_REVIEW`/`INTERNAL_HANDOFF` documents to private storage (e.g. the private HAIEC repo or release ticket); history-remediation (if desired) is a separate owner-authorized decision — do not force-push.

## Release decision table

| Gate | Status |
|---|---|
| Public/private boundary audit | **READY** — no PRIVATE capabilities present; HELD items flagged for product review |
| Export compatibility vs published 1.6.1 | **READY** — additive only |
| Tests (38 suites / 752 tests, Node 24 local; Node 18–24 CI) | **READY** |
| Production dependency audit (repo + packed-artifact consumer) | **READY** — 0 vulns both sides |
| Artifact reproducibility | **READY** — explicit allowlist + automated inventory gate; clean≡dirty member lists |
| Publish pipeline | **READY** — full-test gate, tag↔version, main-ancestry, inventory check |
| `release` environment approval rules | **NEEDS_APPROVAL** — no required reviewers configured today |
| Internal handoff docs public on branch | **NEEDS_APPROVAL** — relocate to private storage before merge (npm already excludes them) |
| Version identity `1.7.0` | **NEEDS_APPROVAL** — bump staged, not applied |
| LICENSE/attribution (KingCaliber vs HAIEC vs Subodh KC) | **NEEDS_APPROVAL** — legal review, see LICENSING-REVIEW |
| `cli connect`/`sync` SaaS path stays in OSS package | **NEEDS_APPROVAL** — product decision |
| npm publish | **BLOCKED** — pending all approvals; do not publish under 1.6.1 |

## Approval register (owner decisions, recommended defaults)

| # | Decision | Recommended default | Consequence if declined |
|---|---|---|---|
| 1 | Version `1.7.0` | Approve — additive semver-minor | Re-cut version plan; do not publish under 1.6.1 |
| 2 | LICENSE/attribution | Confirm KingCaliber Labs + HAIEC/Subodh KC relationship in writing | Hold release; legal risk on ownership |
| 3 | `connect`/`sync` in OSS CLI | Keep (opt-in usage sync; published precedent) — never extend to evidence ingestion | Remove feature = breaking change, needs deprecation plan |
| 4 | `release` env reviewers | Add ≥1 required reviewer | Single-tag-push can publish unreviewed |
| 5 | Handoff docs on public branch | Relocate 4 flagged docs to private storage before merge | Internal analysis permanently public (history retains regardless) |
| 6 | Untracked docs (`AI-GUIDE.md`, internal guides) | Decide public vs private per file; allowlist already prevents accidental shipping | No functional impact; they simply never ship |

## Staged release checklist (explicit owner approval required at each step)

1. [ ] Owner approves version `1.7.0` → apply `package.json`/CHANGELOG version bump.
2. [ ] Legal signs off LICENSE/attribution (LICENSING-REVIEW).
3. [ ] Product signs off `connect`/`sync` remaining in the OSS CLI.
4. [ ] Relocate flagged `docs/handoff/` documents to private storage (npm artifact already excludes them via the allowlist).
5. [ ] Configure required reviewers on the `release` GitHub environment.
6. [ ] Merge PR #21 (squash or merge per repo convention).
7. [ ] Tag `v1.7.0` on main; publish **only** via `npm-publish.yml` (clean checkout) — never a local `npm publish`.
8. [ ] Verify registry artifact (`npm view llmverify@1.7.0`, install smoke).
9. [ ] Update `llmverify-mcp` dep from bundled tarball to `^1.7.0`; re-run its packed-install gate.
10. [ ] Only then proceed to Task 04 extraction work.
