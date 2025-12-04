# llmverify Commands Reference

Complete guide to all llmverify commands and how to use them.

---

## Quick Command List

```bash
# Server Commands
npm run serve              # Start verification server
npm run serve:force        # Force start (kills port conflicts)

# Monitor Commands
npm run monitor            # Start clipboard monitor

# Setup Commands
npm run setup-ai           # Setup AI assistant integration

# Testing Commands
npm test                   # Run all tests
npm run test:integration   # Run integration tests only
npm run test:coverage      # Run tests with coverage report
npm run test:watch         # Run tests in watch mode

# Development Commands
npm run build              # Build TypeScript to JavaScript
npm run typecheck          # Check TypeScript types
npm run prepublishOnly     # Pre-publish checks
```

---

## Server Commands

### npm run serve

**What it does:** Starts the llmverify verification server  
**When to use:** Before using monitor or API  
**Port:** 9009  
**Runs:** Until you stop it (Ctrl+C)

**Usage:**
```bash
npm run serve
```

**Output:**
```
╔══════════════════════════════════════════════════════════════════════════════╗
║  llmverify server v1.0.0                                                    ║
║  Running on http://localhost:9009                                           ║
╚══════════════════════════════════════════════════════════════════════════════╝

Available endpoints:
  GET  http://localhost:9009/health        - Health check
  POST http://localhost:9009/verify        - Verify AI output
  POST http://localhost:9009/check-input   - Check input safety
  POST http://localhost:9009/check-pii     - Detect PII
  POST http://localhost:9009/classify      - Classify output

Privacy: All processing is 100% local. Zero telemetry.

Press Ctrl+C to stop the server.
```

**Common Issues:**
- **Port already in use:** Use `npm run serve:force` instead
- **Server won't start:** Check if Node.js is installed: `node --version`
- **Permission denied:** Run terminal as administrator (Windows)

---

### npm run serve:force

**What it does:** Kills any process on port 9009 and starts server  
**When to use:** When port 9009 is already in use  
**Benefit:** Automatic conflict resolution

**Usage:**
```bash
npm run serve:force
```

**What it does:**
1. Detects your operating system (Windows/Unix)
2. Finds process using port 9009
3. Kills that process
4. Waits 1 second for port to be released
5. Starts llmverify server

**Output:**
```
Checking for existing process on port 9009...
Found process on port 9009
Killing process...
Process killed successfully
Waiting for port to be released...
Starting llmverify server...

╔══════════════════════════════════════════════════════════════════════════════╗
║  llmverify server v1.0.0                                                    ║
║  Running on http://localhost:9009                                           ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

**When to use:**
- First time starting server
- After server crashed
- When you see "EADDRINUSE" error
- When unsure if server is running

---

## Monitor Commands

### npm run monitor

**What it does:** Monitors clipboard and verifies AI responses automatically  
**When to use:** When working with AI in any IDE  
**Requires:** Server must be running first (`npm run serve`)

**Usage:**
```bash
# Terminal 1
npm run serve

# Terminal 2
npm run monitor
```

**Output:**
```
╔══════════════════════════════════════════════════════════════════════════════╗
║  llmverify Chat Monitor - AI Response Verification                          ║
╚══════════════════════════════════════════════════════════════════════════════╝

Checking server...
Server OK

╔══════════════════════════════════════════════════════════════════════════════╗
║  READY - Copy AI responses to see verification scores                       ║
╚══════════════════════════════════════════════════════════════════════════════╝

Instructions:
  1. Select AI response in chat
  2. Copy it (Ctrl+C)
  3. Verification score appears below automatically

  Press Ctrl+C to stop

Waiting for AI responses...
```

**How to use:**
1. Start server in Terminal 1
2. Start monitor in Terminal 2
3. Chat with AI in your IDE
4. Copy AI response (Ctrl+C)
5. See verification score in Terminal 2

**What you see:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VERIFYING: Checking AI response...

╔══════════════════════════════════════════════════════════════════════════════╗
║  VERIFICATION RESULT                                                         ║
╚══════════════════════════════════════════════════════════════════════════════╝

  Verdict:      [PASS] SAFE TO USE
  Risk Level:   LOW
  Risk Score:   11.2%
  Explanation:  This AI response passed all safety checks.

  Understanding Your Risk Score:
    Risk Score 11.2% means: Safe to use
    Range: 0-25% is LOW

  Timestamp:    12/4/2025, 11:02:02 AM
```

**Common Issues:**
- **Server not running:** Start server first: `npm run serve`
- **No scores appearing:** Content must be >50 characters
- **Errors:** See [ERROR-GUIDE.md](ERROR-GUIDE.md)

---

## Setup Commands

### npm run setup-ai

**What it does:** Creates AI prompt enhancements for your IDE  
**When to use:** First time setup (optional)  
**Benefit:** Helps AI assistants guide you on llmverify usage

**Usage:**
```bash
npm run setup-ai
```

