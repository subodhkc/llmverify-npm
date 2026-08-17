# 07 — Claims and Terminology Audit

## Removed or Qualified Claims

| Old Language | New Language | Reason |
|--------------|--------------|--------|
| "Industry standard" | removed | Not a measurable, supportable claim. |
| "100% deterministic" (all detection) | "deterministic for the free tier" | Engine configs may change; paid tier may use non-local checks. |
| "Block injections" | "Detect injection patterns" | We detect and score; blocking is the caller's decision. |
| "500 free calls/day" | "2000 free calls/day" | Updated to match new limit. |
| "Hallucinations" (categorical) | "Hallucination risk" | We provide signals, not guarantees. |
| "100% local" | "100% local (free tier)" | Paid tier may use opt-in network calls. |

## Preserved Discoverability

README and package keywords still use relevant terms such as:

- LLM verification
- AI safety
- prompt injection
- PII detection
- content safety
- guardrails

## Customer-Facing Commitment

`llmverify` is a local-first guardrail library. It provides risk signals, pattern detection, and redaction. It does not guarantee the absence of hallucinations, vulnerabilities, or compliance violations.
