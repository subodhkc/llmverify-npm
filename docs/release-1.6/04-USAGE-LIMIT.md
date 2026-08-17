# 04 — Free Tier Usage Limit

## Allowance

The free tier allows **2,000 verification calls per day**.

## How It Works

- Usage is tracked locally in `~/.llmverify/usage.json`.
- No network requests are made to enforce the limit.
- The limit resets automatically at midnight UTC.
- A 10% grace period allows calls up to 2,200 before hard enforcement.

## Boundary Behavior

| Calls Used | Result |
|------------|--------|
| 0 – 1,999 | Allowed |
| 2,000 – 2,199 | Allowed with grace warning |
| 2,200+ | Blocked with a structured `USAGE_LIMIT_EXCEEDED` error |

## Error Contract

When the limit is exceeded, the error includes:

```
code: USAGE_LIMIT_EXCEEDED
used: <number>
limit: 2000
remaining: 0
inGracePeriod: false
```

No sensitive input is included in the error details.
