#!/usr/bin/env node

/**
 * llmverify-serve CLI entry point
 * Starts the HTTP server for IDE integration.
 *
 * Note: requiring dist/server.js does NOT start the server (its
 * require.main check only fires when server.js itself is the entry
 * point), so we invoke startServer() explicitly with CLI args.
 */

const args = process.argv.slice(2);
const portArg = args.find(a => a.startsWith('--port='));
const hostArg = args.find(a => a.startsWith('--host='));
const port = portArg ? parseInt(portArg.split('=')[1], 10) : 9009;
const host = hostArg ? hostArg.split('=')[1].trim() : '127.0.0.1';

if (isNaN(port) || port < 1 || port > 65535) {
  console.error('Invalid port number. Must be between 1 and 65535.');
  process.exit(1);
}

if (!['127.0.0.1', 'localhost', '0.0.0.0'].includes(host)) {
  console.error(`Invalid host "${host}". Use 127.0.0.1 (default) or 0.0.0.0 (all interfaces).`);
  process.exit(1);
}

if (host === '0.0.0.0') {
  console.warn(
    '[llmverify] WARNING: binding to 0.0.0.0 exposes the server to your network. ' +
    'Only do this on a trusted network. There is no authentication on the API.'
  );
}

const { startServer } = require('../dist/server.js');
startServer(port, host === 'localhost' ? '127.0.0.1' : host);
