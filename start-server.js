#!/usr/bin/env node

/**
 * Simple server starter with explicit output
 */

console.log('Starting llmverify server...');
console.log('Loading server module...');

try {
  const { startServer } = require('./dist/server.js');
  
  console.log('Server module loaded successfully');
  console.log('Starting server on port 9009...');
  
  startServer(9009);
} catch (error) {
  console.error('Failed to start server:', error.message);
  console.error(error.stack);
  process.exit(1);
}
