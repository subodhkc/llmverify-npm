# How to Trigger NPM Provenance Workflow

## ❌ What Happened
The npm-publish.yml workflow did NOT run because it only triggers on **version tags** (v*), not regular commits.

Your recent commits were regular pushes to main, which triggered:
- ✅ CI workflow (ci.yml)
- ✅ llmverify CI workflow (llmverify.yml)
- ❌ NPM Publish with Provenance (npm-publish.yml) - DIDN'T RUN

## ✅ How to Trigger It

### Option 1: Use the PowerShell Script (Recommended)
```powershell
.\publish-with-provenance.ps1 patch
```

This will:
1. Bump version from 1.0.1 → 1.0.2
2. Create tag v1.0.2
3. Push tag to GitHub
4. Trigger npm-publish.yml workflow

### Option 2: Manual Commands
```bash
# 1. Bump version (creates tag automatically)
npm version patch

# 2. Push the tag
git push --follow-tags
```

### Option 3: Create Tag Manually
```bash
# 1. Create tag
git tag v1.0.2

# 2. Push tag
git push origin v1.0.2
```

## 🎯 What Will Happen

Once you push a tag starting with 'v':
1. GitHub detects the tag push
2. npm-publish.yml workflow triggers
3. Workflow runs: build → test → publish with --provenance
4. Package published to NPM with provenance badge

## 🔍 Verify Workflow Triggered

After pushing the tag, check:
- https://github.com/subodhkc/llmverify-npm/actions
- Look for "NPM Publish with Provenance" workflow
- It should show as running/completed

## 📋 Current Status

- Current version: 1.0.1
- Last tag: v1.0.1
- Next version: 1.0.2 (when you run the command)
- Provenance workflow: Ready to trigger on next tag push
