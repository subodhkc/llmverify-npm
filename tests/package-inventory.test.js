/**
 * Package inventory regression test.
 *
 * The npm artifact must be reproducible from the git tree — no
 * gitignored or untracked working-tree files may ship. See
 * scripts/check-package-files.mjs and docs/handoff/LLMVERIFY-RELEASE-CANDIDATE.md.
 */

const { execSync } = require('child_process');
const path = require('path');

describe('npm package inventory', () => {
  test('every shipped file is git-tracked or build output', () => {
    const script = path.join(__dirname, '..', 'scripts', 'check-package-files.mjs');
    const out = execSync(`node "${script}"`, { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
    expect(out).toContain('OK: artifact is fully reproducible');
  }, 60000);
});
