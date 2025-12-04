#!/usr/bin/env node

/**
 * llmverify Chat Monitor
 * Monitors clipboard and verifies AI responses automatically
 */

const http = require('http');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const SERVER_URL = 'http://localhost:9009';
let lastClipboard = '';

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  gray: '\x1b[90m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Risk level definitions and thresholds
const RISK_LEVELS = {
  LOW: { min: 0, max: 25, color: 'green', action: 'Safe to use' },
  MODERATE: { min: 26, max: 50, color: 'yellow', action: 'Review recommended' },
  HIGH: { min: 51, max: 75, color: 'red', action: 'Fix before using' },
  CRITICAL: { min: 76, max: 100, color: 'red', action: 'Do not use' }
};

function explainRisk(result) {
  const riskScore = Math.round(result.result.risk.overall * 100 * 10) / 10;
  const riskLevel = result.result.risk.level.toUpperCase();
  const findings = result.summary.findings || [];
  
  const explanations = [];
  
  // Explain what the score means
  const levelInfo = RISK_LEVELS[riskLevel];
  explanations.push(`Risk Score ${riskScore}% means: ${levelInfo.action}`);
  explanations.push(`Range: ${levelInfo.min}-${levelInfo.max}% is ${riskLevel}`);
  
  // Break down the risk factors
  const breakdown = result.result.risk.breakdown || {};
  if (breakdown.hallucination > 0.1) {
    explanations.push(`Hallucination risk: ${Math.round(breakdown.hallucination * 100)}% - May contain unverified claims`);
  }
  if (breakdown.consistency < 0.9) {
    explanations.push(`Consistency: ${Math.round(breakdown.consistency * 100)}% - Internal contradictions detected`);
  }
  if (breakdown.security > 0.1) {
    explanations.push(`Security risk: ${Math.round(breakdown.security * 100)}% - May contain unsafe content`);
  }
  
  // Provide actionable suggestions
  const suggestions = [];
  if (findings.length > 0) {
    suggestions.push('How to lower risk:');
    if (findings.some(f => f.type === 'hallucination')) {
      suggestions.push('  - Verify factual claims with reliable sources');
      suggestions.push('  - Ask AI to cite sources for specific facts');
    }
    if (findings.some(f => f.type === 'security')) {
      suggestions.push('  - Remove or sanitize sensitive information');
      suggestions.push('  - Avoid using commands or code without review');
    }
    if (findings.some(f => f.type === 'consistency')) {
      suggestions.push('  - Check for contradictory statements');
      suggestions.push('  - Ask AI to clarify conflicting information');
    }
    if (findings.some(f => f.type === 'pii')) {
      suggestions.push('  - Remove personal identifiable information');
      suggestions.push('  - Use generic examples instead of real data');
    }
  } else if (riskScore > 15) {
    suggestions.push('How to lower risk:');
    suggestions.push('  - Ask AI to be more specific and factual');
    suggestions.push('  - Request sources for important claims');
    suggestions.push('  - Break complex responses into smaller parts');
  }
  
  return { explanations, suggestions };
}

