# 11 — Supply-Chain Review

## Package Contents

`npm pack --dry-run` for 1.6.0:

- Package size: **598.6 kB**
- Unpacked size: **2.1 MB**
- Total files: **210**

## What Is Included

- `dist/` compiled JavaScript and `.d.ts`
- `README.md`, `LICENSE`, `CHANGELOG.md`
- `docs/`, `examples/`, `recipes/`, `schema/`
- `package.json` with exports and metadata

## What Is Excluded

- `src/` TypeScript source (stays on GitHub)
- `tests/`
- `monitor.js`, `start-server.js`, `postinstall.js`
- Internal `.ps1` scripts and draft READMEs
- `.github/workflows` source

## No Secrets in Package

- No `.env` files
- No `.npmrc`
- No `llmverify-audit.jsonl`
- No `package-lock.json` in tarball
