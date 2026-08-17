# 12 — Privacy and Network Test

## Zero-Network Free Tier

The free tier of `llmverify` makes **no network requests**.

## Tested Scenarios

- Small safe input
- Typical LLM answer text
- Content near the 50KB free-tier limit
- Prompt-injection pattern
- PII-containing content

## What Was Verified

- `verify()` completes without opening any network connection.
- PII detection and redaction run entirely offline.
- No analytics, telemetry, or phone-home requests.
- No API key is required for free-tier use.

## How to Verify Yourself

```javascript
const { verify } = require('llmverify');
verify({ content: 'Your test content here' });
```

Run with a network monitor such as Wireshark, tcpdump, or Windows Resource Monitor. You will observe zero outbound connections.
