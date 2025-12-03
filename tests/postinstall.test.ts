/**
 * Postinstall Tests
 * 
 * Tests for the postinstall banner script.
 */

import { execSync } from 'child_process';
import * as path from 'path';

const POSTINSTALL_PATH = path.join(__dirname, '..', 'dist', 'postinstall.js');

describe('Postinstall Script', () => {
  it('should execute without errors', () => {
    expect(() => {
      execSync(`node "${POSTINSTALL_PATH}"`, {
        encoding: 'utf-8',
        timeout: 10000
      });
    }).not.toThrow();
  });

  it('should output banner content', () => {
    const output = execSync(`node "${POSTINSTALL_PATH}"`, {
      encoding: 'utf-8',
      timeout: 10000
    });
    
    expect(output).toContain('llmverify');
  });

  it('should include quick start commands', () => {
    const output = execSync(`node "${POSTINSTALL_PATH}"`, {
      encoding: 'utf-8',
      timeout: 10000
    });
    
    // Should mention wizard or run commands
    expect(output.toLowerCase()).toMatch(/wizard|run|verify/);
  });

  it('should include documentation links or help message', () => {
    const output = execSync(`node "${POSTINSTALL_PATH}"`, {
      encoding: 'utf-8',
      timeout: 10000,
      env: { ...process.env, CI: undefined, LLMVERIFY_SILENT: undefined }
    });
    
    // In non-CI mode, should include github link
    // In CI mode, should include help message
    expect(output).toMatch(/github\.com|--help/);
  });
});
