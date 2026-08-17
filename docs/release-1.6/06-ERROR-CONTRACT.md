# 06 — Structured Error Contract

## Machine-Readable Errors

All errors thrown by `llmverify` expose:

- `code`: a stable `ErrorCode` string
- `severity`: the impact of the error
- `metadata`: safe, non-sensitive context
- `toJSON()`: a serializable representation

## Error Categories

| Category | Example Codes | When It Happens |
|----------|---------------|-----------------|
| Input | `INVALID_INPUT`, `CONTENT_TOO_LARGE` | Bad or oversized input |
| Config | `INVALID_CONFIG`, `MISSING_API_KEY` | Bad configuration |
| Runtime | `ENGINE_FAILURE`, `INTERNAL_ERROR` | Engine or system failure |
| Usage | `USAGE_LIMIT_EXCEEDED` | Free tier exhausted |
| Privacy | `PRIVACY_VIOLATION` | Unsafe content blocked |

## Secret Safety

Error messages and details do not include:

- Full input content
- API keys
- Environment secrets
- PII redacted from the original input

## Usage-Limit Error

```json
{
  "code": "USAGE_LIMIT_EXCEEDED",
  "limit": 2000,
  "used": 2200,
  "remaining": 0,
  "inGracePeriod": false
}
```
