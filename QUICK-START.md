# Quick Start: AI Response Verification in Windsurf

## Setup (One-Time)

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

```powershell
# Kill existing server
$proc = Get-NetTCPConnection -LocalPort 9009 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
if ($proc) { Stop-Process -Id $proc -Force }

# Restart
npm run serve
```

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

## That's It!

You're now automatically verifying all AI responses. Every time you copy an AI message, you'll see its safety score instantly.
