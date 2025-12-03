# llmverify

> Open-source LLM output monitoring, risk scoring, and classification for Node.js.

[![npm version](https://badge.fury.io/js/llmverify.svg)](https://www.npmjs.com/package/llmverify)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Downloads](https://img.shields.io/npm/dm/llmverify.svg)](https://www.npmjs.com/package/llmverify)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/Tests-296%20Passing-green.svg)]()
[![Coverage](https://img.shields.io/badge/Coverage-84%25-yellowgreen.svg)]()

---

### New to llmverify?

| Guide | Description |
|-------|-------------|
| [Getting Started](docs/GETTING-STARTED.md) | Beginner-friendly guide for students and newcomers |
| [For Developers](docs/FOR-DEVELOPERS.md) | Integration patterns, configuration, and production usage |

---

**llmverify** is a local-first monitoring and classification layer for LLM outputs. Works with OpenAI, Claude, Llama, Gemini, or any LLM provider.

### What llmverify Does

| Feature | Status | Description |
|---------|--------|-------------|
| **Prompt Injection Detection** | Stable | Pattern-based attack detection |
| **PII Redaction** | Stable | Regex-based sensitive data removal |
| **JSON Repair** | Stable | Auto-fix common JSON formatting errors |
| **Runtime Health Monitoring** | Stable | Track latency, token rate, behavioral drift |
| **Model-Agnostic Adapters** | Stable | Unified interface for any LLM provider |
| **Output Classification** | Stable | Intent detection, instruction compliance |
| **Hallucination Risk Scoring** | Beta | Heuristic-based risk indicators |
| **Harmful Content Detection** | Beta | Pattern-based content filtering |

**Important**: llmverify uses heuristics, not AI. It provides risk indicators, not ground truth. See [LIMITATIONS.md](docs/LIMITATIONS.md) for details.

Built on the [CSM6 framework](https://github.com/haiec/csm6-framework) implementing NIST AI RMF, OWASP LLM Top 10, and ISO 42001 guidelines.

---

## Quick Start

### Step 1: Install

```bash
npm install llmverify
```

### Step 2: Basic Usage

```typescript
import { verify, isInputSafe, redactPII } from 'llmverify';

// Verify AI output safety
const result = await verify({ content: aiOutput });
if (result.risk.level === 'critical') {
  console.log('Block this content');
}

// Check user input for prompt injection
if (!isInputSafe(userInput)) {
  throw new Error('Potential attack detected');
}

// Redact PII before displaying
const { redacted } = redactPII(aiOutput);
console.log(redacted); // "Contact [REDACTED] at [REDACTED]"
```

### Step 3: Add LLM Monitoring (Optional)

```typescript
import { createAdapter, monitorLLM } from 'llmverify';
import OpenAI from 'openai';

// Wrap any LLM client with health monitoring
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const llm = createAdapter({ provider: 'openai', client: openai });
const monitored = monitorLLM(llm, {
  hooks: {
    onUnstable: (report) => alert('LLM is degraded!')
  }
});

const response = await monitored.generate({ prompt: 'Hello!' });
console.log(response.llmverify.health); // 'stable' | 'degraded' | 'unstable'
```

---

## Why llmverify?

| Problem | Solution |
|---------|----------|
| How do I detect prompt injection? | `isInputSafe(text)` |
| How do I redact PII from AI output? | `redactPII(text)` |
| How do I verify LLM output is safe? | `verify(text)` |
| How do I add AI guardrails to Express? | Drop-in middleware |
| How do I check for hallucinations? | Built-in risk scoring |
| How do I validate AI-generated JSON? | Auto-repair + validation |

llmverify works because it:
- Works 100% locally (zero network requests)
- Provides drop-in verification middleware
- Implements industry-standard compliance checks
- Requires zero configuration
- Returns confidence intervals, not false certainties

---

## Installation

```bash
# npm
npm install llmverify

# yarn
yarn add llmverify

# pnpm
pnpm add llmverify
```

---

## Configuration Modes

### Low-Noise Production Mode

```typescript
import { monitorLLM, classify } from 'llmverify';

// Minimal monitoring - only latency and structure
const monitored = monitorLLM(client, {
  engines: {
    latency: true,
    tokenRate: false,
    fingerprint: false,
    structure: true
  }
});

// Classification with relaxed thresholds
const result = classify(prompt, output, {
  hallucination: {
    weights: {
      speculative: 0.2,
      overconfident: 0.3
    }
  },
  compression: {
    expectedWords: { level1: 20, level2: 80, level3: 150 }
  }
});
```

### Full Diagnostic Mode

```typescript
import { monitorLLM, classify } from 'llmverify';

// All engines enabled
const monitored = monitorLLM(client, {
  engines: {
    latency: true,
    tokenRate: true,
    fingerprint: true,
    structure: true
  },
  hooks: {
    onHealthCheck: (report) => console.log('Health:', report),
    onDegraded: (report) => console.warn('Degraded:', report),
    onUnstable: (report) => console.error('Unstable:', report)
  }
});

// Full classification with all features
const result = classify(prompt, output, {
  instructionRules: [
    { id: 'format', type: 'format', params: { expect: 'json' } }
  ],
  hallucination: { internalSignals: true },
  compression: { enabled: true },
  json: { enabled: true, maxRepairSteps: 6 }
});
```

### Tuning Tips

| Issue | Solution |
|-------|----------|
| Too many false positives on PII | Use `minSeverity: 'high'` in CSM6 config |
| Hallucination scores too high | Lower weights: `{ speculative: 0.2, fabricated: 0.2 }` |
| Short answers flagged as compressed | Relax `expectedWords.level1` to 20 |
| JSON repair too aggressive | Set `maxRepairSteps: 2` |
| Early health scores confusing | Wait for 5+ samples before trusting baseline |

---

## API Reference

### 1. Full Verification (Recommended)

```typescript
import { verify } from 'llmverify';

// Standard verification pipeline — industry best practice
const result = await verify({
  content: "Your AI output here"
});

console.log(result.risk.level);    // "low" | "moderate" | "high" | "critical"
console.log(result.risk.action);   // "allow" | "review" | "block"
console.log(result.limitations);   // Always check limitations
```

### 2. Quick Safety Checks (One-Liners)

```typescript
import { isInputSafe, containsPII, getInjectionRiskScore } from 'llmverify';

// Check if user input is safe — commonly used pattern
if (!isInputSafe(userInput)) {
  throw new Error('Potential injection detected');
}

// Check if output contains PII — recommended before displaying
if (containsPII(aiOutput)) {
  console.log('PII detected!');
}

// Get risk score (0-1) — standard verification approach
const risk = getInjectionRiskScore(userInput);
```

### 3. Sanitization & Redaction

```typescript
import { sanitizePromptInjection, redactPII } from 'llmverify';

// Sanitize malicious input — best practice for AI workflows
const { sanitized, removed, wasModified } = sanitizePromptInjection(userInput);

// Redact all PII — industry standard for privacy
const { redacted, piiCount } = redactPII(aiOutput);
console.log(redacted); // "Contact [REDACTED] at [REDACTED]"
```

### 4. Direct Detection

```typescript
import { checkPromptInjection, checkPII, checkHarmfulContent } from 'llmverify';

// Detect prompt injection — OWASP LLM Top 10 aligned
const injectionFindings = checkPromptInjection(userInput);

// Detect PII — 25+ patterns including API keys, tokens
const piiFindings = checkPII(aiOutput);

// Detect harmful content — violence, threats, hate speech
const harmFindings = checkHarmfulContent(aiOutput);
```

### 5. Zod-like Guard API

```typescript
import { guard, safe } from 'llmverify';

// Guard pattern — similar to Zod validation
const guarded = await guard(aiOutput);
if (!guarded.ok) {
  console.log('Validation failed:', guarded.issues);
}

// Safe wrapper — returns null if unsafe
const safeOutput = await safe(aiOutput);
if (safeOutput === null) {
  console.log('Content was unsafe');
}
```

### 6. LangChain-Compatible Chain

```typescript
import { LLMVerifyChain } from 'llmverify';

// Chain pattern — familiar to LangChain users
const chain = new LLMVerifyChain();
const result = await chain.run(aiOutput);
```

---

## Express Middleware — Drop-in AI Safety Layer

```typescript
import express from 'express';
import { 
  isInputSafe, 
  sanitizePromptInjection, 
  containsPII, 
  redactPII 
} from 'llmverify';

const app = express();

// Input validation middleware — recommended for all AI endpoints
app.use('/api/chat', (req, res, next) => {
  const userMessage = req.body.message;
  
  if (!isInputSafe(userMessage)) {
    return res.status(400).json({ error: 'Invalid input detected' });
  }
  
  // Sanitize before passing to LLM
  const { sanitized } = sanitizePromptInjection(userMessage);
  req.body.message = sanitized;
  
  next();
});

// Output sanitization middleware — industry best practice
app.use('/api/chat', (req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (typeof body === 'string' && containsPII(body)) {
      const { redacted } = redactPII(body);
      return originalJson(redacted);
    }
    return originalJson(body);
  };
  next();
});
```

---

## Next.js API Route — Standard Pattern

```typescript
// pages/api/chat.ts — recommended usage pattern
import { verify, isInputSafe, redactPII } from 'llmverify';

export default async function handler(req, res) {
  const { message } = req.body;
  
  // Validate input — industry standard
  if (!isInputSafe(message)) {
    return res.status(400).json({ error: 'Invalid input' });
  }
  
  // Get AI response (your LLM call here)
  const aiResponse = await callYourLLM(message);
  
  // Verify output — best practice
  const verification = await verify({ content: aiResponse });
  
  if (verification.risk.level === 'critical') {
    return res.status(500).json({ error: 'Response blocked for safety' });
  }
  
  // Redact PII before sending — compliance ready
  const { redacted } = redactPII(aiResponse);
  
  return res.status(200).json({ 
    response: redacted,
    risk: verification.risk.level 
  });
}
```

---

## CLI Usage

```bash
# Basic verification — most common usage
npx llmverify "Your AI output here"

# From file
npx llmverify --file output.txt

# JSON validation
npx llmverify --json '{"status": "ok"}'

# Show privacy guarantees
npx llmverify privacy
```

**Exit codes** (CI/CD integration):
- `0`: Low risk (allow)
- `1`: Moderate risk (review)
- `2`: High/Critical risk (block)

---

## What llmverify Detects

### Security (OWASP LLM Top 10 Aligned)
- ✅ Prompt injection (9 attack categories)
- ✅ Jailbreak attempts (DAN, STAN, etc.)
- ✅ System prompt exfiltration
- ✅ Tool/function abuse

### Privacy (25+ PII Patterns)
- ✅ Email, phone, SSN
- ✅ Credit cards, bank accounts
- ✅ API keys (AWS, GitHub, Stripe, Slack)
- ✅ JWT tokens, private keys
- ✅ Passwords, secrets

### Safety
- ✅ Violence, threats
- ✅ Self-harm content
- ✅ Hate speech
- ✅ Dangerous instructions

### Structure
- ✅ JSON validation
- ✅ JSON repair
- ✅ Schema validation

---

## Privacy Guarantee

### Free Tier (100% Local)
- ✅ Zero network requests
- ✅ Zero telemetry
- ✅ Zero data collection
- ✅ Open source — verify yourself

Run `tcpdump` while using it — you'll see zero network traffic.

**We never**:
- Train on your data
- Share with third parties
- Track without consent

---

## Compliance Ready

llmverify implements baseline checks for:
- ✅ **OWASP LLM Top 10** — Security
- ✅ **NIST AI RMF** — Risk Management
- ✅ **EU AI Act** — Compliance
- ✅ **ISO 42001** — AI Management

---

## Configuration

```typescript
import { verify } from 'llmverify';

const result = await verify({
  content: "Your AI output",
  config: {
    tier: 'free',
    engines: {
      hallucination: { enabled: true },
      consistency: { enabled: true },
      jsonValidator: { enabled: true },
      csm6: { 
        enabled: true,
        checks: {
          security: true,
          privacy: true,
          safety: true
        }
      }
    }
  }
});
```

---

## Accuracy & Limitations

**llmverify provides risk indicators, not certainties.**

| Detection Type | Accuracy | Method |
|---------------|----------|--------|
| Prompt Injection | 70-85% | Pattern matching |
| PII Detection | ~90% | Regex patterns |
| Harmful Content | ~60% | Keyword matching |

All results include:
- Confidence intervals
- Methodology explanations
- Explicit limitations

---

## Model-Agnostic Adapters (NEW)

Use any LLM provider with a unified interface. Zero provider logic in your code.

### Supported Providers

| Provider | Adapter | Default Model |
|----------|---------|---------------|
| OpenAI | `openai` | gpt-4o-mini |
| Anthropic | `anthropic` | claude-3-5-sonnet |
| Groq | `groq` | llama-3.1-70b |
| Google AI | `google` | gemini-1.5-flash |
| DeepSeek | `deepseek` | deepseek-chat |
| Mistral | `mistral` | mistral-large |
| Cohere | `cohere` | command-r-plus |
| Local | `local` | (custom) |
| Custom | `custom` | (custom) |

### Basic Usage

```typescript
import { createAdapter, monitorLLM } from 'llmverify';
import OpenAI from 'openai';

// Create unified client from any provider
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const llm = createAdapter({ 
  provider: 'openai', 
  client: openai,
  defaultModel: 'gpt-4o-mini'
});

// Use with monitoring
const monitored = monitorLLM(llm);
const response = await monitored.generate({ 
  prompt: 'Hello!',
  system: 'You are helpful.'
});

console.log(response.text);
console.log(response.llmverify.health); // 'stable'
```

### Local Model Support

```typescript
import { createAdapter } from 'llmverify';

// Wrap any local inference function
const llm = createAdapter({
  provider: 'local',
  client: async (prompt) => {
    // Call llama.cpp, Ollama, vLLM, etc.
    return await myLocalModel(prompt);
  },
  providerName: 'Ollama'
});
```

### Provider Switching

```typescript
import { createAdapter, ProviderId } from 'llmverify';

// Switch providers without changing application code
function getLLM(provider: ProviderId) {
  return createAdapter({ provider, client: clients[provider] });
}

const llm = getLLM(process.env.LLM_PROVIDER as ProviderId);
```

---

## Runtime Health Monitoring

Monitor LLM behavior in real-time with the `monitorLLM` wrapper. Detect latency spikes, token rate changes, and behavioral drift.

### Basic Monitoring

```typescript
import { monitorLLM } from 'llmverify';

// Wrap any LLM client
const client = monitorLLM(yourLLMClient);

const response = await client.generate({ prompt: 'Hello' });

// Health report included with every response
console.log(response.llmverify.health);  // 'stable' | 'minor_variation' | 'degraded' | 'unstable'
console.log(response.llmverify.score);   // 0-1 (0 = healthy)
```

### Monitoring with Hooks

```typescript
import { monitorLLM, HealthReport } from 'llmverify';

const client = monitorLLM(yourLLMClient, {
  hooks: {
    onUnstable: (report: HealthReport) => {
      alert('LLM is unstable!');
      // Switch to fallback provider
    },
    onDegraded: (report: HealthReport) => {
      console.warn('Performance degraded');
    },
    onRecovery: (report: HealthReport) => {
      console.log('LLM recovered');
    }
  },
  thresholds: {
    latencyWarnRatio: 1.5,   // Warn at 1.5x baseline latency
    latencyErrorRatio: 4.0   // Error at 4x baseline
  }
});
```

### What It Monitors

| Metric | Description |
|--------|-------------|
| **Latency** | Response time vs baseline |
| **Token Rate** | Tokens/second throughput |
| **Fingerprint** | Response structure patterns |
| **Structure** | JSON, lists, code blocks |

---

## Sentinel Tests — Proactive LLM Verification

Run synthetic tests to verify LLM behavior before issues affect users.

```typescript
import { runAllSentinelTests } from 'llmverify';

const suite = await runAllSentinelTests({
  client: yourLLMClient,
  model: 'gpt-4'
});

console.log(suite.summary);  // "All critical tests passed (4/4)"
console.log(suite.passRate); // 1.0

// Individual test results
suite.results.forEach(result => {
  console.log(`${result.test}: ${result.passed ? '✅' : '❌'}`);
});
```

### Available Tests

| Test | What It Checks |
|------|----------------|
| `staticEchoTest` | Can echo back exact phrases |
| `duplicateQueryTest` | Consistent responses to same query |
| `structuredListTest` | Proper list formatting |
| `shortReasoningTest` | Basic logical reasoning |

---

## Classification Engine (NEW)

Comprehensive output classification with intent detection, hallucination risk, and instruction compliance.

### Basic Classification

```typescript
import { classify } from 'llmverify';

const result = classify(prompt, output);

console.log(result.intent);           // 'summary' | 'code' | 'list' | etc.
console.log(result.hallucinationRisk); // 0-1 risk score
console.log(result.hallucinationLabel); // 'low' | 'medium' | 'high'
console.log(result.tags);             // ['intent:summary', 'hallucination:low']
```

### Instruction Compliance

```typescript
import { classify, InstructionRule } from 'llmverify';

const rules: InstructionRule[] = [
  { id: 'format', type: 'format', params: { expect: 'list' } },
  { id: 'length', type: 'length', params: { minBullets: 3 } },
  { id: 'include', type: 'include', params: { terms: ['benefit'] } }
];

const result = classify(prompt, output, { instructionRules: rules });

console.log(result.instructionFollowed);  // true/false
console.log(result.instructionCompliance); // 0-1 ratio
```

### JSON Detection & Repair

```typescript
import { classify } from 'llmverify';

const result = classify(prompt, outputWithMalformedJson);

console.log(result.isJson);        // true if valid/repaired
console.log(result.normalizedJson); // Parsed JSON object
console.log(result.details.json.repairSteps); // Repairs applied
```

### What It Detects

| Feature | Description |
|---------|-------------|
| **Intent** | summary, code, list, explanation, etc. |
| **Hallucination Risk** | Overconfident language, fabricated entities |
| **Instruction Compliance** | Format, length, include/exclude terms |
| **JSON Repair** | Auto-fix trailing commas, unquoted keys |
| **Reasoning Compression** | Detect shallow/compressed responses |

---

## Comparison

| Feature | llmverify | Manual Regex | Other Tools |
|---------|-----------|--------------|-------------|
| Zero Config | Yes | No | No |
| 100% Local | Yes | Yes | No |
| Confidence Scores | Yes | No | No |
| Compliance Mapping | Yes | No | No |
| Sanitization | Yes | No | No |
| Runtime Monitoring | Yes | No | No |
| Sentinel Tests | Yes | No | No |
| Model Adapters | Yes | No | No |
| Classification | Yes | No | No |
| TypeScript | Yes | No | Varies |

---

## FAQ

### Does this work with OpenAI/Claude/Llama/Gemini?
Yes. llmverify is model-agnostic. Use `createAdapter()` to wrap any LLM client with a unified interface.

### Does this send my data anywhere?
No. llmverify is 100% local. Zero network requests, zero telemetry, zero data collection.

### How accurate is hallucination detection?
llmverify uses heuristic-based risk indicators, not ground-truth verification. It detects signals like overconfident language, fabricated entities, and contradictions. Accuracy varies by use case. Always review the `limitations` field in results.

### Can I use this in production?
Yes. llmverify is designed for production use with:
- Zero external dependencies for core features
- Comprehensive test coverage (218 tests)
- TypeScript support
- Explicit limitations in all results

### How do I monitor LLM performance over time?
Use `monitorLLM()` to wrap your client. It tracks latency, token rate, and behavioral drift, alerting you when the LLM degrades.

### What is the difference between verify() and classify()?
- `verify()` runs the full safety pipeline (PII, injection, harmful content)
- `classify()` runs output analysis (intent, hallucination risk, instruction compliance)

---

## Troubleshooting

### Module not found errors
```bash
npm install llmverify@latest
```

### TypeScript errors
llmverify includes full TypeScript definitions. If you see type errors, check your tsconfig.json:
```json
{
  "compilerOptions": {
    "moduleResolution": "node"
  }
}
```

### Adapter requires client error
You need to pass your LLM SDK client to the adapter:
```typescript
import OpenAI from 'openai';
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const llm = createAdapter({ provider: 'openai', client: openai });
```

---

## Examples

See the `/examples` directory for complete working examples:
- `runtime-monitoring.ts` - Health monitoring with hooks
- `model-adapters.ts` - Multi-provider setup
- `classification.ts` - Intent and hallucination detection

---

## Contributing

Contributions welcome. Please read our contributing guidelines and submit PRs.

---

## License

MIT License. See [LICENSE](LICENSE) for details.

---

## Documentation

- [GETTING-STARTED.md](docs/GETTING-STARTED.md) - Beginner-friendly guide for students
- [ALGORITHMS.md](docs/ALGORITHMS.md) - How each engine computes scores
- [LIMITATIONS.md](docs/LIMITATIONS.md) - What llmverify can and cannot do

## Links

- [GitHub](https://github.com/subodhkc/llmverify-npm)
- [npm](https://www.npmjs.com/package/llmverify)
- [Issues](https://github.com/subodhkc/llmverify-npm/issues)

---

llmverify - LLM output monitoring and classification for Node.js.

Built for privacy. Designed for production.

---

**AI Caliber is the King, Everything else Negotiable**

Maintained by KingCaliber Labs (Author KC)
