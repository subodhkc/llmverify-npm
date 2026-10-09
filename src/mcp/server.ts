/**
 * MCP server factory.
 *
 * Creates an McpServer with all llmverify tools registered. The server
 * knows nothing about transports — callers connect stdio (or test
 * transports) themselves.
 */

import { McpServer } from '@modelcontextprotocol/server';
import { ADAPTER_NAME, adapterVersion } from './contracts/version';
import { registerVerifyTool } from './tools/verify';
import { registerHallucinationTool } from './tools/hallucination';
import { registerInjectionTool } from './tools/injection';
import { registerPiiTool } from './tools/pii';
import { registerRedactTool } from './tools/redact';
import { registerCapabilitiesTool } from './tools/capabilities';

export function createLlmverifyMcpServer(): McpServer {
  const server = new McpServer({
    name: ADAPTER_NAME,
    version: adapterVersion()
  });

  registerVerifyTool(server);
  registerHallucinationTool(server);
  registerInjectionTool(server);
  registerPiiTool(server);
  registerRedactTool(server);
  registerCapabilitiesTool(server);

  return server;
}

export { McpServer };
