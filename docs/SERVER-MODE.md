# llmverify Server Mode Guide

**Version 1.3.0+**

## Overview

llmverify server mode provides a long-running HTTP API server for seamless integration with IDEs, AI assistants, and custom applications. Instead of importing llmverify as a library, you can run it as a service and make HTTP requests to verify AI outputs.

## Quick Start

### 1. Start the Server

```bash
# Default port (9009)
npx llmverify-serve

# Custom port
npx llmverify-serve --port=8080
```

The server will start and display:

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  llmverify server v1.3.0                                                     ║
║  Running on http://localhost:9009                                            ║
╚══════════════════════════════════════════════════════════════════════════════╝

Available endpoints:
  GET  http://localhost:9009/health        - Health check
  POST http://localhost:9009/verify        - Verify AI output
  POST http://localhost:9009/check-input   - Check input safety
  POST http://localhost:9009/check-pii     - Detect PII
  POST http://localhost:9009/classify      - Classify output

Privacy: All processing is 100% local. Zero telemetry.
```

### 2. Verify AI Output

```bash
curl -X POST http://localhost:9009/verify \
  -H "Content-Type: application/json" \
  -d '{"text": "Your AI output here"}'
```

Response:

```json
{
  "success": true,
  "result": {
    "risk": {
      "level": "low",
      "action": "allow",
      "score": 0.15
    },
    "findings": [],
    "metadata": { ... }
  },
  "meta": {
    "version": "1.3.0",
    "timestamp": "2024-12-04T12:00:00.000Z"
  }
}
```

## API Endpoints

### GET /health

Health check endpoint.

**Response:**
```json
{
  "ok": true,
  "version": "1.3.0",
  "service": "llmverify",
  "timestamp": "2024-12-04T12:00:00.000Z"
}
```

### POST /verify

Main verification endpoint. Runs full AI output verification.

**Request:**
```json
{
  "text": "Your AI output here",
  "config": {  // Optional
    "engines": {
      "hallucination": { "enabled": true }
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "risk": {
      "level": "low" | "moderate" | "high" | "critical",
      "action": "allow" | "review" | "block",
      "score": 0.15
    },
    "findings": [
      {
        "category": "security",
        "severity": "low",
        "message": "..."
      }
    ]
  }
}
```

### POST /check-input

Check user input for prompt injection attacks.

**Request:**
```json
{
  "text": "User input to check"
}
```

**Response:**
```json
{
  "success": true,
  "safe": true,
  "input": "User input to check",
  "recommendation": "allow",
  "version": "1.3.0"
}
```

### POST /check-pii

Detect and redact PII from text.

**Request:**
```json
{
  "text": "Contact me at john@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "hasPII": true,
  "piiCount": 1,
  "redacted": "Contact me at [REDACTED]",
  "version": "1.3.0"
}
```

### POST /classify

Classify output intent and hallucination risk.

**Request:**
```json
{
  "prompt": "What is 2+2?",
  "output": "The answer is 4."
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "intent": "answer",
    "hallucinationRisk": 0.1,
    "hallucinationLabel": "low"
  }
}
```

## IDE Integration

### Windsurf

Add to your Windsurf rules or system prompt:

```markdown
## AI Output Verification

Before responding, verify your output:

1. Ensure llmverify server is running: `npx llmverify-serve`
2. POST your response to http://localhost:9009/verify
3. Check risk level and revise if needed

```javascript
const verify = async (text) => {
  const res = await fetch('http://localhost:9009/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });
  return await res.json();
};
```
```

### Cursor / VS Code

Create a custom tool or use the API in your extension:

```typescript
import fetch from 'node-fetch';

