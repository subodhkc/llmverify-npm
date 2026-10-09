/**
 * Shared test client: wires a real MCP Client to a real McpServer over
 * the SDK's linked in-memory transports. This exercises the actual
 * protocol path (negotiation, tool listing, schema validation,
 * structuredContent) without spawning a process — process-level stdio
 * coverage lives in tests/e2e.
 */

import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/client';
import { createLlmverifyMcpServer } from '../../../src/mcp/server';

export interface ConnectedPair {
  client: Client;
  close: () => Promise<void>;
}

export async function connectTestClient(): Promise<ConnectedPair> {
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();

  const server = createLlmverifyMcpServer();
  const client = new Client({
    name: 'llmverify-mcp-test-client',
    version: '0.0.0-test'
  });

  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport)
  ]);

  return {
    client,
    close: async () => {
      await Promise.allSettled([client.close(), server.close()]);
    }
  };
}

export function structured(result: unknown): Record<string, unknown> {
  const r = result as { structuredContent?: Record<string, unknown> };
  if (!r.structuredContent || typeof r.structuredContent !== 'object') {
    throw new Error('result has no structuredContent');
  }
  return r.structuredContent;
}
