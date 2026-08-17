# 03 — Install and stdio Safety

## No Install-Time Output

`llmverify@1.6.0` has no `preinstall`, `install`, or `postinstall` lifecycle scripts.

- `package.json` scripts do not include any install hooks.
- `src/postinstall.ts` and `tests/postinstall.test.ts` have been removed.
- Importing the package programmatically produces no stdout.

## Verified Behaviors

- `require('llmverify')` in a child process emits zero stdout.
- `await verify({ content })` does not write to `process.stdout`.
- Library errors throw without writing to `process.stdout`.
- CLI output is only produced when `npx llmverify` or `node dist/cli.js` is explicitly invoked.

## Customer Impact

You can install and import `llmverify` in automated environments, Docker builds, and agent pipelines without worrying about banner spam or interactive prompts.
