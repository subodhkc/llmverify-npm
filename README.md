# llmverify

**Stop shipping unsafe AI output.** Local-first verification, safety monitoring, and guardrails for any LLM â€” in one `npm install`.

[![npm version](https://badge.fury.io/js/llmverify.svg)](https://www.npmjs.com/package/llmverify)
[![CI](https://github.com/subodhkc/llmverify-npm/actions/workflows/ci.yml/badge.svg)](https://github.com/subodhkc/llmverify-npm/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**100% Local** | **No Telemetry** | **Privacy-First** | **500 free calls/day**

---

## Links

- **Product Page:** [subodhkc.com/products/llmverify](https://subodhkc.com/products/llmverify)
- **npm:** [npmjs.com/package/llmverify](https://www.npmjs.com/package/llmverify)
- **GitHub:** [github.com/subodhkc/llmverify-npm](https://github.com/subodhkc/llmverify-npm)
- **Python Package (PyPI):** [github.com/subodhkc/llmverify](https://github.com/subodhkc/llmverify)
- **Author:** [Subodh KC](https://subodhkc.com) â€” AI governance, compliance, and security leader

---

## The Problem

You're building with GPT-4, Claude, Gemini, or any LLM. Your AI:

- **Hallucinates** facts and citations that don't exist
- **Leaks PII** â€” emails, phone numbers, SSNs in responses
- **Gets prompt-injected** â€” users trick it into ignoring instructions
- **Returns broken JSON** that crashes your parser
- **Drifts in quality** over time without anyone noticing

You need a safety layer between your LLM and your users. That's llmverify.

## What You Get

```
npm install llmverify
```

| Feature | One-liner | What it catches |
|---------|-----------|-----------------|
| **Verify output** | `await verify(aiResponse)` | Hallucinations, harmful content, quality issues |
| **Block injections** | `isInputSafe(userMessage)` | Prompt injection, jailbreaks, malicious input |
| **Redact PII** | `redactPII(text)` | Emails, phones, SSNs, credit cards, API keys |
| **Fix broken JSON** | `repairJSON(broken)` | Missing brackets, trailing commas, unquoted keys |
| **Monitor health** | `monitorLLM(client)` | Latency spikes, token drift, behavioral changes |
| **Sentinel tests** | `sentinel.quick(client, model)` | LLM regressions before users see them |
| **Classify output** | `classify(prompt, response)` | Intent detection, content categorization |
| **Audit trail** | `audit.log(event)` | SOC2, HIPAA, GDPR compliance evidence |

**Everything runs locally. No data leaves your machine. No API keys needed for free tier.**

> **Part of the [HAIEC](https://www.haiec.com) AI governance platform.** Use alongside [AI Security Scanner](https://www.haiec.com/dashboard/ai-security), [CI/CD Pipeline](https://www.haiec.com/dashboard/ai-security/ci-setup), and [Runtime Injection Testing](https://www.haiec.com/dashboard/runtime-security).

---

## Install

```bash
npm install llmverify
```

---

## Quick Start (30 seconds)

```javascript
const { verify, isInputSafe, redactPII } = require('llmverify');

if (!isInputSafe(userMessage)) {
  return { error: 'Invalid input detected' };
}

const aiResponse = await yourLLM.generate(userMessage);
const result = await verify(aiResponse);

if (result.risk.level === 'critical') {
  return { error: 'Response failed safety check' };
}

const { redacted } = redactPII(aiResponse);
console.log(redacted);
```

Three lines of safety between your LLM and your users.

---

## Documentation

- [Quick Start Guide](QUICK-START.md)
- [Integration Guide](docs/INTEGRATION-GUIDE.md)
- [API Reference](docs/API-REFERENCE.md)
- [Risk Levels](docs/RISK-LEVELS.md)
- [CLI Reference](docs/CLI-REFERENCE.md)

---

## Support

- **Issues:** [GitHub Issues](https://github.com/subodhkc/llmverify-npm/issues)
- **Docs:** [Full Documentation](docs/)

---

## License

MIT License â€” See [LICENSE](LICENSE) for details.

---

**Made with care for AI safety and developer experience.**