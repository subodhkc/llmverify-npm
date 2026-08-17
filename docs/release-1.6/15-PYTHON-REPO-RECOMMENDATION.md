# 15 — Python Preview Repository Recommendation

## Current State

There is a `llmverify-python-preview` repository that contains a Python implementation. The canonical `llmverify` package is the JavaScript/TypeScript npm package.

## Recommendation

**ARCHIVE** the `llmverify-python-preview` repository.

## Rationale

- The npm package `llmverify` is the published, versioned canonical implementation.
- The Python preview repo creates discovery confusion for users searching for `llmverify`.
- Keeping a stale preview repository active dilutes the brand and support surface.

## Safe Path

1. Archive the Python preview repository.
2. Optionally add a prominent README note pointing to `https://github.com/subodhkc/llmverify-npm` and `https://www.npmjs.com/package/llmverify`.
3. No source changes are required in this repository.
