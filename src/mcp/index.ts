#!/usr/bin/env node
/**
 * llmverify-mcp — executable entrypoint.
 *
 * Serves MCP over stdio. stdout is RESERVED for protocol frames:
 * every diagnostic goes to stderr. The console re-routing happens
 * inside serveMcp() so importing this module is side-effect free.
 */

import { serveMcp } from './serve';
import { ADAPTER_NAME } from './contracts/version';

serveMcp().catch((error: unknown) => {
  console.error(
    `[${ADAPTER_NAME}] fatal startup error: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exitCode = 1;
});