async function verifyAIOutput(text: string) {
  try {
    const response = await fetch('http://localhost:9009/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    
    const result = await response.json();
    
    return {
      safe: result.result.risk.level === 'low',
      riskLevel: result.result.risk.level,
      action: result.result.risk.action
    };
  } catch (error) {
    console.error('llmverify server not running');
    return null;
  }
}
```

### GitHub Copilot

For custom Copilot extensions, integrate as a verification step:

```typescript
// In your Copilot extension
const aiResponse = await generateResponse(prompt);
const verification = await verifyAIOutput(aiResponse);

if (!verification.safe) {
  // Revise or flag the response
  console.warn(`Response has ${verification.riskLevel} risk`);
}
```

## Language Examples

### JavaScript/Node.js

```javascript
const fetch = require('node-fetch');

async function verify(text) {
  const response = await fetch('http://localhost:9009/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });
  return await response.json();
}

// Usage
const result = await verify('Your AI output');
console.log(result.result.risk.level);
```

### Python

```python
import requests

def verify(text):
    response = requests.post(
        'http://localhost:9009/verify',
        json={'text': text}
    )
    return response.json()

# Usage
result = verify('Your AI output')
print(result['result']['risk']['level'])
```

### cURL

```bash
curl -X POST http://localhost:9009/verify \
  -H "Content-Type: application/json" \
  -d '{"text": "Your AI output"}'
```

## Production Deployment

### Add Authentication

```typescript
import express from 'express';

const app = express();

app.use((req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.LLMVERIFY_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

// Then start llmverify server
```

### Add Rate Limiting

```bash
npm install express-rate-limit
```

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/verify', limiter);
```

### Deploy Behind Reverse Proxy

**nginx example:**

```nginx
server {
  listen 80;
  server_name llmverify.yourdomain.com;

  location / {
    proxy_pass http://localhost:9009;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
  }
}
```

### Run as System Service

**systemd example:**

```ini
[Unit]
Description=llmverify Server
After=network.target

[Service]
Type=simple
User=llmverify
WorkingDirectory=/opt/llmverify
ExecStart=/usr/bin/npx llmverify-serve --port=9009
Restart=always

[Install]
WantedBy=multi-user.target
```

## Monitoring

### Health Checks

```bash
# Simple health check
curl http://localhost:9009/health

# In monitoring script
if ! curl -f http://localhost:9009/health > /dev/null 2>&1; then
  echo "llmverify server is down!"
  # Restart or alert
fi
```

### Logging

The server logs to stdout. Redirect to a file:

```bash
npx llmverify-serve > /var/log/llmverify.log 2>&1
```

## Troubleshooting

### Server won't start

**Port already in use:**
```bash
# Use a different port
npx llmverify-serve --port=9010
```

**Permission denied:**
```bash
# Use a port > 1024 or run with sudo (not recommended)
npx llmverify-serve --port=8080
```

### Connection refused

**Server not running:**
```bash
# Check if server is running
curl http://localhost:9009/health

# Start the server
npx llmverify-serve
```

**Firewall blocking:**
```bash
# Allow port in firewall (Linux)
sudo ufw allow 9009

# Windows Firewall
# Add inbound rule for port 9009
```

### High memory usage

The server loads verification engines on startup. Expected memory usage: 50-100MB.

To reduce memory:
- Disable unused engines in config
- Use production mode preset
- Limit concurrent requests

## Performance

- **Latency**: ~10-50ms per verification (local)
- **Throughput**: ~100-500 requests/second (single instance)
- **Memory**: ~50-100MB base + ~1MB per concurrent request
- **CPU**: Minimal (pattern matching, no ML)

## Security

- **Local Processing**: All verification happens locally. Zero network requests.
- **No Telemetry**: No data is sent to external servers.
- **No Storage**: Server does not store any request data.
- **CORS**: Enabled by default for local development. Disable in production.

## FAQ

**Q: Can I run multiple instances?**
A: Yes, use different ports for each instance.

**Q: Does it support HTTPS?**
A: Deploy behind a reverse proxy (nginx, Caddy) for HTTPS.

**Q: Can I use it in Docker?**
A: Yes, expose port 9009 and run `npx llmverify-serve`.

**Q: What's the difference between server mode and library mode?**
A: Server mode runs as a separate process with HTTP API. Library mode is imported directly in your code.

**Q: Is it production-ready?**
A: Yes, but add authentication, rate limiting, and monitoring for production use.

## Support

- **Documentation**: https://github.com/subodhkc/llmverify-npm#readme
- **Issues**: https://github.com/subodhkc/llmverify-npm/issues
- **Funding**: https://www.buymeacoffee.com/subodhkc

---

**llmverify v1.3.0** - Local-first AI output verification