async function checkServer() {
  return new Promise((resolve) => {
    const req = http.get(`${SERVER_URL}/health`, (res) => {
      resolve(res.statusCode === 200);
    });
    
    req.on('error', (err) => {
      if (err.code === 'ECONNREFUSED') {
        log('\nERROR: Cannot connect to server', 'red');
        log('', 'reset');
        log('The llmverify server is not running.', 'yellow');
        log('', 'reset');
        log('SOLUTION:', 'cyan');
        log('  1. Open a new terminal', 'gray');
        log('  2. Run: npm run serve', 'gray');
        log('  3. Wait for "Running on http://localhost:9009"', 'gray');
        log('  4. Then restart this monitor', 'gray');
        log('', 'reset');
        log('If port 9009 is already in use:', 'yellow');
        log('  Run: npm run serve:force', 'gray');
        log('', 'reset');
      } else if (err.code === 'ETIMEDOUT') {
        log('\nERROR: Server connection timeout', 'red');
        log('', 'reset');
        log('The server is not responding.', 'yellow');
        log('', 'reset');
        log('SOLUTION:', 'cyan');
        log('  1. Check if server is running: npm run serve', 'gray');
        log('  2. Check your firewall settings', 'gray');
        log('  3. Ensure port 9009 is not blocked', 'gray');
        log('', 'reset');
      } else {
        log(`\nERROR: ${err.message}`, 'red');
        log('', 'reset');
        log('SOLUTION:', 'cyan');
        log('  See docs/ERROR-GUIDE.md for detailed troubleshooting', 'gray');
        log('', 'reset');
      }
      resolve(false);
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function verifyContent(content) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ content });
    const options = {
      hostname: 'localhost',
      port: 9009,
      path: '/verify',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: 10000
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          if (body) {
            const result = JSON.parse(body);
            resolve(result);
          } else {
            reject(new Error('EMPTY_RESPONSE'));
          }
        } catch (err) {
          reject(new Error('PARSE_ERROR'));
        }
      });
    });

    req.on('error', (err) => {
      if (err.code === 'ECONNREFUSED') {
        reject(new Error('SERVER_NOT_RUNNING'));
      } else if (err.code === 'ETIMEDOUT') {
        reject(new Error('CONNECTION_TIMEOUT'));
      } else if (err.code === 'ECONNRESET') {
        reject(new Error('CONNECTION_RESET'));
      } else {
        reject(new Error(`NETWORK_ERROR: ${err.message}`));
      }
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('REQUEST_TIMEOUT'));
    });

    try {
      req.write(data);
      req.end();
    } catch (err) {
      reject(new Error(`WRITE_ERROR: ${err.message}`));
    }
  });
}

async function getClipboard() {
  try {
    const { stdout } = await execAsync('powershell -command "Get-Clipboard"');
    return stdout.trim();
  } catch {
    return '';
  }
}

