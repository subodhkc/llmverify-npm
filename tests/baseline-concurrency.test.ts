/**
 * Baseline storage concurrency & corruption tests.
 *
 * - Atomic writes: parallel processes hammering the same baseline file
 *   must never leave torn JSON for readers.
 * - Corruption recovery: an unparseable baseline file is quarantined and
 *   a fresh baseline starts instead of erroring on every read.
 * - In-process concurrency: many interleaved updateBaseline calls keep
 *   the stored file parseable.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { fork } from 'child_process';
import { BaselineStorage } from '../src/baseline/storage';

function tmpdir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'llmverify-baseline-'));
}

describe('BaselineStorage atomic writes', () => {
  it('concurrent in-process updates keep the file parseable', () => {
    const dir = tmpdir();
    const storage = new BaselineStorage({ baselineDir: dir });
    for (let i = 0; i < 50; i++) {
      storage.updateBaseline({
        latency: 100 + i,
        contentLength: 50 + i,
        riskScore: (i % 10) / 10,
        riskLevel: 'low'
      });
      // A reader at any point must see valid JSON, never a torn write
      const raw = fs.readFileSync(path.join(dir, 'baseline.json'), 'utf-8');
      expect(() => JSON.parse(raw)).not.toThrow();
    }
    const baseline = storage.loadBaseline();
    expect(baseline).not.toBeNull();
    expect(baseline!.sampleCount).toBe(50);
  });

  it('parallel child processes never produce a torn baseline file', async () => {
    const dir = tmpdir();
    // Worker script: each process performs several updateBaseline writes
    // against the SAME directory — the pre-fix failure mode in CI.
    const worker = `
      const { BaselineStorage } = require(${JSON.stringify(path.join(__dirname, '..', 'dist', 'baseline', 'storage.js'))});
      const s = new BaselineStorage({ baselineDir: process.argv[2] });
      for (let i = 0; i < 30; i++) {
        s.updateBaseline({ latency: i, contentLength: i, riskScore: i / 100, riskLevel: 'low' });
      }
    `;
    const script = path.join(dir, 'worker.js');
    fs.writeFileSync(script, worker);

    const workers = Array.from({ length: 4 }, () =>
      new Promise<void>((resolve, reject) => {
        const child = fork(script, [dir], { silent: true });
        child.on('exit', code => (code === 0 ? resolve() : reject(new Error(`worker exited ${code}`))));
        child.on('error', reject);
      })
    );
    await Promise.all(workers);

    // The file must be complete, parseable JSON — regardless of how many
    // writes raced (last-writer-wins is acceptable; torn reads are not).
    const raw = fs.readFileSync(path.join(dir, 'baseline.json'), 'utf-8');
    const baseline = JSON.parse(raw);
    expect(baseline.sampleCount).toBeGreaterThan(0);
    // No stray temp files left behind
    expect(fs.readdirSync(dir).filter(f => f.endsWith('.tmp'))).toEqual([]);
  }, 60000);

  it('quarantines a corrupted baseline and recovers', () => {
    const dir = tmpdir();
    const file = path.join(dir, 'baseline.json');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, '{"version": "1.0.0", truncated'); // torn write

    const storage = new BaselineStorage({ baselineDir: dir });
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(storage.loadBaseline()).toBeNull();
    expect(errSpy).toHaveBeenCalledTimes(1);

    // Corrupt file was quarantined — second read does not error again
    expect(storage.loadBaseline()).toBeNull();
    expect(errSpy).toHaveBeenCalledTimes(1);
    expect(fs.existsSync(file)).toBe(false);
    expect(fs.readdirSync(dir).some(f => f.startsWith('baseline.json.corrupt-'))).toBe(true);

    // Recovery: a new baseline writes cleanly over the quarantine
    storage.updateBaseline({ latency: 10, contentLength: 5, riskScore: 0.1, riskLevel: 'low' });
    const baseline = storage.loadBaseline();
    expect(baseline!.sampleCount).toBe(1);
    errSpy.mockRestore();
  });

  it('repeated verify()-scale writes from multiple storage instances stay consistent', () => {
    const dir = tmpdir();
    const a = new BaselineStorage({ baselineDir: dir });
    const b = new BaselineStorage({ baselineDir: dir });
    for (let i = 0; i < 20; i++) {
      (i % 2 === 0 ? a : b).updateBaseline({
        latency: 50, contentLength: 10, riskScore: 0.2, riskLevel: 'low'
      });
    }
    const raw = fs.readFileSync(path.join(dir, 'baseline.json'), 'utf-8');
    expect(() => JSON.parse(raw)).not.toThrow();
  });
});
