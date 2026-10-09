# LLMVerify Licensing & Attribution Review

**Scope:** `llmverify` at PR #21 head `758c002…` — LICENSE, package metadata, source headers, third-party deps, package history. **No ownership claims were changed.** Findings requiring legal review are flagged, not resolved.

## Observed attributions (all currently present)

| Location | Statement |
|---|---|
| `LICENSE` | `Copyright (c) 2025 KingCaliber Labs` + `Contributors: - Haiec (original author)` |
| `package.json` | `"author": "Subodh Kc <subodhkc.com>"`, `"license": "MIT"` |
| npm registry | author `Subodh Kc`, license `MIT` across all published versions (0.0.1 → 1.6.1) |
| Source headers | `@author HAIEC` in `src/core/index.ts`; similar `@author HAIEC` tags in `src/cli.ts`, `src/server.ts`, `src/errors/codes.ts`, `src/sentinel/suite.ts`, `src/usage/limits.ts`, `src/wrapper/monitorLLM.ts` |
| `src/cli.ts` | `maintainer: 'Subodh KC (HAIEC)'` in program metadata |
| README | "part of the [HAIEC] AI governance platform" + haiec.com links |

## Interpretation (facts only — not a legal conclusion)

Three distinct attributions coexist: **KingCaliber Labs** (LICENSE copyright holder), **HAIEC** (source `@author` + "original author" contributor), **Subodh KC** (npm/package author). These are not necessarily contradictory — an individual author, a corporate copyright holder, and an originating entity can all be accurate simultaneously — but there is **no document in this repo** (CLA file, IP assignment, NOTICE file, or contribution record) establishing the relationship among them.

## Questions flagged for human/legal review

1. **Copyright holder confirmation.** Is "KingCaliber Labs" the intended public copyright holder for this package going forward, or should the LICENSE read HAIEC? Do not change without instruction — MIT relicensing a published package does not retroactively alter already-distributed copies anyway.
2. **Contributor rights.** `LICENSE` lists "Haiec (original author)" while npm metadata lists "Subodh Kc". If these are the same natural person/entity under different names, record that explicitly. If different parties contributed, a CONTRIBUTING/NOTICE record of rights may be needed before asserting sole ownership.
3. **`@author HAIEC` headers.** Consistent with the "original author" story; retain as-is pending item 1–2 resolution.
4. **MIT is forward-only.** All published versions (0.0.1–1.6.1) shipped under MIT. Any future licensing change applies only to new releases; prior artifacts remain MIT forever. The MIT license permanently permits reuse/modification of published code — release-blocking IP concerns must be resolved **before** `1.7.0` publishes, since hardening code then becomes irrevocably MIT-licensed.

## Third-party audit

| Dependency | License | Role | Note |
|---|---|---|---|
| `chalk` ^4.1.2 | MIT | CLI color | fine |
| `cli-table3` ^0.6.3 | MIT | CLI tables | fine |
| `commander` ^11.1.0 | MIT | CLI parsing | fine |
| `uuid` ^11.1.1 | MIT | IDs | fine |
| `express` ^4.22.3 (optional) | MIT | server mode | raised floor — see release-candidate doc |
| peer deps (`openai`, `anthropic`, `@langchain/core`) | n/a | optional consumer-provided | not bundled |

- `npm pack` artifact (237 files): `dist`, `bin`, `docs`, `examples`, `recipes`, `prompts`, `schema`, README/LICENSE/CHANGELOG, AI-GUIDE, QUICK-START. No secrets (`.env|key|pem` check is in CI package job). No third-party source vendored.
- Production audit: **0 vulnerabilities** at this head.

## Disposition

| Item | Status |
|---|---|
| MIT license validity for published code | READY — already public, consistent |
| Copyright holder (KingCaliber vs HAIEC) | **NEEDS_APPROVAL** — legal/product decision |
| Contributor/author record | **NEEDS_APPROVAL** — document relationship |
| Source `@author HAIEC` headers | READY to retain; harmonize only after item above |
| `1.7.0` publish under current LICENSE text | **BLOCKED** pending the two approvals |
