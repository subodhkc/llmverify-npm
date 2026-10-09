/**
 * Tool: get_llmverify_capabilities — truthful capability discovery.
 *
 * Everything returned comes from the installed engine's own metadata
 * (getEngineCapabilities / getPackageInfo) plus adapter identity and
 * local-state locations. Nothing is hardcoded here that the engine
 * does not itself claim.
 */

import * as z from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { engineIdentitySchema } from '../schemas/common';
import { describeCapabilities } from '../adapters/llmverify';
import { ADAPTER_CONTRACT_VERSION, ADAPTER_NAME, adapterVersion } from '../contracts/version';
import { okResult, errorResult } from '../contracts/results';
import { LIMITS } from '../security/limits';
import { getMaxOutputBytes } from '../security/size';
import { verifyLane } from '../security/lane';

const inputSchema = z.object({
  includeLocalPaths: z
    .boolean()
    .optional()
    .describe(
      'Disclose absolute host paths for engine state directories. ' +
        'Default false — clients get env-var names and field slots, ' +
        'not the operator’s filesystem layout.'
    )
});

const outputSchema = z.looseObject({
  adapter: z.object({
    name: z.string(),
    version: z.string(),
    contractVersion: z.string()
  }),
  engine: engineIdentitySchema,
  resultSchemaVersion: z.string(),
  capabilities: z.array(z.looseObject({})),
  package: z.looseObject({}),
  limits: z.looseObject({}),
  localState: z.looseObject({}),
  resultSchemaFile: z.string().nullable()
});

export function registerCapabilitiesTool(server: McpServer): void {
  server.registerTool(
    'get_llmverify_capabilities',
    {
      title: 'Get LLMVerify Capabilities',
      description:
        'Report the installed llmverify engine version, supported ' +
        'engines, truthful capability metadata (what each engine ' +
        'observes vs. does NOT establish), result schema version, ' +
        'adapter limits, and local state locations. Use this to ' +
        'discover what verification actually means here before ' +
        'interpreting tool results.',
      inputSchema,
      outputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async ({ includeLocalPaths }) => {
      try {
        const caps = describeCapabilities(includeLocalPaths === true);
        return okResult(
          {
            adapter: {
              name: ADAPTER_NAME,
              version: adapterVersion(),
              contractVersion: ADAPTER_CONTRACT_VERSION
            },
            engine: {
              name: 'llmverify',
              version: caps.engineVersion
            },
            resultSchemaVersion: caps.resultSchemaVersion,
            capabilities: caps.capabilities,
            package: caps.package,
            limits: {
              maxInputChars: LIMITS.maxInputChars,
              toolTimeoutMs: LIMITS.toolTimeoutMs,
              maxOutputItems: LIMITS.maxOutputItems,
              maxTextFieldChars: LIMITS.maxTextFieldChars,
              maxOutputBytes: getMaxOutputBytes(),
              maxQueueDepth: verifyLane.capacity,
              executionModel:
                'verify calls serialize through an in-process lane; ' +
                'timeouts return MCP_ADAPTER_TIMEOUT but do NOT cancel ' +
                'engine work — the lane stays occupied until it settles'
            },
            localState: caps.localState,
            resultSchemaFile: caps.resultSchemaFile
          } as Record<string, unknown>,
          `llmverify ${caps.engineVersion} — ${(caps.capabilities as unknown[]).length} capabilities reported. ` +
            'Heuristic engines: risk signals, not proof. Local-only by default.'
        );
      } catch (err) {
        return errorResult(err);
      }
    }
  );
}
