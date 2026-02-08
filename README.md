# llmverify

**Stop shipping unsafe AI output.** Local-first verification, safety monitoring, and guardrails for any LLM — in one `npm install`.

[![npm version](https://badge.fury.io/js/llmverify.svg)](https://www.npmjs.com/package/llmverify)
[![CI](https://github.com/subodhkc/llmverify-npm/actions/workflows/ci.yml/badge.svg)](https://github.com/subodhkc/llmverify-npm/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**100% Local** | **No Telemetry** | **Privacy-First** | **500 free calls/day**

---

## The Problem

You're building with GPT-4, Claude, Gemini, or any LLM. Your AI:

- **Hallucinates** facts and citations that don't exist
- **Leaks PII** — emails, phone numbers, SSNs in responses
- **Gets prompt-injected** — users trick it into ignoring instructions
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

### Complete Feature Map

| Category | Feature | Function | What it does |
|----------|---------|----------|-------------|
| **Safety** | Prompt injection defense | `isInputSafe()` | Block jailbreaks, instruction override, data exfiltration |
| **Safety** | PII detection & redaction | `redactPII()` / `containsPII()` | Strip emails, phones, SSNs, credit cards, API keys |
| **Safety** | Harmful content filtering | `checkHarmfulContent()` | Flag toxic, violent, or inappropriate responses |
| **Safety** | Injection risk scoring | `getInjectionRiskScore()` | 0–1 numerical severity score |
| **Quality** | Hallucination risk | `calculateHallucinationRisk()` | Detect hedging, self-contradiction, unsupported claims |
| **Quality** | JSON validation & repair | `detectAndRepairJson()` | Fix missing brackets, trailing commas, unquoted keys |
| **Quality** | Output classification | `classify(prompt, output)` | Categorize by intent, topic, compliance risk |
| **Quality** | Consistency analysis | `ConsistencyEngine` | Detect divergent answers to the same question |
| **DevEx** | One-line verify | `verify(text)` | Full risk assessment in one call |
| **DevEx** | Zod-like guard API | `guard()` / `safe()` / `parse()` | Familiar patterns — `{ok, data, risk}` |
| **DevEx** | 9 LLM adapters | `createAdapter({provider})` | OpenAI, Anthropic, Groq, Google, DeepSeek, Mistral, Cohere, local, custom |
| **DevEx** | Plugin system | `use(createPlugin())` | Add custom verification rules |
| **DevEx** | CLI presets | `--preset dev\|prod\|strict` | One command for any environment |
| **Ops** | Runtime health monitor | `monitorLLM(client)` | Track latency, token drift, behavioral changes |
| **Ops** | Sentinel regression tests | `runAllSentinelTests()` | 4 proactive tests to catch LLM regressions |
| **Ops** | Audit logging | `AuditLogger` | Local-only trail for SOC2/HIPAA/GDPR evidence |
| **Ops** | Baseline drift detection | `BaselineStorage` | Alert when LLM behavior changes from baseline |
| **Privacy** | 100% local processing | — | Zero network requests, verifiable with tcpdump |
| **Privacy** | No telemetry | — | No tracking, no phone-home, no data collection |

> **All detection is 100% deterministic** — regex + heuristics, zero ML, zero AI inference. Same input = same output, always.

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

// 1. Check user input before sending to AI
if (!isInputSafe(userMessage)) {
  return { error: 'Invalid input detected' };
}

// 2. Get AI response (your existing code)
const aiResponse = await yourLLM.generate(userMessage);

// 3. Verify the output before showing to users
const result = await verify(aiResponse);

if (result.risk.level === 'critical') {
  return { error: 'Response failed safety check' };
}

// 4. Redact any PII before logging
const { redacted } = redactPII(aiResponse);
console.log(redacted); // "Contact [REDACTED] at [REDACTED]"
```

That's it. Three lines of safety between your LLM and your users.

---

## For IDE Users (Windsurf, VS Code, Cursor)

llmverify includes a REST server and clipboard monitor for real-time verification inside your IDE.

```bash
# Terminal 1: Start verification server
npm run serve

# Terminal 2: Start clipboard monitor
npm run monitor

# Now copy any AI response → see risk scores automatically
```

**Port conflict?** Run `npm run serve:force`

You can also use the programmatic IDE extension:

```javascript
import { LLMVerifyIDE, createIDEExtension } from 'llmverify';

const ide = new LLMVerifyIDE({ useLocalFallback: true });
const result = await ide.verify(clipboardText);
```

[Full IDE Setup Guide →](QUICK-START.md)

---

## Core Functions

### 1. Verify AI Output

Checks AI responses for safety, accuracy, and quality before showing to users.

```javascript
const { verify } = require('llmverify');

// Object form
const result = await verify({ content: aiResponse });

// String shorthand (same thing)
const result = await verify(aiResponse);

console.log(result.risk.level);   // "low", "moderate", "high", "critical"
console.log(result.risk.overall); // 0.172 (17.2% risk)
console.log(result.limitations);  // What wasn't checked (transparency)
```

**Risk Levels:**
- **LOW (0-25%)**: Safe to use
- **MODERATE (26-50%)**: Review recommended
- **HIGH (51-75%)**: Fix before using
- **CRITICAL (76-100%)**: Do not use

[Risk Levels Guide →](docs/RISK-LEVELS.md)

---

### 2. Check Input Safety

**What it does:** Validates user input before sending to AI  
**When to use:** On every user message  
**Benefit:** Prevent prompt injection attacks

```javascript
const { isInputSafe } = require('llmverify');

if (!isInputSafe(userMessage)) {
  return { error: 'Invalid input detected' };
}

// Safe to send to AI
const aiResponse = await callAI(userMessage);
```

**What it checks:**
- Prompt injection patterns
- Malicious commands
- Suspicious formatting
- Excessive length

---

### 3. Remove PII

**What it does:** Redacts personal information from text  
**When to use:** Before logging or storing AI responses  
**Benefit:** GDPR/CCPA compliance, privacy protection

```javascript
const { redactPII } = require('llmverify');

const { redacted, piiCount } = redactPII(aiResponse);

console.log(redacted);  // "Contact us at [REDACTED]"
console.log(piiCount);  // 2
```

**Detects:**
- Email addresses
- Phone numbers
- Social Security Numbers
- Credit card numbers
- API keys

---

### 4. Fix Malformed JSON

**What it does:** Repairs broken JSON from AI responses  
**When to use:** When AI returns invalid JSON  
**Benefit:** Avoid parsing errors, improve reliability

```javascript
const { repairJSON } = require('llmverify');

const brokenJSON = '{"name": "John", "age": 30';  // Missing }
const fixed = repairJSON(brokenJSON);

console.log(fixed);  // {"name": "John", "age": 30}
```

**Fixes:**
- Missing brackets/braces
- Trailing commas
- Unquoted keys
- Escape issues

---

### 5. Classify Output

**What it does:** Categorizes AI responses by intent/type  
**When to use:** Routing, filtering, or organizing responses  
**Benefit:** Automated content organization

```javascript
const { classify } = require('llmverify');

const result = classify('Summarize this article', aiResponse);

console.log(result.intent);       // "question", "answer", "code", "explanation"
console.log(result.confidence);  // 0.85
```

**Categories:**
- Question
- Answer
- Code
- Explanation
- Instruction
- Creative

---

### 6. Monitor Performance

**What it does:** Tracks AI system health and performance  
**When to use:** Production monitoring  
**Benefit:** Detect issues before users do

```javascript
const { monitor } = require('llmverify');

monitor.track({
  model: 'gpt-4',
  latency: 1200,
  tokens: 500,
  cost: 0.02
});

const health = monitor.getHealth();
console.log(health.status);  // "healthy", "degraded", "critical"
```

**Monitors:**
- Response latency
- Token usage
- Error rates
- Cost tracking
- Behavioral drift

---

### 7. Audit Logging

**What it does:** Creates compliance-ready audit trails  
**When to use:** Regulated industries, compliance requirements  
**Benefit:** Meet SOC2, HIPAA, GDPR requirements

```javascript
const { audit } = require('llmverify');

audit.log({
  action: 'ai_response_verified',
  user: 'user_123',
  riskLevel: 'low',
  timestamp: new Date()
});

const logs = audit.query({ user: 'user_123', limit: 10 });
```

**Captures:**
- All verifications
- Risk scores
- User actions
- Timestamps
- Findings

---

### 8. Generate Compliance Badge

**What it does:** Creates verification badges for your content  
**When to use:** Show users content is verified  
**Benefit:** Build trust, demonstrate safety

```javascript
const { generateBadge } = require('llmverify');

const badge = generateBadge({
  riskLevel: 'low',
  score: 17.2,
  verified: true
});

// Use in HTML
// <img src="data:image/svg+xml;base64,..." alt="Verified" />
```

**Badge Types:**
- Verification status
- Risk level
- Score display
- Custom branding

---

## Server Mode (REST API)

**What it does:** Run llmverify as a standalone service  
**When to use:** IDE integration, microservices, external tools  
**Benefit:** Language-agnostic, easy integration

```bash
# Start server
npm run serve

# Server runs on http://localhost:9009
```

**Endpoints:**

```bash
# Health check
GET /health

# Verify content
POST /verify
Body: {"content": "AI response text"}

# Check input
POST /check-input
Body: {"input": "User message"}

# Detect PII
POST /check-pii
Body: {"content": "Text with PII"}

# Classify
POST /classify
Body: {"content": "AI response"}
```

**Example:**
```javascript
const response = await fetch('http://localhost:9009/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ content: aiResponse })
});

const result = await response.json();
```

[Server API Reference →](docs/API-REFERENCE.md)

---

## CLI Tools

**What it does:** Verify content from command line  
**When to use:** Scripts, automation, testing  
**Benefit:** No code required

```bash
# Verify a file
llmverify verify response.txt

# Check input
llmverify check-input "User message"

# Redact PII
llmverify redact-pii document.txt

# System health
llmverify doctor
```

[CLI Reference →](docs/CLI-REFERENCE.md)

---

## Integration Examples

### With OpenAI

```javascript
const OpenAI = require('openai');
const { verify, isInputSafe } = require('llmverify');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function safeChat(userMessage) {
  // 1. Validate input
  if (!isInputSafe(userMessage)) {
    throw new Error('Invalid input');
  }
  
  // 2. Get AI response
  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: userMessage }]
  });
  
  const aiResponse = completion.choices[0].message.content;
  
  // 3. Verify output
  const verification = await verify(aiResponse);
  
  if (verification.risk.level === 'critical') {
    throw new Error('Response failed safety check');
  }
  
  return {
    response: aiResponse,
    risk: verification.risk
  };
}
```

### With Express API

```javascript
const express = require('express');
const { verify, isInputSafe, redactPII } = require('llmverify');