**What it creates:**
```
.cascade/prompts.md    # For Windsurf IDE
.cursor/prompts.md     # For Cursor IDE
.vscode/prompts.md     # For VS Code
```

**Content:**
- How to use llmverify
- Common commands
- Troubleshooting tips
- Best practices

**When to use:**
- After installing llmverify
- When AI doesn't know about llmverify
- To improve AI assistance quality

**Skip if:**
- You don't use AI assistants in IDE
- You prefer manual setup
- You already know llmverify well

---

## Testing Commands

### npm test

**What it does:** Runs all tests (unit + integration)  
**When to use:** Before committing changes, after updates  
**Time:** ~10-20 seconds

**Usage:**
```bash
npm test
```

**Output:**
```
PASS  src/verify.test.ts
PASS  src/redact.test.ts
PASS  tests/integration.test.js

Test Suites: 3 passed, 3 total
Tests:       624 passed, 624 total
Snapshots:   0 total
Time:        12.345 s
```

**What it tests:**
- Core verification logic
- PII detection
- Input validation
- JSON repair
- Server endpoints
- Error handling

---

### npm run test:integration

**What it does:** Runs integration tests only  
**When to use:** Testing server and monitor functionality  
**Requires:** Server running on port 9009

**Usage:**
```bash
# Terminal 1
npm run serve

# Terminal 2
npm run test:integration
```

**What it tests:**
- Server health
- Content verification scenarios
- Risk explanations
- Error handling
- Performance
- Concurrent requests

**Output:**
```
PASS  tests/integration.test.js
  Integration Tests
    Server Health
      ✓ should respond to health check (45 ms)
    Content Verification Scenarios
      ✓ Scenario 1: Simple safe content (234 ms)
      ✓ Scenario 2: Code with no issues (189 ms)
      ✓ Scenario 3: Dangerous command detection (256 ms)
      ...

Tests:       16 passed, 16 total
Time:        8.234 s
```

---

### npm run test:coverage

**What it does:** Runs tests with code coverage report  
**When to use:** Checking test completeness  
**Output:** Coverage report in terminal + HTML report

**Usage:**
```bash
npm run test:coverage
```

**Output:**
```
Test Suites: 3 passed, 3 total
Tests:       624 passed, 624 total

Coverage summary:
  Statements   : 92.5% ( 1234/1334 )
  Branches     : 88.3% ( 456/516 )
  Functions    : 95.2% ( 234/246 )
  Lines        : 93.1% ( 1198/1287 )

Coverage report: coverage/lcov-report/index.html
```

**View HTML report:**
```bash
# Windows
start coverage/lcov-report/index.html

# Mac
open coverage/lcov-report/index.html

# Linux
xdg-open coverage/lcov-report/index.html
```

---

### npm run test:watch

**What it does:** Runs tests in watch mode (re-runs on file changes)  
**When to use:** During development  
**Benefit:** Instant feedback on changes

**Usage:**
```bash
npm run test:watch
```

**Features:**
- Auto-runs tests when files change
- Shows only changed tests
- Interactive mode
- Fast feedback loop

**Commands in watch mode:**
```
Press a to run all tests
Press f to run only failed tests
Press p to filter by filename
Press t to filter by test name
Press q to quit watch mode
```

---

## Development Commands

### npm run build

**What it does:** Compiles TypeScript to JavaScript  
**When to use:** After changing source code  
**Output:** `dist/` folder with compiled code

**Usage:**
```bash
npm run build
```

**What it does:**
1. Reads `src/**/*.ts` files
2. Compiles to JavaScript
3. Outputs to `dist/` folder
4. Generates type definitions

**When to run:**
- After editing TypeScript files
- Before testing changes
- Before publishing
- After pulling updates

---

### npm run typecheck

**What it does:** Checks TypeScript types without compiling  
**When to use:** Quick type checking during development  
**Benefit:** Faster than full build

**Usage:**
```bash
npm run typecheck
```

**Output (success):**
```
No errors found
```

**Output (errors):**
```
src/verify.ts:123:45 - error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.

Found 1 error.
```

---

### npm run prepublishOnly

**What it does:** Runs checks before publishing to npm  
**When to use:** Automatically runs before `npm publish`  
**Checks:** Build + Tests

**Usage:**
```bash
npm run prepublishOnly
```

**What it does:**
1. Runs `npm run build`
2. Runs `npm test`
3. Fails if either fails

**You don't need to run this manually** - npm runs it automatically before publishing.

---

## API Usage (Programmatic)

### Using Server API

**Start server:**
```bash
npm run serve
```

**Make requests:**
```javascript
// Health check
const health = await fetch('http://localhost:9009/health');
console.log(await health.json());
// { ok: true, service: "llmverify", version: "1.4.0" }

// Verify content
const response = await fetch('http://localhost:9009/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ content: 'AI response text' })
});

const result = await response.json();
console.log(result.result.risk.level);  // "low", "moderate", "high", "critical"
```

