# LLMVerify ↔ MCP Adapter Compatibility Boundary

**Adapter reference (read-only):** `subodhkc/llmverify-mcp` PR #1, head `aa10980337a4688676cee31de87965d0ebe744ed`. Adapter not modified.

## Consumed export inventory — verified present at PR #21 head

Every import the adapter makes from `'llmverify'` (package root only — it never touches `dist/` internals) resolves in the hardened build:

| Import | Kind | Source module | Present |
|---|---|---|---|
| `verify` | function | `src/verify.ts` | ✓ |
| `validateVerifyResult` | function | `src/result-contract.ts` | ✓ (new in PR) |
| `getVerifyResultSchemaPath` | function | `src/result-contract.ts` | ✓ (new) |
| `getEngineCapabilities`, `getPackageInfo` | function | `src/capabilities.ts` | ✓ (new) |
| `getLLMVerifyHome`, `getLogDir`, `getAuditDir`, `getBaselineDir`, `getUsageFile` | function | `src/paths.ts` | ✓ (new) |
| `RESULT_SCHEMA_VERSION` | const | `src/result-contract.ts` | ✓ (new) |
| `VERSION` | const | `src/constants.ts` | ✓ |
| `DEFAULT_CONFIG` | const | `src/types/config.ts` | ✓ (via `export * from './types'`) |
| `HallucinationEngine` | class | `src/engines/hallucination` | ✓ |
| `checkPromptInjection`, `getInjectionRiskScore`, `isInputSafe` | function | `src/csm6/security` | ✓ |
| `checkPII`, `containsPII`, `getPIIRiskScore`, `redactPII` | function | `src/csm6/security` | ✓ |
| `getHallucinationLabel` | function | `src/engines/classification` | ✓ |
| `Config`, `Finding`, `VerifyOptions`, `VerifyResult`, `HallucinationLabel` | type | `src/types/*` | ✓ |

**27 runtime/type imports — zero missing, zero breaking changes** vs the vendored dev tarball (`llmverify-1.6.1-758c002.tgz`, sha256-verified against this head).

## Contract points the adapter depends on

| Contract | Adapter usage | Engine status |
|---|---|---|
| `result.audit.status` ∈ `PERSISTED\|DISABLED\|FAILED\|NOT_ATTEMPTED` | surfaced verbatim | ✓ hardening PR |
| `result.schemaVersion` = `RESULT_SCHEMA_VERSION` | reported in `verify_llm_content` output | ✓ |
| `notChecked` array semantics (never silently PASS) | mapped through incl. `jsonValidator`→`json` public-id mapping | ✓ |
| `Finding.metadata.piiType`/`piiCategory`, `evidence.textSample`/`context` | PII tool + privacy projection | ✓ engine contract |
| `getHallucinationLabel()` domain `low\|medium\|high` | `riskLabel` on `assess_hallucination_risk` | ✓ |
| Error code `LLMVERIFY_8001` (audit persistence required) | adapter error normalization | ✓ |
| `verify()` signature `(content, VerifyOptions)` | unchanged | ✓ |

## Dependency transition plan (bundled tarball → published semver)

Current (development-only) mechanism — **must be replaced before the adapter publishes**:

```jsonc
// adapter package.json (today)
"dependencies": { "llmverify": "file:vendor/llmverify-1.6.1-758c002.tgz" },
"bundleDependencies": ["llmverify"]
```

Target state after `llmverify@1.7.0` publishes:

```jsonc
"dependencies": { "llmverify": "^1.7.0" }
// remove "bundleDependencies" entry for llmverify
// remove vendor/ directory + PROVENANCE.md (or keep PROVENANCE.md updated to the registry release)
```

Transition steps:
1. `llmverify@1.7.0` lands on npm (engine release checklist, `LLMVERIFY-RELEASE-CANDIDATE.md`).
2. Adapter PR: swap `file:` dep → `^1.7.0`, drop bundling, regenerate `package-lock.json`.
3. **Guard against silent fallback to published `1.6.1`:** keep a postinstall-free runtime assertion — adapter already imports `validateVerifyResult`/`getEngineCapabilities` which **do not exist on 1.6.1**; a wrong-resolution install fails loudly at import time, not silently. Optionally add an explicit `RESULT_SCHEMA_VERSION === '1.0'` + `VERSION` floor check at adapter startup.
4. Re-run adapter gates on the swapped dep: `npm ci` → typecheck → lint → build → 75/75 tests → `npm pack` → **clean packed install** → programmatic import (no stdio side effects) → `initialize`/`listTools`/`callTool` handshake → `npm audit --omit=dev`.

## Clean-install test recipe (adapter release)

```bash
npm pack                                  # artifact
mkdir /tmp/mcp-install && cd /tmp/mcp-install
npm init -y && npm install ../llmverify-mcp/*.tgz
node -e "import('llmverify-mcp')"         # must not start stdio
node node_modules/llmverify-mcp/dist/index.js &
# JSON-RPC: initialize → notifications/initialized → tools/list
#   → tools/call verify_llm_content (assert 6 tools, no raw PII echo)
npm audit --omit=dev                      # expect 0
```

## Boundary invariant

The adapter remains a thin integration layer: transport (stdio/MCP), input/output bounding, privacy projection, serialized execution lane, error normalization. It must not grow an independent assurance engine, verdict vocabulary, or reimplement detection/scoring — engine changes land in `llmverify` releases only.