const app = express();

app.post('/chat', async (req, res) => {
  const { message } = req.body;
  
  // Validate input
  if (!isInputSafe(message)) {
    return res.status(400).json({ error: 'Invalid input' });
  }
  
  // Get AI response
  const aiResponse = await callAI(message);
  
  // Verify output
  const verification = await verify(aiResponse);
  
  // Redact PII
  const { redacted } = redactPII(aiResponse);
  
  // Block critical risk
  if (verification.risk.level === 'critical') {
    return res.status(400).json({ error: 'Response failed safety check' });
  }
  
  res.json({
    response: redacted,
    riskScore: verification.risk.overall,
    riskLevel: verification.risk.level
  });
});
```

### With Streaming

```javascript
const { verify } = require('llmverify');

async function streamWithVerification(userMessage) {
  let fullResponse = '';
  
  // Stream AI response
  const stream = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: userMessage }],
    stream: true
  });
  
  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || '';
    fullResponse += content;
    process.stdout.write(content);  // Stream to user
  }
  
  // Verify after streaming completes
  const verification = await verify(fullResponse);
  
  if (verification.risk.level === 'high' || 
      verification.risk.level === 'critical') {
    console.log('\n[WARNING] Response has elevated risk');
    console.log(`Risk: ${verification.risk.overall * 100}%`);
  }
  
  return { fullResponse, verification };
}
```

---

## Configuration

Create `.llmverify.json` in your project:

```json
{
  "ignoreFindings": ["injection-marker"],
  "context": "ai-agent-development",
  "whitelist": {
    "pii": ["example.com", "test.com"]
  },
  "strictMode": false,
  "logLevel": "info"
}
```

[Configuration Guide →](docs/CONFIGURATION.md)

---

## Pricing & Tiers

All features available on every tier. Usage tracked locally — no data leaves your machine.

| Tier | Price | Daily Calls | Content Limit | Support |
|------|-------|-------------|---------------|---------|
| **Free** | $0 | 500/day | 50KB | Community |
| **Starter** | $79/mo | 5,000/day | 200KB | Email (72hr) |
| **Pro** | $299/mo | 50,000/day | 1MB | Email (24hr) |
| **Business** | $999/mo | Unlimited | Unlimited | Slack (4hr SLA) |

```bash
# Check your usage anytime
npx llmverify usage

