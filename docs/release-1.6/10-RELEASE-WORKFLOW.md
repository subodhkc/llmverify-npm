# 10 — Release Workflow

## Single Canonical Workflow

The 1.6.0 release uses one provenance-enabled workflow:

- **File:** `.github/workflows/npm-publish.yml`
- **Trigger:** git tag `v*` push
- **Node:** 22.x
- **Steps:** checkout, install, build, test, pack, publish with provenance

## Removed Workflows

- `.github/workflows/publish.yml` — duplicate manual workflow
- `.github/workflows/llmverify.yml` — duplicate release workflow

## Manual Publish

If the GitHub workflow cannot be used, `llmverify` can be published manually with:

```bash
npm run build
npm test
npm publish --access public
```

## Provenance

Published packages include a signed provenance statement from GitHub Actions. The 1.6.0 release was published locally with a granular access token because the `NPM_TOKEN` secret was not configured at publish time.
