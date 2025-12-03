# Changelog

All notable changes to llmverify will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
