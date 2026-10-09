#!/usr/bin/env node

/**
 * Package-file inventory validation.
 *
 * Asserts the npm artifact is reproducible from the git tree: every file
 * `npm pack` would ship must either be git-tracked or generated at build
 * time (dist/). This is what makes `npm pack` output identical between a
 * clean CI checkout and a maintainer working tree containing untracked
 * development notes.
 *
 * Usage: node scripts/check-package-files.mjs
 * Exit: 0 = package inventory is git-reproducible; 1 = violations found.
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ALWAYS_INCLUDED = new Set(['package.json', 'README.md', 'LICENSE', 'LICENCE', 'CHANGELOG.md']);

const packJson = execSync('npm pack --dry-run --json', {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: 16 * 1024 * 1024
});

// npm versions differ on `pack --dry-run --json` output shape (array of
// pack entries vs a single object), and warnings may precede the JSON.
// Parse defensively: locate the JSON payload, accept either shape, and
// fail loudly rather than silently validating an empty file list.
const jsonStart = packJson.search(/[\[{]/);
const parsed = jsonStart === -1 ? null : JSON.parse(packJson.slice(jsonStart));
const packEntries = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
const packInfo = packEntries.find((e) => e && Array.isArray(e.files));
if (!packInfo) {
  console.error('[package-files] FAIL: `npm pack --dry-run --json` returned an unexpected shape');
  console.error(packJson.slice(0, 500));
  process.exit(1);
}
const packed = packInfo.files.map((f) => f.path);

const tracked = new Set(
  execSync('git ls-files', { cwd: root, encoding: 'utf8' })
    .trim()
    .split('\n')
    .map((p) => p.replace(/\\/g, '/'))
);

const violations = packed.filter(
  (p) =>
    !p.startsWith('dist/') &&
    !ALWAYS_INCLUDED.has(p) &&
    !tracked.has(p)
);

const missingDist = !packed.some((p) => p.startsWith('dist/index.js'));
const missingCli = !packed.some((p) => p === 'bin/llmverify-serve.js') || !packed.some((p) => p === 'dist/cli.js');
const missingSchema = !packed.some((p) => p.startsWith('schema/'));

console.log(`[package-files] ${packed.length} files in npm artifact`);
if (violations.length > 0) {
  console.error('[package-files] FAIL: untracked/generated-elsewhere files would ship:');
  violations.forEach((v) => console.error(`  - ${v}`));
}
if (missingDist) console.error('[package-files] FAIL: dist/index.js missing — run `npm run build` first');
if (missingCli) console.error('[package-files] FAIL: bin/llmverify-serve.js or dist/cli.js missing');
if (missingSchema) console.error('[package-files] FAIL: schema/ contents missing');

const failed = violations.length > 0 || missingDist || missingCli || missingSchema;
if (!failed) console.log('[package-files] OK: artifact is fully reproducible from the git tree');
process.exit(failed ? 1 : 0);
