# 05 — Result Schema Version

## Schema Version

All `VerifyResult` objects from `llmverify@1.6.0` include:

```ts
schemaVersion: "1.0"
```

## Semantics

- `schemaVersion` is a stable, documented contract for the result shape.
- It is independent of the package version.
- Consumers can use it to detect result compatibility without parsing the package version.

## Result Fields

The 1.6.0 result retains all prior fields:

- `risk`: score and level
- `findings`: array of structured findings
- `hallucination`, `consistency`, `json`, and `csm6` results
- `meta`: verification id, timestamp, version, tier, engines used, latency
- `schemaVersion`: new in 1.6.0

## Backward Compatibility

Existing consumers that ignore `schemaVersion` will continue to work. The new field is additive only.
