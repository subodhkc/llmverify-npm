# 14 — Agent Security Integration Readiness

## Role in Agent Security

`llmverify` is the **"check model interactions"** capability for the future HAIEC Agent Security surface.

It is an independent engine. It does **not**:

- Scan source code for AI security issues.
- Check tenant boundaries.
- Gate deployments.

## Future Integration Boundary

The future Agent Security tool is:

```
verify_llm_content
```

This tool will call `verify()` against model input/output content. `llmverify` will remain a standalone package and will not gain MCP or agent-security behavior.

## Stable Contracts for Integration

| Contract | Status |
|----------|--------|
| `verify(content)` | Stable entry point |
| `VerifyResult` with `schemaVersion` | Stable |
| `LLMVerifyError.toJSON()` | Stable, safe |
| `USAGE_LIMIT_EXCEEDED` | Stable error code |

## Independence Invariant

`llmverify@1.6.0` does not invoke the HAIEC source scanner, Tenant Isolation engine, or deploy gate.
