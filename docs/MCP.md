# llmverify MCP Server

llmverify ships a built-in [Model Context Protocol](https://modelcontextprotocol.io)
server that exposes the verification engine to MCP-compatible agents and
IDEs over stdio. It is a thin adapter over the public `llmverify` API —
not a second verification engine.

**Requires Node.js ≥ 20** (`@modelcontextprotocol/server` engine floor).
The rest of the package still supports Node ≥ 18.

## Run it

```bash
npx llmverify mcp          # stdio MCP server
# or the dedicated bin (same thing):
npx llmverify-mcp
```

The MCP SDK and zod are regular dependencies — the `llmverify-mcp` bin
always has them. The `mcp` CLI subcommand lazy-loads the SDK so every
other command pays no startup cost. On Node < 20 the `mcp` command and
bin fail with a clear message; everything else in the package still
works.

### Client configuration

```jsonc
{
  "mcpServers": {
    "llmverify": {
      "command": "npx",
      "args": ["-y", "llmverify", "mcp"]
    }
  }
}
```

## Tools

All tools return `structuredContent` (the machine contract, validated by
the tool's registered output schema) plus a bounded human-readable text
summary. Adapter contract version: `1.1` (`adapter.contractVersion`).

Every result envelope includes:

```jsonc
{
  "adapter": { "name": "llmverify", "version": "1.8.0", "contractVersion": "1.1" },
  "engine":  { "name": "llmverify", "version": "1.8.0" },
  "output":  { "truncated": false, "truncations": [] }
}
```

Errors return `isError: true` with a normalized
`error: { name, code, message, recoverable?, details? }` — handlers never
throw past the tool boundary.

| Tool | Purpose | Side effects |
|---|---|---|
| `verify_llm_content` | Full heuristic verification via `verify()` | May increment the local usage counter and append an audit record |
| `assess_hallucination_risk` | Hallucination-risk signals via `HallucinationEngine` | Read-only |
| `check_prompt_injection` | Pattern-based injection scan | Read-only |
| `check_pii` | PII type detection | Read-only |
| `redact_pii` | In-memory PII redaction | Read-only |
| `get_llmverify_capabilities` | Engine capability discovery | Read-only |

### verify_llm_content

| Field | Type | Required | Notes |
|---|---|---|---|
| `content` | string | yes | Text to verify. Never executed. Max 1M chars (default). |
| `profile` | enum | no | CSM6 profile: `baseline`, `high_risk`, `finance`, `health`, `research` |
| `isJSON` | boolean | no | Declares content is JSON — gates the JSON validator |
| `expectedSchema` | object | no | JSON Schema for the JSON validator (needs `isJSON: true`) |
| `skipEngines` | enum[] | no | Public ids: `hallucination`, `consistency`, `jsonValidator`, `csm6`. `jsonValidator` maps to the engine-internal id `json`; `enginesNotChecked` reports the engine's own name. Unknown ids are rejected. |
| `requireAuditPersistence` | boolean | no | Evidence-required mode (default false) |

Output additions: `resultSchemaVersion` (`"1.0"`), `risk`
(heuristic triage signal, not a verdict), `enginesExecuted`,
`enginesNotChecked` (**NOT_CHECKED is not success**), `limitations`,
`audit` (actual persistence outcome; the `sha256:` digest is
tamper-evidence, not a signature), `engineResults` (bounded, PII-masked
pass-through), `warnings`, `privacy` (`{piiFieldsMasked, policy}` —
provenance for the masking applied).

### assess_hallucination_risk

Input: `content`. Output: `riskScore`, `riskLabel` — the
engine-authoritative `low`/`medium`/`high` label (deliberately different
from `verify()`'s four-band `risk.level`), plus `riskIndicators`,
`suspiciousClaims` (bounded), `claimsEvaluated`, `confidence`,
`limitations`, `evaluation`. A flagged claim is not established as
false; an unflagged claim is not established as true.

### check_prompt_injection

Input: `input`. Output: `inputSafe` (`true` means no indicators
observed, NOT proof of safety), `riskScore`, `indicatorsObserved`,
`findings` (bounded), `findingsCount`, `recommendations`, `limitations`,
`evaluation`.

### check_pii

Input: `content`. Output: `piiDetected`, `riskScore`, `piiTypes`,
`findings` (bounded; `evidence` values masked `[REDACTED]`),
`findingsCount`, `limitations`, `evaluation`. Raw sensitive values are
never returned. Pattern coverage is not exhaustive.

### redact_pii

Input: `content`, optional `replacement` (≤64 chars). Output:
`redacted`, `piiCount`, `redactions` (`[{type, position}]` — original
values withheld), `limitations`, `evaluation`. If the redacted document
exceeds the serialized output budget the tool returns
`MCP_ADAPTER_OUTPUT_TOO_LARGE` with **no** `redacted` field — a
truncated redaction is never presented as complete.

### get_llmverify_capabilities

Input: optional `includeLocalPaths` (boolean). Output: engine identity +
`resultSchemaVersion`, `capabilities` (each with `observes` /
`doesNotEstablish` / `networkAccess` / `persistsContent` /
`entrypoints`), `package` info, adapter `limits`, `localState`,
`resultSchemaFile`.

`localState` reports field slots and env-var override names — absolute
host paths are withheld by default; `includeLocalPaths: true` adds
`localState.paths` and resolves `resultSchemaFile` (otherwise `null`).

## Security model

- **stdio only.** No HTTP listener, no socket server, no remote access.
  Reachable only by the MCP host that spawned it.
- **Zero outbound network** in the default execution path.
- **stdout is protocol-only.** `console.log/info/debug` are rerouted to
  stderr at startup; nothing but MCP frames can reach stdout.
- **Content is always data** — never executed, never interpreted as
  instructions, never used as a file path.
- **No shell execution, no dynamic code evaluation.**

### Limits

| Control | Default | Env override |
|---|---|---|
| Max input chars per `content`/`input` arg | 1,000,000 | `LLMVERIFY_MCP_MAX_INPUT_CHARS` |
| Tool wall-clock timeout | 60,000 ms | `LLMVERIFY_MCP_TIMEOUT_MS` |
| Max items in any output array | 50 | `LLMVERIFY_MCP_MAX_OUTPUT_ITEMS` |
| Max chars per output text field | 2,000 | `LLMVERIFY_MCP_MAX_TEXT_FIELD_CHARS` |
| Max serialized `structuredContent` bytes | 262,144 | `LLMVERIFY_MCP_MAX_OUTPUT_BYTES` |
| Max queued/running stateful verify calls | 16 | `LLMVERIFY_MCP_MAX_QUEUE_DEPTH` |
| `expectedSchema` input | ≤64 KiB serialized, ≤32 nesting depth | not configurable |

### Timeout semantics

The engine has no abort hook. On timeout the caller receives one of two
distinct outcomes:

- `MCP_ADAPTER_TIMEOUT` — the call was **running**; the engine work is
  not cancelled and continues to hold the serialized lane until it
  settles. Outcome is indeterminate — do not blindly retry.
- `MCP_ADAPTER_QUEUE_EXPIRED` — the deadline passed while **queued**;
  the call never ran — no usage-quota consumption, no audit record.
  Safe to retry.

The lane is bounded (`LLMVERIFY_MCP_MAX_QUEUE_DEPTH`, default 16);
excess calls fail fast with `MCP_ADAPTER_QUEUE_FULL`.

### Output privacy

The MCP response is a privacy-filtered projection of the engine result.
Input-echoing fields pass through `redactPII()`; PII-finding
`textSample` values are hard-replaced with `[REDACTED]`;
`structuredContent.privacy.piiFieldsMasked` reports the scrub count —
masking is provable, never silent. `json.parsed` and
`consistency.similarityMatrix` are dropped (echo/O(n²) payloads). Error
messages pass `sanitizeMessage()` plus a PII pass; stack traces are
never returned. Heuristic redaction is NOT exhaustive.

### Local state disclosure

The engine may write under `LLMVERIFY_HOME` (default `~/.llmverify`):
`usage.json`, `audit/*.jsonl`, `baseline/`, `logs/`. The MCP layer
writes no files of its own. Multiple processes sharing one
`LLMVERIFY_HOME` can lose read-modify-write updates (last writer wins);
run one server per state home if durability matters.

## Error codes

| Code | Meaning |
|---|---|
| `LLMVERIFY_8001` | `AuditPersistenceError` — persistence required but status was FAILED/DISABLED/NOT_ATTEMPTED |
| `MCP_ADAPTER_TIMEOUT` | Deadline hit while running; outcome indeterminate |
| `MCP_ADAPTER_QUEUE_EXPIRED` | Deadline hit while queued; call never ran — safe to retry |
| `MCP_ADAPTER_QUEUE_FULL` | Serialized lane at capacity — retry later |
| `MCP_ADAPTER_OUTPUT_TOO_LARGE` | Result exceeded `LLMVERIFY_MCP_MAX_OUTPUT_BYTES` after honest degradation |
| `MCP_ADAPTER_CONTRACT_VIOLATION` | Engine output failed `validateVerifyResult` |
| `MCP_ADAPTER_INTERNAL` | Unexpected error |
| engine codes | e.g. `USAGE_LIMIT_EXCEEDED`, `INVALID_INPUT` — passed through |

## What the tools do not establish

- Hallucination risk score ≠ factual verdict.
- `inputSafe=true` / no findings ≠ safe. Pattern detection is heuristic.
- Verification output is not regulatory certification, compliance
  clearance, or a safety guarantee.
