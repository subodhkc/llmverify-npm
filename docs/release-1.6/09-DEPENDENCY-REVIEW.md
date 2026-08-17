# 09 — Dependency Review

## Runtime Dependencies

The package keeps a minimal runtime footprint. The only directly pinned update for 1.6.0 was `uuid`.

| Package | Old | New | Reason |
|---------|-----|-----|--------|
| `uuid` | `^9.0.1` | `^11.1.1` | Resolves GHSA-w5hq-g745-h8pq |

## Audit Status

- Baseline: 13 findings
- After `uuid` update: 11 findings
- Remaining findings are in development/optional transitive dependencies.

## Policy

- No unnecessary runtime dependencies were introduced.
- Production dependency footprint was reduced where possible.
- Remaining audit items were reviewed; none affect the free-tier local verification path.
