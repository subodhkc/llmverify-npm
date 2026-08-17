# 00 — Baseline (v1.5.2)

> Recorded before any Phase 1 changes.

## Package

| Field | Value |
|-------|-------|
| name | `llmverify` |
| version | `1.5.2` |
| license | MIT |
| main | `dist/index.js` |
| types | `dist/index.d.ts` |
| sideEffects | `false` |
| engines.node | `>=18.0.0` |
| publishConfig.access | `public` |

## Exports

- `.` → `dist/index.js`
- `./core` → `dist/core/index.js`
- `./adapters` → `dist/adapters/index.js`
- `./engines` → `dist/engines/index.js`
- `./package.json` → `./package.json`

## Bin

- `llmverify` → `./dist/cli.js`
- `llmverify-serve` → `./bin/llmverify-serve.js`

## npm scripts

| Script | Command |
|--------|---------|
| build | `tsc` |
| build:clean | `rm -rf dist && tsc` |
| serve | `node start-server.js` |
| serve:force | `node start-server-force.js` |
| monitor | `node monitor.js` |
| setup-ai | `node setup-ai-prompts.js` |
| **postinstall** | `node dist/postinstall.js \|\| true` |
| test | `jest` |
| test:integration | `jest tests/integration.test.js --testTimeout=20000` |
| test:coverage | `jest --coverage && ...` |
| typecheck | `tsc --noEmit` |
| prepublishOnly | `npm run build && npm test -- --testPathIgnorePatterns="integration\|monitor"` |
| doctor | `node dist/cli.js doctor` |
| verify | `node dist/cli.js verify` |

## Runtime Dependencies

| Package | Version | Notes |
|---------|---------|-------|
| chalk | ^4.1.2 | Terminal colors |
| cli-table3 | ^0.6.3 | CLI tables |
| commander | ^11.1.0 | CLI framework |
| uuid | ^9.0.1 | **VULNERABLE** (GHSA-w5hq-g745-h8pq) |

## Optional Dependencies

| Package | Version |
|---------|---------|
| express | ^4.18.2 |

## Peer Dependencies (all optional)

- `@langchain/core` >=0.1.0
- `anthropic` >=0.20.0
- `openai` >=4.0.0

## Dev Dependencies

| Package | Version |
|---------|---------|
| @playwright/test | ^1.57.0 |
| @types/express | ^4.17.21 |
| @types/jest | ^29.5.11 |
| @types/node | ^20.10.5 |
| @types/supertest | ^6.0.2 |
| @types/uuid | ^9.0.7 |
| jest | ^29.7.0 |
| playwright | ^1.57.0 |
| supertest | ^6.3.3 |
| ts-jest | ^29.1.1 |
| typescript | ^5.3.3 |

## Install Scripts

- **postinstall**: `node dist/postinstall.js || true` — prints a banner to stdout on install

## Test Results

- **Test suites:** 25 passed, 25 total
- **Tests:** 594 passed, 594 total
- **Time:** ~21s

## npm audit

```
13 vulnerabilities (1 low, 5 moderate, 6 high, 1 critical)
```

Key issues:
- `uuid` <11.1.1 (moderate, runtime dep)
- `handlebars` (critical, dev dep via jest/babel)
- `brace-expansion` (high, dev dep)
- `form-data` (high, dev dep)
- `js-yaml` (high, dev dep)
- `minimatch` (high, dev dep)
- `body-parser`/`qs`/`express` (moderate, optional dep)

## npm pack --dry-run

- **Package size:** 615.8 kB
- **Unpacked size:** 2.2 MB
- **Total files:** 215
- **Includes:** `dist/postinstall.js`, `monitor.js`, `start-server.js`, `start-server-force.js`, `setup-ai-prompts.js`

## Release Workflows (3 — duplicate)

1. `npm-publish.yml` — tag-triggered, provenance, Node 20
2. `publish.yml` — manual dispatch, dry-run option, Node 20
3. `llmverify.yml` — release-published trigger, Node 18, also runs CI

## Usage Limit

- Free tier: **500 calls/day**
- Grace period: 10% (500-550 calls)
- Storage: `~/.llmverify/usage.json`
- Reset: daily at local midnight

## Public API (key exports)

- `verify(options)` — main verification function
- `guard`, `safe`, `parse` — zod-like API
- `LLMVerifyChain`, `createChain` — LangChain-like API
- `guardrails` — guardrails API
- `ai`, `llm`, `verifyAI` — shorthand APIs
- `monitorLLM`, `MonitoredClient` — runtime monitoring
- `checkPromptInjection`, `checkPII`, `checkHarmfulContent` — security
- `sanitizePromptInjection`, `redactPII`, `isInputSafe` — sanitization
- `ClassificationEngine`, `classify` — classification
- `HallucinationEngine`, `ConsistencyEngine`, `JSONValidatorEngine`, `RiskScoringEngine`
- `CSM6Baseline` — compliance
- `AuditLogger`, `Logger` — logging
- `loadConfig`, `createDefaultConfigFile` — config
- `PluginRegistry`, `use`, `createPlugin` — plugins
- `BaselineStorage` — drift detection
- `readUsage`, `incrementUsage`, `resetUsage`, `checkUsageLimit` — usage
- `TIER_USAGE_LIMITS` — tier limits
- `VERSION`, `PRIVACY_GUARANTEE`, `ACCURACY_STATEMENT` — constants
- `ErrorCode`, `getErrorMetadata`, `isRecoverable` — errors
- `LLMVerifyError`, `PrivacyViolationError`, `ValidationError`, `VerificationError`, `ConfigurationError`, `EngineError` — error classes

## CLI Commands

- `run` — master command with presets
- `wizard` — interactive setup
- `verify` — multi-engine verification
- `presets` — list presets
- `engines` — list engines
- `doctor` — system health
- `init` — create config file
- `tutorial` — usage examples
- `usage` — usage summary
- `serve` — start server mode

## Telemetry/Network Behavior

- Free tier: zero network, zero telemetry (enforced by `validatePrivacyCompliance`)
- Paid tiers: opt-in API calls only with explicit API key
- Usage tracking: local file only (`~/.llmverify/usage.json`)
