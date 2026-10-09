/**
 * Tool contract tests: registration, schemas, output shapes, and
 * invalid-input rejection — all through the real MCP protocol.
 */

import {
  connectTestClient,
  structured,
  type ConnectedPair
} from '../helpers/client';
import { VERSION as ENGINE_VERSION } from '../../../src/index';

let pair: ConnectedPair;

beforeAll(async () => {
  pair = await connectTestClient();
});

afterAll(async () => {
  await pair.close();
});

describe('tool registration', () => {
  it('registers exactly the expected tool set', async () => {
    const { tools } = await pair.client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual(
      [
        'assess_hallucination_risk',
        'check_pii',
        'check_prompt_injection',
        'get_llmverify_capabilities',
        'redact_pii',
        'verify_llm_content'
      ].sort()
    );
  });

  it('every tool has a description and JSON input schema', async () => {
    const { tools } = await pair.client.listTools();
    for (const tool of tools) {
      expect(tool.description?.length).toBeGreaterThan(20);
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.annotations?.openWorldHint).toBe(false);
    }
  });
});

describe('verify_llm_content contract', () => {
  it('rejects missing content', async () => {
    const result = await pair.client.callTool({
      name: 'verify_llm_content',
      arguments: {}
    });
    expect(result.isError).toBe(true);
  });

  it('rejects unknown skipEngines values', async () => {
    const result = await pair.client.callTool({
      name: 'verify_llm_content',
      arguments: {
        content: 'hello',
        skipEngines: ['not_an_engine']
      }
    });
    expect(result.isError).toBe(true);
  });

  it('returns contract-shaped structuredContent', async () => {
    const result = await pair.client.callTool({
      name: 'verify_llm_content',
      arguments: { content: 'Paris is the capital of France.' }
    });
    expect(result.isError).toBeFalsy();
    const sc = structured(result);
    expect(sc.resultSchemaVersion).toBe('1.0');
    expect((sc.engine as { name: string }).name).toBe('llmverify');
    expect((sc.adapter as { contractVersion: string }).contractVersion).toBe(
      '1.1'
    );
    const risk = sc.risk as { level: string; action: string };
    expect(['low', 'moderate', 'high', 'critical']).toContain(risk.level);
    expect(['allow', 'review', 'block']).toContain(risk.action);
    expect(Array.isArray(sc.enginesNotChecked)).toBe(true);
    expect(Array.isArray(sc.limitations)).toBe(true);
    expect(
      ['PERSISTED', 'DISABLED', 'FAILED', 'NOT_ATTEMPTED']
    ).toContain((sc.audit as { status: string }).status);
  });
});

describe('get_llmverify_capabilities contract', () => {
  it('reports engine identity, schema version, and capabilities', async () => {
    const result = await pair.client.callTool({
      name: 'get_llmverify_capabilities',
      arguments: {}
    });
    const sc = structured(result);
    expect(sc.resultSchemaVersion).toBe('1.0');
    expect((sc.engine as { version: string }).version).toBe(ENGINE_VERSION);
    const caps = sc.capabilities as Array<{
      observes?: string;
      doesNotEstablish?: string;
    }>;
    expect(caps.length).toBeGreaterThan(3);
    for (const cap of caps) {
      expect(typeof cap.observes).toBe('string');
      expect(typeof cap.doesNotEstablish).toBe('string');
      expect(cap.doesNotEstablish!.length).toBeGreaterThan(0);
    }
  });
});
