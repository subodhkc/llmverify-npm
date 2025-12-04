# How to Run llmverify in Windsurf IDE

## Step 1: Open Two Terminals

In Windsurf, press `Ctrl+`` (backtick) to open the terminal.
Click the `+` button to open a second terminal tab.

## Step 2: Terminal 1 - Start Server

```powershell
cd "C:\Users\Subodh Kc\Desktop\App Building\Github\llmverify-npm"
npx llmverify-serve
```

Keep this running. You'll see:
```
Server started on http://localhost:9009
```

## Step 3: Terminal 2 - Test It

```powershell
cd "C:\Users\Subodh Kc\Desktop\App Building\Github\llmverify-npm"

# Test verification
$body = '{"content": "This is a test AI response"}' 
Invoke-RestMethod -Uri "http://localhost:9009/verify" -Method POST -ContentType "application/json" -Body $body
```

You'll get a JSON response with risk scores.

## Step 4: Use in Your Code

```javascript
const { createIDEExtension } = require('llmverify');

const verifier = createIDEExtension();
const result = await verifier.verify("AI response here");

console.log(result.verdict);    // [PASS] SAFE TO USE
console.log(result.riskScore);  // 6.3
console.log(result.safe);       // true
```

## Quick Test

Run the example:
```powershell
node examples/basic-usage.js
```

This will show you all the features working.

## Common Issues

### "Server not running"
Make sure Terminal 1 is still running with `npx llmverify-serve`

### "Port in use"
```powershell
npx llmverify-serve --port=8080
```

### "Module not found"
```powershell
npm install
npm run build
```

## That's It!

Now you can verify AI responses in real-time while coding in Windsurf.
