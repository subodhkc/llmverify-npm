# Changelog

All notable changes to llmverify will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
