# llmverify

Local-first AI output verification and safety monitoring for Node.js applications.

[![npm version](https://badge.fury.io/js/llmverify.svg)](https://www.npmjs.com/package/llmverify)
[![CI](https://github.com/subodhkc/llmverify-npm/actions/workflows/ci.yml/badge.svg)](https://github.com/subodhkc/llmverify-npm/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**100% Local** | **No Telemetry** | **Privacy-First**

---

## Install

```bash
npm install llmverify
```

---

## Quick Start

### For IDE Users (Windsurf, VS Code, Cursor)

```bash
# Terminal 1: Start server
npm run serve

# Terminal 2: Start monitor
npm run monitor

# Copy AI responses → See verification scores automatically
```

**Troubleshooting:** Port conflict? Run `npm run serve:force`

[Full IDE Setup Guide →](QUICK-START.md)

---

## Core Functions

### 1. Verify AI Output

**What it does:** Checks AI responses for safety, accuracy, and quality  
**When to use:** Before showing AI content to users  
**Benefit:** Catch hallucinations, security issues, and PII

```javascript
const { verify } = require('llmverify');

const result = await verify(aiResponse);

console.log(result.result.risk.level);     // "low", "moderate", "high", "critical"
console.log(result.result.risk.overall);   // 0.172 (17.2%)
console.log(result.summary.verdict);       // "[PASS] SAFE TO USE"
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

const { redacted, found } = redactPII(aiResponse);

console.log(redacted);  // "Contact us at [EMAIL_REDACTED]"
console.log(found);     // ["email", "phone"]
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

const category = await classify(aiResponse);

console.log(category);  // "question", "answer", "code", "explanation"
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
  
  if (verification.result.risk.level === 'critical') {
    throw new Error('Response failed safety check');
  }
  
  return {
    response: aiResponse,
    risk: verification.result.risk
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
  if (verification.result.risk.level === 'critical') {
    return res.status(400).json({ error: 'Response failed safety check' });
  }
  
  res.json({
    response: redacted,
    riskScore: verification.result.risk.overall,
    riskLevel: verification.result.risk.level
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
  
  if (verification.result.risk.level === 'high' || 
      verification.result.risk.level === 'critical') {
    console.log('\n[WARNING] Response has elevated risk');
    console.log(`Risk: ${verification.result.risk.overall * 100}%`);
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

## Documentation

### Getting Started
- [Quick Start Guide](QUICK-START.md) - IDE setup in 5 minutes
- [Integration Guide](docs/INTEGRATION-GUIDE.md) - Add to your app
- [API Reference](docs/API-REFERENCE.md) - Complete API docs

### Understanding Results
- [Risk Levels](docs/RISK-LEVELS.md) - What scores mean
- [Findings Explained](docs/FINDINGS-EXPLAINED.md) - Common issues

### Troubleshooting
- [Error Guide](docs/ERROR-GUIDE.md) - Fix common errors
- [Troubleshooting](docs/TROUBLESHOOTING.md) - Advanced debugging

### For AI Assistants
- [AI Guide](AI-GUIDE.md) - Help users with llmverify

---

## Why llmverify?

### Security
- Detect prompt injection attacks
- Prevent data leaks
- Block malicious content
- Validate all inputs/outputs

### Quality
- Catch hallucinations
- Ensure consistency
- Verify factual claims
- Improve reliability

### Compliance
- GDPR/CCPA ready
- Audit trails
- PII protection
- SOC2 compatible

### Privacy
- 100% local processing
- No data leaves your machine
- No telemetry
- Open source

---

## Performance

- **Verification:** <100ms for typical responses
- **PII Detection:** <50ms
- **Input Validation:** <10ms
- **Memory:** <50MB baseline

---

## Requirements

- **Node.js:** ≥18.0.0
- **OS:** Windows, Linux, macOS
- **Memory:** 512MB minimum
- **Disk:** 50MB

---

## Support

- **Issues:** [GitHub Issues](https://github.com/subodhkc/llmverify-npm/issues)
- **Docs:** [Full Documentation](docs/)
- **Examples:** [/examples](examples/)

---

## License

MIT License - See [LICENSE](LICENSE) for details

---

## Quick Reference

| Task | Function | Example |
|------|----------|---------|
| Verify AI output | `verify()` | `await verify(response)` |
| Check input | `isInputSafe()` | `isInputSafe(message)` |
| Remove PII | `redactPII()` | `redactPII(text)` |
| Fix JSON | `repairJSON()` | `repairJSON(broken)` |
| Classify | `classify()` | `await classify(response)` |
| Monitor | `monitor.track()` | `monitor.track(metrics)` |
| Audit | `audit.log()` | `audit.log(event)` |
| Badge | `generateBadge()` | `generateBadge(result)` |

---

**Made with care for AI safety and developer experience.**
