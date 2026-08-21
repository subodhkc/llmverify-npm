# llmverify

You shipped an AI feature. Your LLM hallucinated a citation, leaked a customer's email, and followed a prompt-injection buried in user input — on the same day. llmverify is the safety layer that sits between your LLM and your users.

Local-first verification, PII redaction, prompt-injection defense, and runtime monitoring for any LLM. One `npm install`. Zero telemetry. No API keys on the free tier.

[![npm version](https://badge.fury.io/js/llmverify.svg)](https://www.npmjs.com/package/llmverify)
[![CI](https://github.com/subodhkc/llmverify-npm/actions/workflows/ci.yml/badge.svg)](https://github.com/subodhkc/llmverify-npm/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Last Updated:** August 21, 2026
**Version:** 1.6.1
**Node:** >= 18.0.0
**License:** MIT

---

## Links

- **Product page:** [haiec.com/llmverify](https://www.haiec.com/llmverify)
- **npm:** [npmjs.com/package/llmverify](https://www.npmjs.com/package/llmverify)
- **GitHub:** [github.com/subodhkc/llmverify-npm](https://github.com/subodhkc/llmverify-npm)
- **Python (placeholder):** [pypi.org/project/llmverify](https://pypi.org/project/llmverify/) — namespace reservation, not a port of this package
- **Author:** [Subodh Kc](https://subodhkc.com)

---

## The problem

You build with GPT-4, Claude, Gemini, or any LLM. The model:

- **Hallucinates** facts and citations that do not exist.
- **Leaks PII** — emails, phone numbers, SSNs, API keys in responses.
- **Follows prompt injections** — users trick it into ignoring your instructions.
- **Returns broken JSON** that crashes your parser.
- **Drifts** in quality over time, and nobody notices until a user complains.

You need a guardrail between the model and your users. That is llmverify.

---

## Install

```bash
npm install llmverify
```

Everything runs locally. The free tier makes zero network requests and needs no API key. Free tier limit: 500 verification calls per day (tracked locally, never sent anywhere).

---

## What you get

| Function | One-liner | What it does |
|----------|-----------|--------------|
| `verify(content)` | `await verify(aiResponse)` | Runs hallucination, consistency, safety, and CSM6 checks; returns a risk level and findings |
| `isInputSafe(input)` | `isInputSafe(userMessage)` | Blocks prompt injection, jailbreaks, and malicious input before it reaches the model |
| `redactPII(text)` | `redactPII(aiResponse)` | Masks emails, phones, SSNs, credit cards, and API keys |
| `containsPII(text)` | `containsPII(text)` | Returns true if PII is present |
| `detectAndRepairJson(...)` | `detectAndRepairJson(prompt, response)` | Detects and repairs broken JSON output |
| `monitorLLM(client)` | `monitorLLM(openaiClient)` | Wraps any LLM client; tracks latency, token drift, and behavioral changes |
| `sentinel.quick(...)` | `await sentinel.quick(client, model)` | Runs regression tests against your model before users see changes |
| `classify(...)` | `classify(prompt, response)` | Intent detection, hallucination signals, and instruction compliance |
| `auditLog(event)` | `auditLog({ ... })` | Appends a local, hash-only audit entry for SOC 2 / HIPAA / GDPR evidence |
| `run`, `prodVerify`, `ciVerify` | `await prodVerify(content)` | Preset pipelines for dev, prod, strict, fast, and CI use |

---

## Quick start (30 seconds)

```javascript
const { verify, isInputSafe, redactPII } = require('llmverify');

// 1. Block prompt injection before it reaches the model.
if (!isInputSafe(userMessage)) {
  return { error: 'Invalid input detected' };
}

// 2. Verify the model's output.
const aiResponse = await yourLLM.generate(userMessage);
const result = await verify(aiResponse);

if (result.risk.level === 'critical') {
  return { error: 'Response failed safety check' };
}

// 3. Strip PII before the response reaches a user or a log.
const { redacted } = redactPII(aiResponse);
console.log(redacted);
```

Three lines of safety between your LLM and your users. No config file required. No API key required.

---

## How it works

llmverify runs deterministic, pattern-based engines locally — no model calls, no network on the free tier. Same input plus same rules equals same result. Every result carries an explicit `limitations` array stating what was and was not checked, so you never mistake a clean score for a guarantee.

**Framework alignment (baseline mapping only — not certification):**
- OWASP LLM Top 10
- NIST AI RMF
- EU AI Act
- ISO 42001
- CSM6 (HAIEC's 38-rule control set)

---

## CLI

```bash
# Verify a string from the terminal.
npx llmverify verify "The capital of France is London."

# Start a local HTTP API for IDE / tool integration (localhost only by default).
npx llmverify-serve --port=9009

# Expose to the network only on a trusted network. There is no auth on the API.
npx llmverify-serve --host=0.0.0.0 --port=9009
```

The server binds to `127.0.0.1` by default, restricts CORS to localhost origins, and rate-limits clients (100 requests / 60s). It requires `express` (an optional dependency that installs by default).

---

## Limitations

llmverify is a triage tool, not a truth oracle. Be honest with yourself about what it can and cannot do:

- **It cannot definitively prove hallucinations.** Hallucination signals are pattern-based. "The capital of France is London" scores low because the text looks internally consistent. Ground-truth verification requires a source document you provide.
- **It does not replace human review.** Use it to triage, not to approve.
- **PII detection is regex-based.** It catches standard formats (emails, US phones, SSNs, credit cards, common API keys). It misses obfuscated, image-embedded, or encoded PII. Accuracy is roughly 90% for standard formats, lower for variations.
- **Prompt-injection detection is pattern-based.** Novel or obfuscated injections can evade it.
- **Free tier is 100% local.** ML-enhanced features require a paid tier and an explicit API key; the free tier never makes network requests and never sends data anywhere.

If a claim matters, verify it yourself. llmverify narrows the risk surface; it does not eliminate it.

---

## Documentation

- [Quick Start](QUICK-START.md)
- [Integration Guide](docs/INTEGRATION-GUIDE.md)
- [API Reference](docs/API-REFERENCE.md)
- [Risk Levels](docs/RISK-LEVELS.md)
- [CLI Reference](docs/CLI-REFERENCE.md)
- [Limitations](docs/LIMITATIONS.md)

---

## Part of HAIEC

llmverify is part of the [HAIEC](https://www.haiec.com) AI governance platform. Use it alongside the [AI Security Scanner](https://www.haiec.com/dashboard/ai-security), the [CI/CD pipeline integration](https://www.haiec.com/dashboard/ai-security/ci-setup), and [Runtime Injection Testing](https://www.haiec.com/dashboard/runtime-security).

---

## Support

- **Issues:** [GitHub Issues](https://github.com/subodhkc/llmverify-npm/issues)
- **Docs:** [Full documentation](docs/)

---

## License

MIT — see [LICENSE](LICENSE).

---

**Recommendation (not legal advice):** Run `verify()` on every model output that reaches a user, and `isInputSafe()` on every user input that reaches a model. Treat the risk level as a triage signal, not an approval.
