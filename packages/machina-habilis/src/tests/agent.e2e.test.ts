import { describe, it, expect, afterAll } from 'bun:test';
import {
  OldowanServer,
  OldowanTool,
  type OldowanToolDefinition,
} from '@elite-agents/oldowan';
import { z } from 'zod';
import { MachinaAgent } from '../machina';
import { generateKeyPair } from '@solana/kit';

// Disable console.debug for tests
console.debug = (message) => {};

const toolSchema = {
  message: z.string(),
};

const paymentDetails = {
  type: 'token-gated' as const,
  mint: 'TEST',
  amountUi: 1,
  description: 'Test',
};

const echoToolPaid = new OldowanTool<typeof toolSchema>({
  name: 'echo-paid',
  description: 'Echoes input',
  schema: toolSchema,
  execute: async (input) => ({ echoed: input }),
  paymentDetails,
});

const echoToolFree = new OldowanTool<typeof toolSchema>({
  name: 'echo-free',
  description: 'Echoes input',
  schema: toolSchema,
  execute: async (input) => ({ echoed: input }),
});

describe('OldowanServer authentication and tool calls', async () => {
  const oldowanServer = new OldowanServer('test', '1.0.0', {
    tools: [echoToolPaid, echoToolFree],
  });

  const result = await oldowanServer.honoServer.request('/mcp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 129,
      method: 'tools/list',
      params: {},
    }),
  });

  const {
    result: { tools },
  } = await result.json();

  const server = Bun.serve({
    fetch: oldowanServer.honoServer.fetch,
    port: 8080,
  });

  const abilities = tools.map((tool: OldowanToolDefinition) => ({
    ...tool,
    serverUrl: `${server.url.origin}/mcp`,
    paymentDetails,
  }));

  const machinaAgent = new MachinaAgent({
    persona: {
      name: 'test',
      bio: ['test bio'],
    },
    keypair: await generateKeyPair(),
    llm: {
      name: 'gpt-4o-mini',
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY!,
      endpoint: 'https://api.openai.com/v1',
    },
    abilities,
  });

  afterAll(() => {
    server.stop();
  });

  it('should call paid tool successfully with valid auth', async () => {
    const result = await machinaAgent.callTool('echo-paid', {
      message: 'test',
    });

    expect(result).toEqual({ echoed: { message: 'test' } });
  });

  it('should call free tool successfully without auth', async () => {
    const result = await machinaAgent.callTool('echo-free', {
      message: 'test',
    });

    expect(result).toEqual({ echoed: { message: 'test' } });
  });

  it('should properly handle function calls when prompting llm', async () => {
    const payload = await machinaAgent.message(`Send "hello" to the paid tool`);

    expect(payload.tools).toHaveLength(1);
    expect(payload.tools[0]).toHaveLength(2);
    expect(payload.tools[0][0]).toHaveProperty('type', 'function_call');
    expect(payload.tools[0][1]).toHaveProperty('type', 'function_call_output');
    expect(payload.tools[0][0]).toHaveProperty('name', 'echo-paid');
    expect(payload.tools[0][0].call_id).toBe(payload.tools[0][1].call_id);
  });
});