# See current tier and limits
npx llmverify tier
```

All calls share a single daily pool: verify, guard, safe, parse, sentinel, monitor.  
Usage resets at midnight local time. A 10% grace period lets you finish work without hard cutoffs.

---

## Sentinel Tests

Proactive behavioral tests that verify your LLM is responding correctly — run in CI/CD, health checks, or before deployment.

```javascript
const { sentinel } = require('llmverify');

// One-liner — runs all 4 sentinel tests
const suite = await sentinel.quick(myClient, 'gpt-4');
console.log(suite.passed);    // true/false
console.log(suite.passRate);  // 0.75 = 3/4 passed

// Run a single test
const echo = await sentinel.test('staticEchoTest', myClient, 'gpt-4');
```

**Built-in tests:**
- **Static Echo** — Does the LLM echo back exact content?
- **Duplicate Query** — Are responses consistent across identical prompts?
- **Structured List** — Can it follow output format instructions?
- **Short Reasoning** — Does it show step-by-step reasoning?

---

## Health Monitoring

Wraps any LLM client with real-time health tracking. Detects latency spikes, token drift, and behavioral changes automatically.

```javascript
const { monitorLLM } = require('llmverify');

const monitored = monitorLLM(openaiClient, {
  hooks: {
    onUnstable: (report) => alert('LLM unstable!'),
    onDegraded: (report) => console.warn('Degraded'),
    onRecovery: (report) => console.log('Recovered')
  }
});

