# 08 — Node Support Decision

## Supported Node Versions

`llmverify@1.6.0` is verified on Node 22 and Node 24.

## Decision

- The CI matrix is updated to `[18, 20, 22, 24]`.
- The `package.json` engine declaration remains `>=18` for backward compatibility.
- Primary support focus is Node 22 and 24.

## Why Node 22/24?

- Node 22 is the active LTS line.
- Node 24 is the latest released line.
- TypeScript `moduleResolution: node16` and `module: Node16` are stable on these versions.
- Free tier consumers increasingly use the latest Node runtimes.

## Future

Node 18 and 20 are still tested in CI but are not the primary optimization target. Removal of 18/20 will be considered in a future major release.
