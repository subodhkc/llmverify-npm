# Changelog

All notable changes to llmverify will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.0] - 2026-02-08

### Added - Tier System & Usage Tracking
- Local-only usage tracking via `~/.llmverify/usage.json` — no network calls, no telemetry
- Four pricing tiers: `free` (500 calls/day), `starter` (5,000), `pro` (50,000), `business` (unlimited)
- Soft cap with grace period (10% above limit) before hard block
- New error codes: `LLMVERIFY_7001` (usage limit exceeded), `LLMVERIFY_7002` (content length exceeded)
- `checkUsageLimit()` and `checkContentLength()` exported for programmatic access
- `readUsage()` and `getUsageSummary()` for usage inspection
- `TIER_USAGE_LIMITS` exported with per-tier limits (dailyCallLimit, maxContentLength, auditRetentionDays, maxPlugins, customPatterns)
- Usage warnings injected into `verify()` result when approaching daily limit
- Postinstall banner now shows free tier info and `npx llmverify usage` command

### Added - Sentinel Simple API
- `sentinel.quick(client, model)` — one-liner to run all 4 sentinel tests
- `sentinel.test(name, client, model)` — run a single sentinel test by name
- `sentinel.runAll` — re-export of `runAllSentinelTests` for convenience

### Added - Typed Interfaces
- `AiShorthand` interface for the `ai` and `llm` shorthand objects
- `GuardrailsAPI` interface for the `guardrails` compatibility object

### Fixed
- `server.ts`: express import now uses dynamic `require()` with helpful error message if express is not installed (was crashing when express was in optionalDependencies)
- `validatePrivacyCompliance`: updated tier reference from "Team" to "Starter"
- `INVALID_TIER` error suggestion updated to use new tier names (free, starter, pro, business)

### Changed
- Tier names renamed: `team` → `starter`, `professional` → `pro`, `enterprise` → `business`
- `TIER_LIMITS` performance values now match `TIER_USAGE_LIMITS` content length caps

## [1.4.2] - 2026-02-08

### Added - Developer Experience
- `verify()` now accepts a plain string: `verify("text")` is shorthand for `verify({ content: "text" })`
- Default export: `import llmverify from 'llmverify'` now works (exports the `ai` shorthand object)
- IDE extension local fallback: when server is unavailable, `LLMVerifyIDE.verify()` falls back to local `verify()` automatically (new `useLocalFallback` option, defaults to `true`)

### Fixed
- `validateConfig()` was checking wrong property paths (`config.maxContentLength` instead of `config.performance?.maxContentLength`, `config.verbose` instead of `config.output?.verbose`)
- Moved `express` from `dependencies` to `optionalDependencies` (saves ~2MB for library-only users)

## [1.4.1] - 2026-02-08

### Fixed - Packaging & Branding
- Removed self-referencing dependency (`llmverify` listing itself in `dependencies`)
- Fixed VERSION constants stuck at `1.0.0` in `constants.ts`, `postinstall.ts`, and `index.ts` JSDoc
- Updated author from "KingCaliber Labs" to "HAIEC" across all source files and `package.json`
- Updated homepage URL to point to documentation site

## [1.4.0] - 2024-12-04

### Added - Enterprise Features

**Enhanced Error Handling:**
- 20+ standardized error codes (LLMVERIFY_1001 format)
- Error severity levels (low, medium, high, critical)
- Error metadata with actionable suggestions
- Recoverable/non-recoverable classification
- JSON serialization support

**Logging & Audit System:**
- Structured logging to `~/.llmverify/logs/*.jsonl`
- Request ID tracking with UUID
- Automatic PII sanitization in logs
- Log rotation (10MB max, keep 10 files)
- Audit trail to `~/.llmverify/audit/*.jsonl`
- SHA-256 content hashing
- Compliance-ready audit exports
- Log statistics & analytics

**Baseline Drift Detection:**
- Baseline metrics storage (`~/.llmverify/baseline/baseline.json`)
- Running averages for latency, content length, risk score
- Risk distribution tracking
- Engine score tracking
- Drift detection with 20% threshold
- Drift history tracking
- CLI commands: `baseline:stats`, `baseline:reset`, `baseline:drift`