const response = await monitored.generate({ prompt: 'Hello' });
console.log(response.llmverify.health);  // 'stable' | 'degraded' | 'unstable'
```

---

## LLM Provider Adapters

Unified interface for any LLM provider. Swap providers without changing your verification code.

```javascript
const { createAdapter, monitorLLM } = require('llmverify');

// Works with OpenAI, Anthropic, Groq, Google, DeepSeek, Mistral, Cohere, local models
const client = createAdapter({ provider: 'openai', apiKey: process.env.OPENAI_API_KEY });
const monitored = monitorLLM(client);

const response = await monitored.generate({ prompt: 'Hello', model: 'gpt-4' });
```

---

## Plugin System

Extend llmverify with custom verification rules.

```javascript
const { use, createPlugin, createRegexPlugin } = require('llmverify');

// Built-in plugin helpers
use(createRegexPlugin('no-urls', /https?:\/\/\S+/g, 'URL detected in output'));

// Custom plugin
use(createPlugin('custom-check', async (ctx) => {
  const hasBadWord = ctx.content.includes('forbidden');
  return { passed: !hasBadWord, message: hasBadWord ? 'Forbidden word found' : 'Clean' };
}));
```

---

## Error Handling

Every error includes a code, severity, recoverability flag, and a human-readable suggestion.

```javascript
const { verify, LLMVerifyError } = require('llmverify');

