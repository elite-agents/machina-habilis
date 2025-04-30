import { describe, it, expect, afterAll } from 'bun:test';
import {
  generateKeypairRawBytes,
  OldowanServer,
  OldowanTool,
} from '@elite-agents/oldowan';
import { z } from 'zod';
import { MachinaAgent } from '../machina';
import { HabilisServer } from '../habilis';

// Disable console.debug for tests
console.debug = (message) => {};

const toolSchema = {
  message: z.string(),
};

const paymentDetails = {
  type: 'token-gated' as const,
  chain: 'solana' as const,
  tokenAddress: 'TEST',
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

describe('Agents End-to-End Tests', async () => {
  const oldowanServer = new OldowanServer('test', '1.0.0', {
    tools: [echoToolPaid, echoToolFree],
  });

  const server = Bun.serve({
    fetch: oldowanServer.honoServer.fetch,
    port: 8080,
  });

  const { serverInfo, toolsAdded } = await HabilisServer.addMCPServer(
    `${server.url.origin}/mcp`,
  );

  console.log('toolsAdded', toolsAdded);

  const abilities = toolsAdded.map((tool) => ({
    id: tool.id,
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    serverUrl: serverInfo.url,
    paymentDetails: tool.paymentDetails,
  }));

  const keypair = await generateKeypairRawBytes();
  const keypairBase64 = Buffer.from(keypair).toString('base64');

  const machinaAgent = new MachinaAgent({
    persona: {
      name: 'test',
      bio: ['test bio'],
    },
    keypairBase64,
    llm: {
      name: 'gpt-4o-mini',
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY!,
      endpoint: 'https://api.openai.com/v1',
    },
    abilities,
  });

  const paidAndFreeAbilityIdMap = new Map<string, string>();

  abilities.forEach((ability) => {
    if (ability.paymentDetails) {
      paidAndFreeAbilityIdMap.set('PAID', ability.id);
    } else {
      paidAndFreeAbilityIdMap.set('FREE', ability.id);
    }
  });

  afterAll(() => {
    server.stop();
  });

  it('should call paid tool successfully with valid auth', async () => {
    const result = await machinaAgent.callTool(
      paidAndFreeAbilityIdMap.get('PAID')!,
      {
        message: 'test',
      },
    );

    expect(result).toEqual({ echoed: { message: 'test' } });
  });

  it('should call free tool successfully without auth', async () => {
    const result = await machinaAgent.callTool(
      paidAndFreeAbilityIdMap.get('FREE')!,
      {
        message: 'test',
      },
    );

    expect(result).toEqual({ echoed: { message: 'test' } });
  });

  it('should properly handle function calls when prompting llm', async () => {
    const payload = await machinaAgent.message(`Send "hello" to the paid tool`);

    expect(payload.tools).toHaveLength(1);
    expect(payload.tools[0]).toHaveLength(2);
    expect(payload.tools[0][0]).toHaveProperty('type', 'function_call');
    expect(payload.tools[0][1]).toHaveProperty('type', 'function_call_output');
    expect(payload.tools[0][1].output).not.toContain('error');
    expect(payload.tools[0][0]).toHaveProperty(
      'name',
      paidAndFreeAbilityIdMap.get('PAID')!,
    );
    expect(payload.tools[0][0].call_id).toBe(payload.tools[0][1].call_id);
  }, 60000); // longer timeout for llm response

  it('should fail if trying to create an OldowanTool with auth in the schema', async () => {
    const badSchema = {
      message: z.string(),
      auth: z.string(),
    };
    expect(() => {
      new OldowanTool<typeof badSchema>({
        name: 'echo-paid',
        description: 'Echoes input',
        schema: badSchema,
        execute: async (input) => ({ echoed: input }),
        paymentDetails,
      });
    }).toThrowError(/'auth' is reserved/);
  });

  it('should be able to call a tool with an optional parameter', async () => {
    const mintNftTool = new OldowanTool({
      name: 'mint_nft',
      description: `Create an unsigned transaction to mint an NFT as a Solana BLINK.`,
      schema: {
        collectionMint: z
          .string()
          .optional()
          .describe('Collection mint address (optional, can be null)'),
        ownerPublicKey: z.string().describe('Owner wallet address'),
        name: z.string().describe('NFT name'),
        uri: z.string().describe('NFT metadata URI'),
      },
      async execute({ collectionMint, ownerPublicKey, name, uri }) {
        return { collectionMint, ownerPublicKey, name, uri };
      },
    });

    const oldowanServer = new OldowanServer('test', '1.0.0', {
      tools: [mintNftTool],
    });

    const newServer = Bun.serve({
      fetch: oldowanServer.honoServer.fetch,
      port: 8081,
    });

    const { serverInfo, toolsAdded } = await HabilisServer.addMCPServer(
      `${newServer.url.origin}/mcp`,
    );

    const newAbilities = toolsAdded.map((tool) => ({
      id: tool.id,
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      serverUrl: serverInfo.url,
      paymentDetails: tool.paymentDetails,
    }));

    const newMachinaAgent = new MachinaAgent({
      persona: {
        name: 'test',
        bio: ['test bio'],
      },
      keypairBase64,
      llm: {
        name: 'gpt-4o-mini',
        provider: 'openai',
        apiKey: process.env.OPENAI_API_KEY!,
        endpoint: 'https://api.openai.com/v1',
      },
      abilities: newAbilities,
    });

    const additionalContext = new Map<string, string>();
    additionalContext.set('User Solana Wallet', 'TEST WALLET');

    const payload = await newMachinaAgent.message(
      `Mint an NFT named "Test NFT" with URI "https://example.com/nft.json"`,
      { additionalContext },
    );

    expect(payload.tools).toHaveLength(1);
    expect(payload.tools[0]).toHaveLength(2);
    expect(payload.tools[0][0]).toHaveProperty('type', 'function_call');
    expect(payload.tools[0][1]).toHaveProperty('type', 'function_call_output');
    expect(payload.tools[0][1].output).not.toContain('error');
    expect(payload.tools[0][0]).toHaveProperty('name', newAbilities[0].id);
    expect(payload.tools[0][0].call_id).toBe(payload.tools[0][1].call_id);
  }, 30000);

  it('should throw an error if keypair is invalid', async () => {
    expect(() => {
      new MachinaAgent({
        persona: {
          name: 'test',
          bio: ['test bio'],
        },
        keypairBase64: 'invalid-keypair',
        llm: {
          name: 'gpt-4o-mini',
          provider: 'openai',
          apiKey: process.env.OPENAI_API_KEY!,
          endpoint: 'https://api.openai.com/v1',
        },
        abilities: [],
      });
    }).toThrowError(/Keypair must be exactly 64 bytes long/);
  });
});