**Plugin System:**
- Extensible rule system for custom verification
- Plugin registry with enable/disable
- Priority-based execution
- Category-based filtering
- Built-in helpers: blacklist, regex, length validator, keyword detector
- `use()` API for plugin registration

**Security Hardening:**
- Input validation with size limits
- Safe regex execution with timeout protection
- PII sanitization utilities
- Rate limiter class
- XSS prevention (HTML escaping)
- Injection detection
- URL validation

### Changed
- `verify()` now integrates logging, audit, baseline tracking, and plugins
- Enhanced input validation with better error messages
- Improved error handling throughout codebase

### API Additions
- `ErrorCode`, `ErrorSeverity`, `getErrorMetadata()`
- `Logger`, `getLogger()`, `LogLevel`
- `AuditLogger`, `getAuditLogger()`
- `BaselineStorage`, `getBaselineStorage()`
- `Plugin`, `use()`, `createPlugin()`
- `RateLimiter`, `sanitizeForLogging()`, `safeRegexTest()`

### Documentation
- Complete implementation of enterprise features
- All APIs exported and documented
- CLI commands for baseline management

## [1.3.1] - 2024-12-04

### Added
- **Complete API Reference Documentation** (`docs/API-REFERENCE.md`)
  - Comprehensive programmatic API documentation
  - All functions with parameters, return types, and examples
  - TypeScript type definitions
  - Best practices and error handling
- **JSON Schema for verify() Output** (`schema/verify-result.schema.json`)
  - Formal JSON Schema (draft-07) for VerifyResult
  - Complete type definitions and validation rules
  - Example outputs for reference
  - Machine-readable schema for validation tools
- **Enhanced Documentation**
  - Added schema directory to npm package
  - Improved API discoverability

### Changed
- Package now includes `schema/` directory in published files
- Enhanced type safety with formal JSON schema

### Documentation
- Complete API reference with all functions documented
- JSON schema for programmatic validation
- TypeScript type definitions reference
- Best practices guide

## [1.3.0] - 2024-12-04

### Added
- **HTTP Server Mode**: New `llmverify-serve` command starts a long-running HTTP API server
  - Default port 9009, configurable via `--port` flag
  - RESTful endpoints: `/verify`, `/check-input`, `/check-pii`, `/classify`, `/health`
  - Full CORS support for local development
  - Graceful shutdown handling
- **IDE Integration**: Comprehensive guide for Windsurf, Cursor, VS Code, and custom IDEs
  - Example code for TypeScript, JavaScript, Python
  - System prompt templates for AI assistants
  - Production deployment guidelines
- **Server Endpoints**:
  - `POST /verify` - Main verification endpoint (accepts `text` or `content`)
  - `POST /check-input` - Input safety check for prompt injection
  - `POST /check-pii` - PII detection and redaction
  - `POST /classify` - Output classification with intent and hallucination risk
  - `GET /health` - Health check with version info
  - `GET /` - API documentation endpoint
- **Enhanced CLI**:
  - Improved `--output json` mode for scripting
  - Better error messages and validation
  - Exit codes for CI/CD integration (0=low, 1=moderate, 2=high/critical)

### Changed
- Updated package.json to include Express.js dependency
- Added `bin/llmverify-serve.js` executable
- Enhanced README with server mode documentation and IDE integration examples
- Improved API response format with consistent structure across all endpoints

### Fixed
- CLI now properly handles `--file` and `--json` flags
- Better error handling for missing or invalid input

### Documentation
- Added comprehensive server mode section to README
- Added IDE integration guide with examples for multiple languages
- Added production deployment best practices
- Added API response format documentation
- Updated CLI usage examples

## [1.0.0] - 2025-12-02

### Added
- Initial release of llmverify
- CSM6 Baseline Profile implementation
- Hallucination risk indicator engine
- Consistency checking engine
- JSON validation engine
- Prompt injection detection (OWASP LLM-01 aligned)
- PII detection (email, phone, SSN, credit cards, API keys)
- Harmful content detection
- CLI tool with text and JSON output
- Privacy guarantees (100% local processing in free tier)
- Confidence intervals on all scores
- Explicit limitations in all results

### Security
- Zero network traffic in free tier
- No telemetry in free tier
- Privacy validation enforced at runtime

### Documentation
- Complete README with examples
- Privacy guarantee documentation
- Accuracy statement and limitations
- CSM6 framework documentation
