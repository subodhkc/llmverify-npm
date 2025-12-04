#!/usr/bin/env node

/**
 * Force start server by killing any existing process on port 9009
 */

const { exec } = require('child_process');
const { spawn } = require('child_process');

const PORT = 9009;

console.log('Checking for existing server on port', PORT, '...');

// Kill command based on platform
const killCmd = process.platform === 'win32'
  ? `powershell -Command "$proc = Get-NetTCPConnection -LocalPort ${PORT} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; if ($proc -and $proc -ne 0) { Stop-Process -Id $proc -Force; Write-Host 'Killed process on port ${PORT}' } else { Write-Host 'No process found on port ${PORT}' }"`
  : `lsof -ti:${PORT} | xargs kill -9 2>/dev/null && echo "Killed process on port ${PORT}" || echo "No process found on port ${PORT}"`;

exec(killCmd, (error, stdout, stderr) => {
  if (stdout) console.log(stdout.trim());
  if (stderr && !stderr.includes('Access is denied')) console.error(stderr.trim());
  
  // Wait a moment for port to be released
  setTimeout(() => {
    console.log('\nStarting server...\n');
    
    // Start the server
    const serverProcess = spawn('node', ['start-server.js'], {
      stdio: 'inherit',
      cwd: __dirname
    });

    serverProcess.on('error', (err) => {
      console.error('Failed to start server:', err.message);
      process.exit(1);
    });

    // Handle Ctrl+C
    process.on('SIGINT', () => {
      console.log('\nStopping server...');
      serverProcess.kill();
      process.exit(0);
    });
  }, 1000);
});