**Available endpoints:**
- `GET /health` - Server health check
- `POST /verify` - Verify AI output
- `POST /check-input` - Check input safety
- `POST /check-pii` - Detect PII
- `POST /classify` - Classify output

---

## Common Workflows

### IDE Verification Workflow

```bash
# One-time setup
npm install llmverify
npm run setup-ai  # Optional

# Every session
# Terminal 1
npm run serve:force

# Terminal 2
npm run monitor

# Use your IDE normally
# Copy AI responses to see scores
```

---

### API Integration Workflow

```bash
# Start server
npm run serve

# In your code
const response = await fetch('http://localhost:9009/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ content: aiResponse })
});

const result = await response.json();

if (result.result.risk.level === 'critical') {
  // Block response
} else {
  // Show to user
}
```

---

### Development Workflow

```bash
# Make changes to TypeScript files
# Terminal 1 - Watch tests
npm run test:watch

# Terminal 2 - Check types
npm run typecheck

# When ready
npm run build
npm test

# Commit changes
git add .
git commit -m "feat: Add new feature"
git push
```

---

### Testing Workflow

```bash
# Terminal 1 - Start server
npm run serve

# Terminal 2 - Run tests
npm run test:integration

# Check coverage
npm run test:coverage

# View report
start coverage/lcov-report/index.html
```

---

## Troubleshooting Commands

### Check if server is running

```bash
curl http://localhost:9009/health
```

**Expected:**
```json
{"ok":true,"service":"llmverify","version":"1.4.0"}
```

---

### Check what's on port 9009

**Windows:**
```powershell
netstat -ano | findstr :9009
```

**Linux/Mac:**
```bash
lsof -i :9009
```

---

### Kill process on port 9009

**Windows:**
```powershell
$proc = Get-NetTCPConnection -LocalPort 9009 | Select-Object -ExpandProperty OwningProcess -Unique
Stop-Process -Id $proc -Force
```

**Linux/Mac:**
```bash
lsof -ti:9009 | xargs kill -9
```

**Or just use:**
```bash
npm run serve:force
```

---

### Test verification manually

```bash
curl -X POST http://localhost:9009/verify \
  -H "Content-Type: application/json" \
  -d '{"content":"Test message for verification"}'
```

---

### Check Node.js version

```bash
node --version
# Should be ≥18.0.0
```

---

### Check npm version

```bash
npm --version
```

---

### Reinstall dependencies

```bash
rm -rf node_modules package-lock.json
npm install
```

---

## Environment Variables

### DEBUG

Enable debug logging:

```bash
# Windows
set DEBUG=llmverify:*
npm run serve

# Linux/Mac
DEBUG=llmverify:* npm run serve
```

---

### PORT

Change server port (default: 9009):

```bash
# Windows
set PORT=8080
npm run serve

# Linux/Mac
PORT=8080 npm run serve
```

---

## Command Comparison

| Command | Purpose | Requires Server | Time | Output |
|---------|---------|-----------------|------|--------|
| `npm run serve` | Start server | No | Continuous | Server logs |
| `npm run serve:force` | Force start server | No | Continuous | Server logs |
| `npm run monitor` | Monitor clipboard | Yes | Continuous | Verification scores |
| `npm run setup-ai` | Setup AI prompts | No | 1 second | Prompt files |
| `npm test` | Run all tests | No | 10-20s | Test results |
| `npm run test:integration` | Integration tests | Yes | 8-15s | Test results |
| `npm run test:coverage` | Tests + coverage | No | 15-25s | Coverage report |
| `npm run test:watch` | Watch mode tests | No | Continuous | Test results |
| `npm run build` | Build TypeScript | No | 5-10s | dist/ folder |
| `npm run typecheck` | Check types | No | 2-5s | Type errors |

---

## Quick Reference

**Most used commands:**
```bash
npm run serve:force    # Start server (kills conflicts)
npm run monitor        # Start monitor
npm test               # Run tests
npm run build          # Build code
```

**Troubleshooting:**
```bash
npm run serve:force    # Fix port conflicts
curl http://localhost:9009/health  # Check server
npm run test:integration  # Test everything works
```

**Development:**
```bash
npm run test:watch     # Watch tests
npm run typecheck      # Check types
npm run build          # Build
npm test               # Final check
```

---

## Summary

**For IDE users:**
1. `npm run serve:force` - Start server
2. `npm run monitor` - Start monitor
3. Copy AI responses - See scores

**For developers:**
1. `npm run build` - Build code
2. `npm test` - Run tests
3. `npm run serve` - Test server

**For troubleshooting:**
1. `npm run serve:force` - Fix conflicts
2. See [ERROR-GUIDE.md](ERROR-GUIDE.md) - Fix errors
3. `npm run test:integration` - Verify working

---

**Need help?** See [ERROR-GUIDE.md](ERROR-GUIDE.md) for detailed troubleshooting.
