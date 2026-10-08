/**
 * Module compatibility tests — verify the built package works from
 * CommonJS require() and ESM import, and that runtime schema files
 * ship in the package layout.
 *
 * Requires `npm run build` first (CI builds before tests). Skipped
 * gracefully when dist/ is absent so `jest` alone doesn't fail before
 * a build.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const DIST = path.join(__dirname, '..', 'dist');
const DIST_INDEX = path.join(DIST, 'index.js');
const SCHEMA = path.join(__dirname, '..', 'schema', 'verify-result.schema.json');

const distExists = fs.existsSync(DIST_INDEX);
const describeDist = distExists ? describe : describe.skip;

describeDist('package consumers (requires npm run build)', () => {
  describe('CommonJS require()', () => {
    it('exposes the public API', () => {
      const pkg = require(DIST_INDEX);
      for (const name of [
        'verify', 'isInputSafe', 'containsPII', 'redactPII',
        'validateVerifyResult', 'getEngineCapabilities', 'RESULT_SCHEMA_VERSION',
        'AuditLogger', 'getLLMVerifyHome'
      ]) {
        expect(typeof pkg[name]).toBeDefined();
      }
    });

    it('verify() produces a schema-valid result', async () => {
      const pkg = require(DIST_INDEX);
      const result = await pkg.verify({ content: 'module compatibility check' });
      expect(result.schemaVersion).toBe('1.0');
      const check = pkg.validateVerifyResult(result);
      expect(check.errors).toEqual([]);
      expect(check.valid).toBe(true);
    });

    it('supports subpath exports', () => {
      const core = require(path.join(DIST, 'core', 'index.js'));
      expect(typeof core.run).toBe('function');
      const engines = require(path.join(DIST, 'engines', 'index.js'));
      expect(typeof engines.HallucinationEngine).toBe('function');
      const adapters = require(path.join(DIST, 'adapters', 'index.js'));
      expect(typeof adapters.createAdapter).toBe('function');
    });
  });

  describe('ESM import', () => {
    it('import llmverify resolves and exposes verify', () => {
      // Dynamic import() inside jest requires --experimental-vm-modules;
      // spawn a real node process to test actual ESM resolution.
      const { pathToFileURL } = require('url');
      const url = pathToFileURL(DIST_INDEX).href;
      const script = `import(${JSON.stringify(url)}).then(m => {
        const verifyFn = m.verify || (m.default && m.default.verify);
        if (typeof verifyFn !== 'function') {
          console.error('verify not exposed via ESM import');
          process.exit(1);
        }
      })`;
      execFileSync(process.execPath, ['--input-type=module', '-e', script], {
        encoding: 'utf-8',
        timeout: 30000
      });
    });
  });

  describe('shipped schema files', () => {
    it('verify-result schema is present beside dist/', () => {
      expect(fs.existsSync(SCHEMA)).toBe(true);
      const schema = JSON.parse(fs.readFileSync(SCHEMA, 'utf-8'));
      expect(schema.$schema).toContain('json-schema.org');
    });

    it('getVerifyResultSchemaPath() resolves inside the package', () => {
      const { getVerifyResultSchemaPath } = require(DIST_INDEX);
      const p = getVerifyResultSchemaPath();
      expect(p).not.toBeNull();
      expect(fs.existsSync(p)).toBe(true);
    });
  });

  describe('CLI smoke', () => {
    const cli = path.join(DIST, 'cli.js');
    it('llmverify --version runs', () => {
      const out = execFileSync('node', [cli, '--version'], { encoding: 'utf-8', timeout: 30000 });
      expect(out.trim()).toMatch(/^\d+\.\d+\.\d+/);
    });

    it('llmverify doctor runs', () => {
      const out = execFileSync('node', [cli, 'doctor'], { encoding: 'utf-8', timeout: 30000 });
      expect(out.length).toBeGreaterThan(0);
    });
  });
});
