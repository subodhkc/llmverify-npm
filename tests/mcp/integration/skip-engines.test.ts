/**
 * Regression tests for the engine-identifier mapping defect:
 * the public MCP id 'jsonValidator' must be translated to the engine's
 * internal id 'json' before calling verify() — previously the skip
 * silently did nothing.
 */

import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  connectTestClient,
  structured,
  type ConnectedPair
} from '../helpers/client';

let pair: ConnectedPair;

beforeAll(async () => {
  process.env.LLMVERIFY_HOME = mkdtempSync(
    join(tmpdir(), 'llmverify-mcp-skip-')
  );
  pair = await connectTestClient();
});

afterAll(async () => {
  await pair.close();
  delete process.env.LLMVERIFY_HOME;
});

describe('skipEngines → engine id mapping', () => {
  it('jsonValidator actually skips the JSON engine on valid JSON input', async () => {
    const result = await pair.client.callTool({
      name: 'verify_llm_content',
      arguments: {
        content: '{"a": 1, "b": [2, 3]}',
        isJSON: true,
        skipEngines: ['jsonValidator']
      }
    });
    const sc = structured(result);
    expect(result.isError).toBeFalsy();
    const er = sc.engineResults as Record<string, unknown>;
    expect(er.json).toBeUndefined();
    expect(sc.enginesNotChecked as string[]).toContain('json');
    expect(sc.enginesExecuted as string[]).not.toContain('json');
  });

  it('jsonValidator skips the JSON engine even when input is invalid JSON', async () => {
    const result = await pair.client.callTool({
      name: 'verify_llm_content',
      arguments: {
        content: '{broken json, no closing',
        isJSON: true,
        skipEngines: ['jsonValidator']
      }
    });
    const sc = structured(result);
    expect(result.isError).toBeFalsy();
    const er = sc.engineResults as Record<string, unknown>;
    expect(er.json).toBeUndefined();
    expect(sc.enginesNotChecked as string[]).toContain('json');
  });

  it('control: without the skip, the JSON engine evaluates invalid JSON', async () => {
    const result = await pair.client.callTool({
      name: 'verify_llm_content',
      arguments: {
        content: '{broken json, no closing',
        isJSON: true
      }
    });
    const sc = structured(result);
    expect(result.isError).toBeFalsy();
    expect((sc.engineResults as Record<string, unknown>).json).toBeDefined();
    expect(sc.enginesNotChecked as string[]).not.toContain('json');
  });

  it('maps multiple skips; other engines still run', async () => {
    const result = await pair.client.callTool({
      name: 'verify_llm_content',
      arguments: {
        content: '{"x": true}',
        isJSON: true,
        skipEngines: ['jsonValidator', 'hallucination']
      }
    });
    const sc = structured(result);
    expect(result.isError).toBeFalsy();
    const notChecked = sc.enginesNotChecked as string[];
    expect(notChecked).toContain('json');
    expect(notChecked).toContain('hallucination');
    const er = sc.engineResults as Record<string, unknown>;
    expect(er.json).toBeUndefined();
    expect(er.hallucination).toBeUndefined();
    // consistency and csm6 still ran
    expect(er.csm6).toBeDefined();
  });

  it('reports engine-internal names in notChecked — never the public alias', async () => {
    const result = await pair.client.callTool({
      name: 'verify_llm_content',
      arguments: {
        content: '{"x": 1}',
        isJSON: true,
        skipEngines: ['jsonValidator']
      }
    });
    const sc = structured(result);
    expect(sc.enginesNotChecked as string[]).not.toContain('jsonValidator');
  });

  it('rejects unknown engine identifiers', async () => {
    const result = await pair.client.callTool({
      name: 'verify_llm_content',
      arguments: {
        content: 'hello',
        skipEngines: ['not-an-engine']
      }
    });
    expect(result.isError).toBe(true);
  });
});
