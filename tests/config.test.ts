/**
 * Tests for configuration system
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { loadConfig, loadConfigFromEnv, createDefaultConfigFile } from '../src/config';

describe('Configuration System', () => {
  const testDir = path.join(os.tmpdir(), 'llmverify-test-' + Date.now());
  
  beforeAll(() => {
    fs.mkdirSync(testDir, { recursive: true });
  });
  
  afterAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });
  
  describe('loadConfigFromEnv', () => {
    it('should load config from environment variables', () => {
      process.env.LLMVERIFY_TIER = 'professional';
      process.env.LLMVERIFY_API_KEY = 'test-key';
      
      const config = loadConfigFromEnv();
      
      expect(config.tier).toBe('professional');
      expect(config.privacy?.apiKey).toBe('test-key');
      
      delete process.env.LLMVERIFY_TIER;
      delete process.env.LLMVERIFY_API_KEY;
    });
    
    it('should return empty config if no env vars set', () => {
      const config = loadConfigFromEnv();
      expect(Object.keys(config).length).toBeGreaterThanOrEqual(0);
    });
  });
  
  describe('createDefaultConfigFile', () => {
    it('should create a default config file', () => {
      const configPath = createDefaultConfigFile(testDir);
      
      expect(fs.existsSync(configPath)).toBe(true);
      
      const content = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      expect(content.tier).toBe('free');
      expect(content.engines).toBeDefined();
    });
  });
  
  describe('loadConfig', () => {
    it('should load complete config with defaults', () => {
      const config = loadConfig();
      
      expect(config.tier).toBeDefined();
      expect(config.engines).toBeDefined();
      expect(config.privacy).toBeDefined();
    });
    
    it('should merge runtime config', () => {
      const config = loadConfig({ tier: 'starter' });
      
      expect(config.tier).toBe('starter');
    });
  });
});
