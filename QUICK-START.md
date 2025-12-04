# Quick Start: AI Response Verification in Windsurf

## Two Ways to Use llmverify

### Option 1: Monitor Mode (Easiest for IDE)
- Automatically verifies AI responses as you copy them
- Shows scores in terminal
- No code changes needed
- **Best for:** Windsurf, VS Code, any IDE

### Option 2: API Mode (For Your Code)
- Integrate verification into your application
- Programmatic access to risk scores
- Full control over verification
- **Best for:** Production apps, custom workflows

---

## Option 1: Monitor Mode Setup (One-Time)

### Step 1: Open Two Terminals in Windsurf

Press `Ctrl+`` (backtick) to open terminal, then click `+` to open a second terminal tab.

### Step 2: Terminal 1 - Start Server

```powershell
npm run serve
```

**Expected output:**
```
╔══════════════════════════════════════════════════════════════════════════════╗
║  llmverify server v1.0.0                                                    ║
║  Running on http://localhost:9009                                           ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

**Keep this terminal running!**

### Step 3: Terminal 2 - Start Monitor

**Option 1: Using npm (recommended):**
```powershell
npm run monitor
# Automatically starts the chat monitor
```

**Option 2: Direct script:**
```powershell
.\monitor-chat.ps1
# Same result, just different way to run it
```

**Expected output:**
```
╔══════════════════════════════════════════════════════════════════════════════╗
║  llmverify Chat Monitor - Automatic AI Response Verification                ║
╚══════════════════════════════════════════════════════════════════════════════╝

[OK] Server is running (v1.0.0)

╔══════════════════════════════════════════════════════════════════════════════╗
║  READY - Copy AI responses to see verification scores                       ║
╚══════════════════════════════════════════════════════════════════════════════╝

Instructions:
  1. Select AI response in chat
  2. Copy it (Ctrl+C)
  3. Verification score appears below automatically

Waiting for AI responses...
```

**Keep this terminal visible!**

---

## Daily Use

### Get Verification Scores

1. **Chat with AI** - Ask me anything in Windsurf chat
2. **Select my response** - Highlight the AI response text
3. **Copy it** - Press `Ctrl+C`
4. **See score** - Terminal 2 shows verification automatically

**Example:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[VERIFYING] Checking AI response...

╔══════════════════════════════════════════════════════════════════════════════╗
║  VERIFICATION RESULT                                                         ║
╚══════════════════════════════════════════════════════════════════════════════╝

  Verdict:      [PASS] SAFE TO USE
  Risk Level:   LOW
  Risk Score:   6.3%
  Explanation:  Content passed all safety checks

  Timestamp:    2024-12-04 10:05:23
```

---

## What the Colors Mean

- **Green** = LOW risk (0-25%) - Safe to use
- **Yellow** = MODERATE risk (26-50%) - Review recommended
- **Red** = HIGH/CRITICAL risk (51-100%) - Do not use

---

## Troubleshooting

### "Server not running" error

**Terminal 1:**
```powershell
npm run serve
```

### Monitor not working

**Terminal 2:**
```powershell
.\monitor-chat.ps1
```

### No scores appearing

1. Make sure you **copied** the AI response (Ctrl+C)
2. Check Terminal 2 is showing "Waiting for AI responses..."
3. Response must be at least 50 characters

### Port already in use

**Quick fix:**
```powershell
# Kill existing server and restart
$proc = Get-NetTCPConnection -LocalPort 9009 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
if ($proc) { Stop-Process -Id $proc -Force }
npm run serve
```

**Or use the helper script:**
```bash
npm run serve:force
```
This automatically kills any process on port 9009 and starts the server.

---

## Commands Reference

| Terminal | Command | Purpose |
|----------|---------|---------|
| Terminal 1 | `npm run serve` | Start verification server |
| Terminal 2 | `.\monitor-chat.ps1` | Start chat monitor |
| Any | `Ctrl+C` | Stop current process |

---

## Tips

1. **Keep both terminals open** while using Windsurf
2. **Terminal 2 must be visible** to see scores
3. **Copy entire AI responses** for best results
4. **Green = good, Red = bad** - simple as that

---

---

## Option 2: API Mode (In Your Code)

### Installation

```bash
npm install llmverify
```

### Basic Usage

```javascript
const { verify } = require('llmverify');

// Verify AI response
const result = await verify('AI response text here');

console.log(result.result.risk.overall);  // 0.172 (17.2%)
console.log(result.result.risk.level);    // "low"
console.log(result.summary.verdict);      // "[PASS] SAFE TO USE"
```

### In Express API

```javascript
const express = require('express');
const { verify } = require('llmverify');

app.post('/chat', async (req, res) => {
  const aiResponse = await callOpenAI(req.body.message);
  
  // Verify before sending to user
  const verification = await verify(aiResponse);
  
  if (verification.result.risk.level === 'critical') {
    return res.status(400).json({ 
      error: 'Response failed safety check' 
    });
  }
  
  res.json({ 
    response: aiResponse,
    riskScore: verification.result.risk.overall 
  });
});
```

### With OpenAI

```javascript
const OpenAI = require('openai');
const { verify } = require('llmverify');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function safeChat(userMessage) {
  // Get AI response
  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: userMessage }]
  });
  
  const aiResponse = completion.choices[0].message.content;
  
  // Verify it
  const verification = await verify(aiResponse);
  
  return {
    response: aiResponse,
    risk: verification.result.risk,
    safe: verification.result.risk.level !== 'critical'
  };
}
```

---

## Understanding Risk Scores

### Risk Levels

| Level | Range | Color | Action |
|-------|-------|-------|--------|
| **LOW** | 0-25% | Green | Safe to use |
| **MODERATE** | 26-50% | Yellow | Review recommended |
| **HIGH** | 51-75% | Red | Fix before using |
| **CRITICAL** | 76-100% | Red | Do not use |

### What Each Level Means

**LOW (0-25%)** - Safe to use
- No significant issues detected
- Factual claims appear consistent
- No security vulnerabilities
- Example: Simple factual responses, basic code

**MODERATE (26-50%)** - Review recommended
- Minor inconsistencies detected
- Some unverified claims
- Potential security considerations
- Example: Complex explanations, code with edge cases

**HIGH (51-75%)** - Fix before using
- Multiple inconsistencies found
- Likely hallucinations present
- Security vulnerabilities detected
- Example: Contradictory statements, dangerous commands

**CRITICAL (76-100%)** - Do not use
- Severe hallucinations detected
- Major security vulnerabilities
- Contains PII or confidential info
- Example: Medical advice, fabricated sources

### How to Lower Risk Scores

1. **Be specific** - Ask clear, focused questions
2. **Request sources** - "Please cite sources"
3. **Break down complex questions** - One topic at a time
4. **Specify context** - "For production" or "For learning"
5. **Ask for verification** - "Identify any uncertainties"

**Example:**
```
Instead of: "Tell me about Python"
Try: "What are Python list comprehensions with examples?"
```

See [RISK-LEVELS.md](docs/RISK-LEVELS.md) for detailed explanations.

---

## That's It!

**Monitor Mode:** Copy AI responses to see scores instantly  
**API Mode:** Integrate verification into your code

Both modes use the same verification engine and risk scoring system.
