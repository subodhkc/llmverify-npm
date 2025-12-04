# llmverify

Local-first AI output verification and safety monitoring for Node.js applications.

[![npm version](https://badge.fury.io/js/llmverify.svg)](https://www.npmjs.com/package/llmverify)
[![CI](https://github.com/subodhkc/llmverify-npm/actions/workflows/ci.yml/badge.svg)](https://github.com/subodhkc/llmverify-npm/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Downloads](https://img.shields.io/npm/dm/llmverify.svg)](https://www.npmjs.com/package/llmverify)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node-%3E%3D18-green.svg)](https://nodejs.org/)

## Install

```bash
npm install llmverify
```

## Quick Start for Windsurf IDE

**Terminal 1 - Start Server:**
```powershell
npm run serve
# Keep this running - you'll see: "Running on http://localhost:9009"
```

**Terminal 2 - Start Monitor:**
```powershell
npm run monitor
# Keep this visible - verification scores appear here
```

**Usage:**
1. Chat with AI in Windsurf
2. Select AI response and copy (Ctrl+C)
3. See verification score in Terminal 2 automatically

**Optional - AI Assistant Integration:**
```bash
npm run setup-ai
# Helps your AI assistant guide you through llmverify usage
```

**Troubleshooting - Port Already in Use:**
```bash
npm run serve:force
# Automatically kills existing process and starts server
```

See [QUICK-START.md](QUICK-START.md) for detailed instructions.

---

## Usage

```javascript
const { verify, isInputSafe, redactPII } = require('llmverify');

// Check user input
if (!isInputSafe(userMessage)) {
  return { error: 'Invalid input' };
}

// Check AI response
const result = await verify({ content: aiResponse });
if (result.risk.level === 'critical') {
  return { error: 'Blocked for safety' };
}

// Remove personal info
const { redacted } = redactPII(aiResponse);
```

## Features

### Security & Safety
- **Prompt Injection Detection** - Pattern-based attack detection (OWASP LLM01)
- **PII Redaction** - Remove emails, phones, SSNs, credit cards, API keys
- **Harmful Content Detection** - Identify dangerous or inappropriate content
- **Input Validation** - Sanitize user inputs before sending to LLMs

### Output Quality
- **Hallucination Risk Scoring** - Heuristic-based confidence indicators
- **Consistency Analysis** - Detect logical contradictions
- **JSON Repair** - Auto-fix malformed JSON responses
- **Classification** - Intent detection and instruction compliance

### Monitoring & Observability
- **Runtime Health Monitoring** - Track latency, token rates, behavioral drift
- **Baseline Drift Detection** - Identify performance degradation
- **Audit Logging** - Compliance-ready audit trails
- **Error Handling** - Structured error codes with actionable suggestions

### Integration
- **Model-Agnostic Adapters** - Works with OpenAI, Anthropic, Google, local models
- **HTTP Server Mode** - REST API for IDE and external tool integration
- **CLI Tools** - Command-line verification and monitoring
- **Plugin System** - Extensible architecture for custom checks

## Server Mode

Run llmverify as an HTTP server for IDE integration or external tools.

```bash
# Recommended: Using npm script
npm run serve

# Alternative: Direct execution
node node_modules/llmverify/start-server.js

# Custom port
node node_modules/llmverify/start-server.js --port=8080
```

**Note**: If using `npx llmverify-serve`, output may be buffered. Use the methods above for immediate feedback.

### API Endpoints

```bash
# Health check
GET http://localhost:9009/health

# Verify AI output
POST http://localhost:9009/verify
Body: {"content": "AI response to verify"}

# Check input safety
POST http://localhost:9009/check-input
Body: {"text": "User input"}

# Detect PII
POST http://localhost:9009/check-pii
Body: {"text": "Text with potential PII"}

# Classify output
POST http://localhost:9009/classify
Body: {"prompt": "...", "output": "..."}
```

### Response Format

```json
{
  "success": true,
  "summary": {
    "verdict": "[PASS] SAFE TO USE",
    "riskLevel": "LOW",
    "riskScore": "6.3%",
    "explanation": "This AI response passed all safety checks.",
    "testsRun": [
      "[CHECK] Hallucination Detection",
      "[CHECK] Consistency Analysis",
      "[CHECK] Security Scan",
      "[CHECK] Privacy Check",
      "[CHECK] Safety Review"
    ],
    "findings": [],
    "nextSteps": ["You can use this content confidently"]
  },
  "result": {
    "risk": {
      "level": "low",
      "overall": 0.063,
      "action": "allow"
    }
  }
}
```

## CLI

```bash
# Check text
npx llmverify "AI response"

# Check file
npx llmverify --file response.txt

# JSON output
npx llmverify "text" --json
```

## Risk Levels

| Level | Score | Verdict | Action | Use Case |
|-------|-------|---------|--------|----------|
| **LOW** | 0-25% | `[PASS] SAFE TO USE` | Allow | Production-ready |
| **MODERATE** | 26-50% | `[WARN] REVIEW RECOMMENDED` | Review | Human review needed |
| **HIGH** | 51-75% | `[FAIL] HIGH RISK` | Block | Fix before use |
| **CRITICAL** | 76-100% | `[BLOCK] CRITICAL` | Block | Do not use |

### Exit Codes (CI/CD)

- `0` - Low risk (safe)
- `1` - Moderate risk (review needed)
- `2` - High/Critical risk (block)

## Advanced Usage

### Configuration File

Create `llmverify.config.json`:

```json
{
  "tier": "free",
  "privacy": {
    "allowNetworkRequests": false,
    "telemetryEnabled": false
  },
  "engines": {
    "hallucination": { "enabled": true },
    "consistency": { "enabled": true },
    "csm6": {
      "enabled": true,
      "profile": "baseline",
      "checks": {
        "security": true,
        "privacy": true,
        "safety": true
      }
    }
  },
  "performance": {
    "timeout": 30000,
    "maxContentLength": 10000
  }
}
```

### TypeScript Support

```typescript
import { verify, VerifyResult, Config } from 'llmverify';

const config: Partial<Config> = {
  output: { verbose: true }
};

const result: VerifyResult = await verify({ 
  content: aiResponse,
  config 
});
```

### IDE Integration

```javascript
const { createIDEExtension } = require('llmverify');

const verifier = createIDEExtension('http://localhost:9009');

// Check if server is available
const available = await verifier.isServerAvailable();

// Verify content
const result = await verifier.verify("AI response");

// Format for display
console.log(verifier.formatInline(result));
// Output: [llmverify] [PASS] SAFE TO USE (Risk: 6.3%)
```

## Risk Levels

| Level | Range | Action | Description |
|-------|-------|--------|-------------|
| **LOW** | 0-25% | Safe to use | No significant issues detected |
| **MODERATE** | 26-50% | Review recommended | Minor inconsistencies, verify key facts |
| **HIGH** | 51-75% | Fix before using | Multiple issues, likely hallucinations |
| **CRITICAL** | 76-100% | Do not use | Severe problems, reject content |

**Your score of 17.2% means:** Safe to use with normal verification practices.

See [RISK-LEVELS.md](docs/RISK-LEVELS.md) for:
- Detailed explanations of each level
- How to lower risk scores
- Practical examples
- Risk factor breakdowns
- Integration strategies

---

## Documentation

- [Quick Start](QUICK-START.md) - Monitor mode vs API mode usage
- [Risk Levels Guide](docs/RISK-LEVELS.md) - Understanding and lowering risk scores
- [Integration Guide](docs/INTEGRATION-GUIDE.md) - Complete integration patterns (Server, AI agents, IDE)
- [Getting Started](docs/GETTING-STARTED.md) - Beginner tutorial
- [CLI Reference](docs/CLI-REFERENCE.md) - Complete command reference
- [API Reference](docs/API-REFERENCE.md) - Full API documentation
- [Troubleshooting](docs/TROUBLESHOOTING.md) - Common issues and solutions
- [Limitations](docs/LIMITATIONS.md) - Known limitations and constraints

## Examples

See `/examples` folder for complete working examples:

- `basic-usage.js` - Simple verification examples
- `express-middleware.ts` - Express API integration
- `windsurf-extension.js` - IDE integration
- `server-integration.ts` - Server mode usage
- `openai-integration.ts` - OpenAI wrapper
- `runtime-monitoring.ts` - Health monitoring
- And 9 more examples...

## Architecture

```
llmverify
├── Core Engines
│   ├── Hallucination Detection (heuristic-based)
│   ├── Consistency Analysis (semantic similarity)
│   ├── CSM6 Security Framework (OWASP LLM Top 10)
│   └── Classification Engine (intent detection)
├── Security Layer
│   ├── Input Validation
│   ├── PII Detection & Redaction
│   ├── Prompt Injection Detection
│   └── Rate Limiting
├── Monitoring
│   ├── Runtime Health Tracking
│   ├── Baseline Drift Detection
│   ├── Audit Logging
│   └── Error Handling
└── Integration
    ├── HTTP Server (Express)
    ├── CLI Tools
    ├── Model Adapters
    └── Plugin System
```

## Performance

- **Latency**: 2-10ms average per verification
- **Throughput**: 100+ requests/second
- **Memory**: <50MB typical usage
- **CPU**: Minimal impact (<5% on modern hardware)

## Privacy & Security

- **100% Local Processing** - No data leaves your machine
- **Zero Telemetry** - No tracking or analytics
- **No API Keys Required** - Works completely offline
- **Open Source** - Audit the code yourself
- **MIT Licensed** - Use in commercial projects

## Compliance

Built on the CSM6 framework implementing:
- **NIST AI RMF** - AI Risk Management Framework
- **OWASP LLM Top 10** - LLM security best practices
- **ISO 42001** - AI management system guidelines
- **EU AI Act** - High-risk AI system requirements

## License

MIT

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Support

- **Issues**: https://github.com/subodhkc/llmverify-npm/issues
- **NPM**: https://www.npmjs.com/package/llmverify
- **Changelog**: [CHANGELOG.md](CHANGELOG.md)

## Citation

If you use llmverify in research, please cite:

```bibtex
@software{llmverify2024,
  title = {llmverify: Local-first AI Output Verification},
  author = {KingCaliber Labs},
  year = {2024},
  url = {https://github.com/subodhkc/llmverify-npm}
}
```
