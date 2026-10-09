/**
 * MCP stdio server bootstrap.
 *
 * Serves MCP over stdio. stdout is RESERVED for protocol frames:
 * every diagnostic goes to stderr. To defend the transport against
 * accidental prints (by this adapter or its dependencies), console.log
 * and console.info are re-routed to stderr before the server connects.
 *
 * This module is invoked lazily (CLI `mcp` subcommand or the
 * `llmverify-mcp` bin) so that the optional MCP SDK dependencies are
 * only required when the MCP surface is actually used.
 */

import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { createLlmverifyMcpServer } from './server';
import { ADAPTER_NAME, adapterVersion } from './contracts/version';

function diag(message: string): void {
  console.error(`[${ADAPTER_NAME}] ${message}`);
}

export async function serveMcp(): Promise<void> {
  // Guard the protocol channel: nothing but MCP frames may reach stdout.
  const stderr = console.error.bind(console);
  console.log = stderr;
  console.info = stderr;
  console.debug = stderr;

  const server = createLlmverifyMcpServer();
  const transport = new StdioServerTransport();

  transport.onerror = (error: Error) => {
    diag(`transport error: ${error.message}`);
  };

  await server.connect(transport);
  diag(`v${adapterVersion()} serving MCP over stdio (local-only)`);
}
