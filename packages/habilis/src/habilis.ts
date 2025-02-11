import { type IMessageLifecycle } from './types.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from './SSEClientTransport.js';
import type { TextContent } from '@modelcontextprotocol/sdk/types.js';
import type { Keypair } from '@solana/web3.js';
import { createPrompt, generateText } from './llm.js';
import { nanoid } from 'nanoid';
import type { IHabilis, ToolWithServer } from './types.js';
import type { Ability, SimplePersona } from './persona.js';

const generationModelSettings = {
  provider: 'openai' as const,
  endpoint: 'https://api.openai.com/v1',
  name: 'gpt-4o',
};

export class Habilis implements IHabilis {
  memoryServerUrl: string;
  persona: SimplePersona | undefined;
  keypair: Keypair | undefined;

  modelApiKeys: {
    generationKey: string | undefined;
  } = {
    generationKey: undefined,
  };

  mcpClients: {
    [url: string]: Client;
  } = {};

  tools: ToolWithServer[] = [];

  constructor(memoryServerUrl: string) {
    this.memoryServerUrl = memoryServerUrl;
  }

  static async create(
    memoryServer: string,
    opts: {
      persona: SimplePersona;
      abilities: Ability[];
      privateKey: Keypair;
      modelApiKeys: {
        generationKey: string;
        embeddingKey?: string;
      };
    }
  ) {
    const habilis = new Habilis(memoryServer);
    await habilis.init(opts);
    return habilis;
  }

  async init(opts: {
    persona: SimplePersona;
    abilities: Ability[];
    privateKey: Keypair;
    modelApiKeys: {
      generationKey: string;
      embeddingKey?: string;
    };
  }) {
    this.modelApiKeys = {
      generationKey: opts.modelApiKeys.generationKey,
    };

    this.keypair = opts.privateKey;

    await this.addMCPServer({ url: this.memoryServerUrl, ignoreTools: true });

    this.persona = opts.persona;

    // Group abilities by server URL
    const serverAbilities = opts.abilities.reduce((acc, ability) => {
      if (!acc[ability.abilityServer]) {
        acc[ability.abilityServer] = [];
      }
      acc[ability.abilityServer].push(ability.name);
      return acc;
    }, {} as Record<string, string[]>);

    // Add each server with its associated ability tool names
    for (const [serverUrl, toolNames] of Object.entries(serverAbilities)) {
      await this.addMCPServer({ url: serverUrl, toolNames });
    }
  }

  async addMCPServer(opts: {
    url: string;
    toolNames?: string[];
    ignoreTools?: boolean;
  }) {
    const client = new Client(
      {
        name: opts.url,
        version: '1.0.0',
      },
      { capabilities: {} }
    );

    await client.connect(new SSEClientTransport(new URL(opts.url)));

    const { tools } = await client.listTools();

    const filteredTools = opts.toolNames?.length
      ? tools.filter((tool) => opts.toolNames?.includes(tool.name))
      : tools;

    if (!opts.ignoreTools) {
      this.tools.push(
        ...filteredTools.map((tool) => ({
          ...tool,
          serverUrl: opts.url,
        }))
      );
    }

    this.mcpClients[opts.url] = client;
  }

  private async callTool(
    toolName: string,
    toolURL: string,
    args: any
  ): Promise<any> {
    const client = this.mcpClients[toolURL];

    const result = (
      await client.callTool({
        name: toolName,
        arguments: args,
      })
    ).content as TextContent[];

    if (result[0].text.includes('Error')) {
      return `The tool has failed with the following error: ${result[0].text}`;
    } else {
      try {
        return JSON.parse(result[0].text);
      } catch {
        return result[0].text;
      }
    }
  }

  async message(
    message: string,
    opts?: {
      channelId?: string;
      callback?: (lifecycle: IMessageLifecycle) => void;
    }
  ): Promise<IMessageLifecycle> {
    if (!this.keypair) {
      throw new Error('Keypair not found');
    }

    if (!this.persona) {
      throw new Error('Persona not found');
    }

    if (!this.modelApiKeys.generationKey) {
      throw new Error('Model API key not found');
    }

    let lifecycle: IMessageLifecycle = {
      habilisPubkey: this.keypair.publicKey.toBase58(),
      habilisName: this.persona.name,
      messageId: nanoid(),
      message: message,
      createdAt: new Date().toISOString(),
      approval: '',
      channelId: opts?.channelId ?? null,
      identityPrompt: this.persona.bio.join('\n'),
      context: [],
      tools: [],
      generatedPrompt: '',
      output: '',
      actionsLog: [],
    };

    const contextResults = await this.callTool(
      'ctx_getContext',
      this.memoryServerUrl,
      {
        lifecycle,
      }
    );

    lifecycle.context = contextResults.context;

    // Generate Text
    let continuePrompting = true;
    let openaiResponse;

    while (continuePrompting) {
      lifecycle.generatedPrompt = createPrompt(lifecycle);

      openaiResponse = await generateText(
        generationModelSettings,
        this.modelApiKeys.generationKey,
        lifecycle.generatedPrompt,
        this.tools
      );

      console.log('OpenAI Response:', openaiResponse);

      if (openaiResponse?.choices[0].message.tool_calls) {
        const toolCall = openaiResponse.choices[0].message.tool_calls[0];
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);
        const tool = this.tools.find((t) => t.name === toolName);
        if (!tool) {
          continuePrompting = false;
          lifecycle.output = `Tool ${toolName} not found`;
          break;
        }

        lifecycle.output =
          openaiResponse.choices[0].message.content ??
          `Using ability - ${toolName}`;
        opts?.callback?.(lifecycle);

        const toolResult = await this.callTool(
          tool.name,
          tool.serverUrl,
          toolArgs
        );

        lifecycle.tools.push(
          `Tool ${toolName} called with arguments: ${JSON.stringify(
            toolArgs
          )} and returned: ${JSON.stringify(toolResult)}`
        );
      } else {
        continuePrompting = false;
        lifecycle.output = openaiResponse?.choices[0].message.content ?? '';
      }

      await this.callTool('pp_createKnowledge', this.memoryServerUrl, {
        lifecycle,
      });
    }

    return lifecycle;
  }
}
