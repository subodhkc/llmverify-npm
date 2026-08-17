# 13 — Performance Baseline

## Measurement Environment

- Node v24.11.1
- Local file system
- No network
- 606 test suite

## Representative Timings

| Operation | Approximate Latency |
|-----------|--------------------:|
| Small input verify | < 25 ms |
| PII redaction (1KB) | < 5 ms |
| JSON validation/repair | < 5 ms |
| Full test suite | ~15 s |

## Notes

- These are reference measurements, not marketing benchmarks.
- Actual performance depends on input length, enabled engines, and hardware.
- No optimization work was done beyond removing the postinstall step.