try {
  const result = await verify(aiResponse);
} catch (err) {
  if (err instanceof LLMVerifyError) {
    console.log(err.code);                // "LLMVERIFY_1003"
    console.log(err.metadata.severity);   // "medium"
    console.log(err.metadata.recoverable); // true
    console.log(err.metadata.suggestion); // "Reduce content size or split into smaller chunks"
  }
}
```

**Error code ranges:**
- **1xxx** — Input validation (empty, too large, bad format)
- **2xxx** — Configuration (malformed config, invalid tier)
- **3xxx** — Runtime (timeout, engine failure)
- **4xxx** — Server (port in use, rate limit)
- **5xxx** — Privacy/security (privacy violation, unauthorized)
- **6xxx** — Plugins (not found, load failed)
- **7xxx** — Usage/tier (daily limit, content length)

All errors are typed — use `instanceof` checks or the `code` property for programmatic handling.

---

## DX Shortcuts

```javascript
// String shorthand — no object wrapper needed
const result = await verify("The Earth is flat.");

// Default export
import llmverify from 'llmverify';
const result = await llmverify.verify(text);

// Shorthand APIs
import { ai, llm, guardrails } from 'llmverify';
const safe = await ai.safe(text);       // returns text or null
const guard = await ai.guard(text);     // returns { ok, risk, findings }
const score = ai.riskScore(text);       // injection risk 0-1
```

---

## Performance

- **Verification:** <100ms for typical responses
- **PII Detection:** <50ms
- **Input Validation:** <10ms
- **Memory:** <50MB baseline
- **Bundle:** No heavy ML models — pattern-based, runs anywhere Node runs

---

## Requirements

- **Node.js:** ≥18.0.0
- **OS:** Windows, Linux, macOS
- **Memory:** 512MB minimum
- **Disk:** 50MB

---

## Quick Reference

| Task | Function | Example |
|------|----------|---------|
| Verify AI output | `verify()` | `await verify(response)` |
| Verify (string) | `verify()` | `await verify("text")` |
| Check input | `isInputSafe()` | `isInputSafe(message)` |
| Remove PII | `redactPII()` | `redactPII(text)` |
| Fix JSON | `repairJSON()` | `repairJSON(broken)` |
| Classify | `classify()` | `classify(prompt, response)` |
| Monitor health | `monitorLLM()` | `monitorLLM(client)` |
| Sentinel tests | `sentinel.quick()` | `await sentinel.quick(client, model)` |
| Guard (Zod-like) | `guard()` | `await guard(text)` |
| Safe check | `safe()` | `await safe(text)` |
| Plugin | `use()` | `use(createRegexPlugin(...))` |
| Check usage | CLI | `npx llmverify usage` |
| Audit | `audit.log()` | `audit.log(event)` |
| Badge | `generateBadge()` | `generateBadge(result)` |
| Adapter | `createAdapter()` | `createAdapter({ provider: 'openai', apiKey })` |

---

## Documentation

- [Quick Start Guide](QUICK-START.md) — IDE setup in 5 minutes
- [Integration Guide](docs/INTEGRATION-GUIDE.md) — Add to your app
- [API Reference](docs/API-REFERENCE.md) — Complete API docs
- [Risk Levels](docs/RISK-LEVELS.md) — What scores mean
- [Error Guide](docs/ERROR-GUIDE.md) — Fix common errors
- [CLI Reference](docs/CLI-REFERENCE.md) — Command line tools
- [AI Guide](AI-GUIDE.md) — Help AI assistants use llmverify

---

## Support

- **Issues:** [GitHub Issues](https://github.com/subodhkc/llmverify-npm/issues)
- **Docs:** [Full Documentation](docs/)
- **Examples:** [/examples](examples/)

---

## License

MIT License — See [LICENSE](LICENSE) for details.

---

**Made with care for AI safety and developer experience.**
