# 02 — API Compatibility Statement for 1.6.0

## Public API Surface

`llmverify@1.6.0` preserves every public export and function from 1.5.2.

## Stability Guarantees

- `verify(text)` and `verify({ content, ... })` continue to work identically.
- `isInputSafe`, `redactPII`, `containsPII`, and all CSM6 exports are unchanged.
- Engine classes, error classes, and constants remain available.
- The `VerifyResult` type gains only one new field: `schemaVersion`.

## New in 1.6.0

| Name | Type | Description |
|------|------|-------------|
| `schemaVersion` | `string` | Stable result-schema identifier, currently `"1.0"`. |

## Integration Consumers

Agent Security and other orchestrators can depend on the presence of `schemaVersion` in `meta` results from 1.6.0 onward. No other fields were removed or renamed.
