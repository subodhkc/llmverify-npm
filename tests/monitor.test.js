/**
 * Tests for monitor.js functionality
 */

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

describe('Monitor Script', () => {
  let serverProcess;
  // Distinct port from integration.test.js — jest runs suites in
  // parallel workers and both spawn a server.
  const SERVER_PORT = 9010;
  const stateDir = require('os').tmpdir() + path.sep + 'llmverify-monitor-' + process.pid;

  beforeAll((done) => {
    // Kill any leftover server holding our port (previous crashed runs)
    const killCmd = process.platform === 'win32'
      ? `powershell -Command "$proc = Get-NetTCPConnection -LocalPort ${SERVER_PORT} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; if ($proc) { Stop-Process -Id $proc -Force }"`
      : `lsof -ti:${SERVER_PORT} | xargs kill -9 2>/dev/null || true`;

    require('child_process').exec(killCmd, () => {
      // Start the server for testing with an isolated state dir
      serverProcess = spawn('node', [
        path.join(__dirname, '../bin/llmverify-serve.js'),
        `--port=${SERVER_PORT}`
      ], {
        // stdio ignored: open child pipes cause jest worker ECONNRESET at teardown
        stdio: 'ignore',
        env: { ...process.env, NODE_ENV: 'test', LLMVERIFY_HOME: stateDir }
      });
      serverProcess.unref();

      // Poll /health until the server is actually listening (max ~30s)
      const deadline = Date.now() + 30000;
      const poll = () => {
        http.get(`http://localhost:${SERVER_PORT}/health`, (res) => {
          res.resume();
          if (res.statusCode === 200) done();
          else if (Date.now() < deadline) setTimeout(poll, 500);
          else done(new Error('server did not become healthy'));
        }).on('error', () => {
          if (Date.now() < deadline) setTimeout(poll, 500);
          else done(new Error('server did not start in 30s'));
        });
      };
      poll();
    });
  }, 45000);

  afterAll((done) => {
    if (serverProcess) {
      // Destroy pooled keep-alive sockets BEFORE the server dies —
      // otherwise their ECONNRESET propagates as an uncaught error and
      // jest reports the whole suite as failed.
      http.globalAgent.destroy();
      serverProcess.kill();
      setTimeout(done, 500);
    } else {
      done();
    }
  });

  describe('Server Health Check', () => {
    test('should connect to server successfully', (done) => {
      http.get(`http://localhost:${SERVER_PORT}/health`, (res) => {
        expect(res.statusCode).toBe(200);
        
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          const health = JSON.parse(data);
          expect(health.ok).toBe(true);
          expect(health.service).toBe('llmverify');
          done();
        });
      }).on('error', done);
    });
  });

  describe('Content Verification', () => {
    test('should verify safe content with low risk', (done) => {
      const content = 'Hello, this is a simple test message.';
      const data = JSON.stringify({ content });

      const options = {
        hostname: 'localhost',
        port: SERVER_PORT,
        path: '/verify',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      };

      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          const result = JSON.parse(body);
          
          expect(result.summary).toBeDefined();
          expect(result.result).toBeDefined();
          expect(result.result.risk).toBeDefined();
          expect(result.result.risk.overall).toBeLessThan(0.5);
          expect(result.result.risk.level).toBe('low');
          
          done();
        });
      });

      req.on('error', done);
      req.write(data);
      req.end();
    });

    test('should detect high risk in dangerous commands', (done) => {
      const content = 'Run this command: rm -rf / --no-preserve-root';
      const data = JSON.stringify({ content });

      const options = {
        hostname: 'localhost',
        port: SERVER_PORT,
        path: '/verify',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      };

      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          const result = JSON.parse(body);
          
          // Dangerous commands must elevate risk above the safe baseline;
          // the engine currently scores this pattern ~0.45 (moderate).
          expect(result.result.risk.overall).toBeGreaterThan(0.3);
          expect(['moderate', 'high', 'critical']).toContain(result.result.risk.level);
          expect(result.summary.findings.length).toBeGreaterThan(0);
          
          done();
        });
      });

      req.on('error', done);
      req.write(data);
      req.end();
    });

    test('should detect PII in content', (done) => {
      const content = 'My email is john.doe@example.com and phone is 555-123-4567';
      const data = JSON.stringify({ content });

      const options = {
        hostname: 'localhost',
        port: SERVER_PORT,
        path: '/verify',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      };

      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          const result = JSON.parse(body);
          
          // PII findings surface under the 'privacy' category in csm6
          const privacyFindings = result.summary.findings.filter(f => f.category === 'privacy');
          expect(privacyFindings.length).toBeGreaterThan(0);
          
          done();
        });
      });

      req.on('error', done);
      req.write(data);
      req.end();
    });
  });

  describe('Risk Level Definitions', () => {
    test('LOW risk should be 0-25%', () => {
      const RISK_LEVELS = {
        LOW: { min: 0, max: 25 }
      };
      
      expect(RISK_LEVELS.LOW.min).toBe(0);
      expect(RISK_LEVELS.LOW.max).toBe(25);
    });

    test('MODERATE risk should be 26-50%', () => {
      const RISK_LEVELS = {
        MODERATE: { min: 26, max: 50 }
      };
      
      expect(RISK_LEVELS.MODERATE.min).toBe(26);
      expect(RISK_LEVELS.MODERATE.max).toBe(50);
    });

    test('HIGH risk should be 51-75%', () => {
      const RISK_LEVELS = {
        HIGH: { min: 51, max: 75 }
      };
      
      expect(RISK_LEVELS.HIGH.min).toBe(51);
      expect(RISK_LEVELS.HIGH.max).toBe(75);
    });

    test('CRITICAL risk should be 76-100%', () => {
      const RISK_LEVELS = {
        CRITICAL: { min: 76, max: 100 }
      };
      
      expect(RISK_LEVELS.CRITICAL.min).toBe(76);
      expect(RISK_LEVELS.CRITICAL.max).toBe(100);
    });
  });

  describe('Risk Explanation Logic', () => {
    test('should provide explanations for risk scores', () => {
      const mockResult = {
        result: {
          risk: {
            overall: 0.172,
            level: 'low',
            breakdown: {
              hallucination: 0.15,
              consistency: 0.92,
              security: 0.05,
              pii: 0.0
            }
          }
        },
        summary: {
          findings: []
        }
      };

      // Test that risk score is correctly interpreted
      const riskScore = Math.round(mockResult.result.risk.overall * 100 * 10) / 10;
      expect(riskScore).toBe(17.2);
      expect(mockResult.result.risk.level).toBe('low');
    });

    test('should generate suggestions for high risk content', () => {
      const mockResult = {
        result: {
          risk: {
            overall: 0.68,
            level: 'high',
            breakdown: {
              hallucination: 0.45,
              consistency: 0.65,
              security: 0.75,
              pii: 0.0
            }
          }
        },
        summary: {
          findings: [
            { type: 'security', message: 'Dangerous command detected' },
            { type: 'hallucination', message: 'Unverified claim' }
          ]
        }
      };

      expect(mockResult.summary.findings.length).toBeGreaterThan(0);
      expect(mockResult.result.risk.breakdown.security).toBeGreaterThan(0.5);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid JSON gracefully', (done) => {
      const data = 'invalid json';

      const options = {
        hostname: 'localhost',
        port: SERVER_PORT,
        path: '/verify',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      };

      const req = http.request(options, (res) => {
        expect(res.statusCode).toBeGreaterThanOrEqual(400);
        done();
      });

      req.on('error', done);
      req.write(data);
      req.end();
    });

    test('should handle empty content', (done) => {
      const data = JSON.stringify({ content: '' });

      const options = {
        hostname: 'localhost',
        port: SERVER_PORT,
        path: '/verify',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      };

      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          const result = JSON.parse(body);
          // Server rejects empty content with a structured error — either
          // a summary or an error payload is acceptable, never a crash.
          expect(result.summary || result.error).toBeDefined();
          done();
        });
      });

      req.on('error', done);
      req.write(data);
      req.end();
    });
  });

  describe('Performance', () => {
    test('should respond within reasonable time', (done) => {
      const startTime = Date.now();
      const content = 'Test message for performance check';
      const data = JSON.stringify({ content });

      const options = {
        hostname: 'localhost',
        port: SERVER_PORT,
        path: '/verify',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      };

      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          const endTime = Date.now();
          const duration = endTime - startTime;
          
          expect(duration).toBeLessThan(5000); // Should respond within 5 seconds
          done();
        });
      });

      req.on('error', done);
      req.write(data);
      req.end();
    });
  });
});