async function monitor() {
  console.clear();
  log('╔══════════════════════════════════════════════════════════════════════════════╗', 'cyan');
  log('║  llmverify Chat Monitor - AI Response Verification                          ║', 'cyan');
  log('╚══════════════════════════════════════════════════════════════════════════════╝', 'cyan');
  log('');
  log('Checking server...', 'yellow');

  const serverOk = await checkServer();
  if (!serverOk) {
    log('ERROR: Server not running!', 'red');
    log('Start server with: npm run serve', 'yellow');
    process.exit(1);
  }

  log('Server OK', 'green');
  log('');
  log('╔══════════════════════════════════════════════════════════════════════════════╗', 'green');
  log('║  READY - Copy AI responses to see verification scores                       ║', 'green');
  log('╚══════════════════════════════════════════════════════════════════════════════╝', 'green');
  log('');
  log('Instructions:', 'cyan');
  log('  1. Select AI response in chat');
  log('  2. Copy it (Ctrl+C)');
  log('  3. Verification score appears below automatically');
  log('');
  log('  Press Ctrl+C to stop', 'gray');
  log('');
  log('Waiting for AI responses...', 'yellow');
  log('');

  // Monitor clipboard
  setInterval(async () => {
    try {
      const clipboard = await getClipboard();
      
      if (clipboard && clipboard !== lastClipboard && clipboard.length > 50) {
        lastClipboard = clipboard;
        
        log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'gray');
        log('VERIFYING: Checking AI response...', 'cyan');
        
        try {
          const result = await verifyContent(clipboard);
          
          // Check if server returned an error
          if (result.error || !result.result || !result.result.risk) {
            const errorMsg = result.error || result.message || 'Unknown error';
            log('');
            log('ERROR: Server returned an error', 'red');
            log('', 'reset');
            log(errorMsg, 'yellow');
            
            // Check for content too large error
            if (errorMsg.includes('exceeds maximum size') || errorMsg.includes('too large')) {
              log('', 'reset');
              log('SOLUTION:', 'cyan');
              log('  1. Content is too large to verify at once', 'gray');
              log('  2. Copy and verify smaller sections separately', 'gray');
              log('  3. Break your AI response into chunks', 'gray');
            }
            log('');
            return; // Exit this verification attempt
          }
          
          const riskLevel = result.result.risk.level.toUpperCase();
          const riskScore = Math.round(result.result.risk.overall * 100 * 10) / 10;
          const verdict = result.summary.verdict;
          
          const color = riskLevel === 'LOW' ? 'green' : 
                       riskLevel === 'MODERATE' ? 'yellow' : 'red';
          
          log('');
          log('╔══════════════════════════════════════════════════════════════════════════════╗', color);
          log('║  VERIFICATION RESULT                                                         ║', color);
          log('╚══════════════════════════════════════════════════════════════════════════════╝', color);
          log('');
          log(`  Verdict:      ${verdict}`, color);
          log(`  Risk Level:   ${riskLevel}`, color);
          log(`  Risk Score:   ${riskScore}%`, color);
          log(`  Explanation:  ${result.summary.explanation}`);
          
          if (result.summary.findings && result.summary.findings.length > 0) {
            log('');
            log('  Findings:', 'red');
            result.summary.findings.forEach(finding => {
              log(`    - ${finding.message || finding}`, 'red');
            });
          }
          
          // Add detailed risk explanation
          const { explanations, suggestions } = explainRisk(result);
          
          if (explanations.length > 0) {
            log('');
            log('  Understanding Your Risk Score:', 'cyan');
            explanations.forEach(exp => {
              log(`    ${exp}`, 'gray');
            });
          }
          
          if (suggestions.length > 0) {
            log('');
            suggestions.forEach(sug => {
              if (sug.startsWith('How to')) {
                log(`  ${sug}`, 'yellow');
              } else {
                log(`  ${sug}`, 'gray');
              }
            });
          }
          
          log('');
          log(`  Timestamp:    ${new Date().toLocaleString()}`, 'gray');
          log('');
          
        } catch (error) {
          log('');
          log('ERROR: Verification failed', 'red');
          log('', 'reset');
          
          const errorMsg = error.message;
          
          if (errorMsg === 'SERVER_NOT_RUNNING') {
            log('The server stopped responding.', 'yellow');
            log('', 'reset');
            log('SOLUTION:', 'cyan');
            log('  1. Check Terminal 1 - is the server still running?', 'gray');
            log('  2. If not, restart it: npm run serve', 'gray');
            log('  3. Then copy the AI response again', 'gray');
          } else if (errorMsg === 'CONNECTION_TIMEOUT') {
            log('Server took too long to respond.', 'yellow');
            log('', 'reset');
            log('SOLUTION:', 'cyan');
            log('  1. The content might be too long', 'gray');
            log('  2. Try copying a shorter section', 'gray');
            log('  3. Or wait and try again', 'gray');
          } else if (errorMsg === 'CONNECTION_RESET') {
            log('Connection was interrupted.', 'yellow');
            log('', 'reset');
            log('SOLUTION:', 'cyan');
            log('  1. Restart the server: npm run serve:force', 'gray');
            log('  2. Then restart this monitor', 'gray');
          } else if (errorMsg === 'REQUEST_TIMEOUT') {
            log('Verification took too long (>10 seconds).', 'yellow');
            log('', 'reset');
            log('SOLUTION:', 'cyan');
            log('  1. Content might be too large', 'gray');
            log('  2. Try verifying smaller sections', 'gray');
            log('  3. Check server performance', 'gray');
          } else if (errorMsg === 'EMPTY_RESPONSE') {
            log('Server returned no data.', 'yellow');
            log('', 'reset');
            log('SOLUTION:', 'cyan');
            log('  1. Restart server: npm run serve:force', 'gray');
            log('  2. Check server logs for errors', 'gray');
          } else if (errorMsg === 'PARSE_ERROR') {
            log('Server response was invalid.', 'yellow');
            log('', 'reset');
            log('SOLUTION:', 'cyan');
            log('  1. Restart server: npm run serve:force', 'gray');
            log('  2. Update llmverify: npm update llmverify', 'gray');
          } else {
            log(`${errorMsg}`, 'yellow');
            log('', 'reset');
            log('SOLUTION:', 'cyan');
            log('  See docs/ERROR-GUIDE.md for detailed troubleshooting', 'gray');
          }
          log('');
        }
      }
    } catch (error) {
      // Ignore clipboard errors
    }
  }, 500);
}

// Handle Ctrl+C
process.on('SIGINT', () => {
  log('\nMonitor stopped', 'yellow');
  process.exit(0);
});

// Start monitoring
monitor().catch(error => {
  log(`ERROR: ${error.message}`, 'red');
  process.exit(1);
});
