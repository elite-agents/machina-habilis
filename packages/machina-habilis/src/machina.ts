import { type IMessageLifecycle } from './types';
import type { Keypair } from '@solana/web3.js';
import { invokeLLM } from './llm';
import { nanoid } from 'nanoid';
import type { MemoryService, MemoryFunction, ModelSettings } from './types';
import type { OldowanToolDefinition } from '@elite-agents/oldowan';
import type { SimplePersona } from './persona';
import { HabilisServer } from './habilis';

export type IMachinaAgentOpts = {
  persona: SimplePersona;
  llm: ModelSettings;
  keypair: Keypair;
  abilities?: OldowanToolDefinition[];
  habilisServer?: HabilisServer;
  memoryService?: MemoryService;
};

/**
 * A Machina agent that can call tools.
 *
 * @example
 * ```typescript
 * const agent = new MachinaAgent({
 *   persona: {
 *     name: 'John Doe',
 *     bio: ['John Doe is a helpful assistant.'],
 *   },
 *   abilities: [],
 *   llm: {
 *     model: 'gpt-3.5-turbo',
 *     provider: 'openai',
 *   },
 *   keypair: {
 *     publicKey: '0x1234567890',
 *     privateKey: '0x1234567890',
 *   },
 * });
 * ```
 */
export class MachinaAgent {
  habilisServer?: HabilisServer;

  persona: SimplePersona;
  llm: ModelSettings;
  keypair: Keypair;
  abilities: OldowanToolDefinition[];

  abilityMap: Map<string, OldowanToolDefinition>;

  memoryService?: MemoryService;

  constructor(opts: IMachinaAgentOpts) {
    this.habilisServer = opts.habilisServer;
    this.persona = opts.persona;
    this.abilities = opts.abilities ?? [];

    this.llm = opts.llm;
    this.keypair = opts.keypair;

    this.memoryService = opts.memoryService;

    this.abilityMap =
      this.habilisServer?.toolsMap ??
      new Map(this.abilities.map((ability) => [ability.id, ability]));
  }

  /**
   * Calls a tool either through HabilisServer if available or directly using the ability map
   * @param toolName The name/ID of the tool to call
   * @param args Arguments to pass to the tool
   * @param streamTextHandler Optional callback for streaming text updates
   * @returns The result of the tool execution
   */
  async callTool(
    toolName: string,
    args: any,
    streamTextHandler?: (message: string) => void,
  ): Promise<any> {
    // If HabilisServer is available, delegate to it
    if (this.habilisServer) {
      return this.habilisServer.callTool(toolName, args, streamTextHandler);
    }

    // Otherwise, use the local ability map
    const tool = this.abilityMap.get(toolName);
    if (!tool) {
      console.error(`Tool ${toolName} not found in ability map`);
      return `Tool ${toolName} not found`;
    }

    return HabilisServer.callToolWithRetries(tool, tool.serverUrl, args, {
      retryCount: 0,
      callback: streamTextHandler,
    });
  }

  async message(
    message: string,
    opts?: {
      channelId?: string;
      streamTextHandler?: (text: string) => void;
    },
  ): Promise<IMessageLifecycle> {
    let lifecycle: IMessageLifecycle = {
      agentPubkey: this.keypair.publicKey.toBase58(),
      agentName: this.persona.name,
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

    const tools = Array.from(this.abilityMap.values()).map((tool) => ({
      ...tool,
      name: tool.id,
    }));

    console.log('Tools:', tools);

    // Recall context from memory if available
    const contextResults = await this.memoryService?.recallMemory(lifecycle);
    console.log('Context Results:', contextResults);
    if (contextResults && contextResults.context) {
      lifecycle.context = contextResults.context;
    }

    // Generate Text
    let continuePrompting = true;
    let openaiResponse;
    let promptCount = 0;
    const MAX_PROMPTS = 10;

    while (continuePrompting && promptCount < MAX_PROMPTS) {
      promptCount++;

      openaiResponse = await invokeLLM(
        this.llm,
        lifecycle,
        tools,
        opts?.streamTextHandler,
      );

      console.log('OpenAI Response:', openaiResponse);

      if (openaiResponse?.choices[0].message.tool_calls) {
        const toolCall = openaiResponse.choices[0].message.tool_calls[0];
        const toolName = toolCall.function.name;
        const toolCallId = toolCall.id;
        const toolArgs = this.parseArgs(toolCall.function.arguments);

        lifecycle.output =
          openaiResponse.choices[0].message.content ||
          `Using ability - ${toolName}`;

        opts?.streamTextHandler?.(lifecycle.output);

        const toolResult = await this.callTool(
          toolName,
          toolArgs,
          opts?.streamTextHandler,
        );

        lifecycle.tools.push({
          type: 'function',
          toolCall: {
            id: toolCallId,
            function: {
              name: toolName,
              arguments: JSON.stringify(toolArgs),
            },
          },
          result: JSON.stringify(toolResult),
        });
      } else {
        continuePrompting = false;
        lifecycle.output = openaiResponse?.choices[0].message.content ?? '';
      }

      // Add knowledge to memory if available
      await this.memoryService?.createMemory(lifecycle);
    }

    return lifecycle;
  }

  /**
   * args for tool calls could have a concatenated JSON value. example format "{}{}"
   * this function parses and extracts the value and returns it as a merged object
   */
  parseArgs(args: string) {
    try {
      const jsonMatches = args.match(/\{.*?\}/g);

      if (!jsonMatches) return [{}];

      const mergedObject = jsonMatches.reduce((result, json) => {
        try {
          const parsed = JSON.parse(json);
          if (parsed && Object.keys(parsed).length > 0) {
            return { ...result, ...parsed };
          }
          return result;
        } catch (error) {
          return result;
        }
      }, {});

      return mergedObject;
    } catch (error) {
      console.error('Error parsing tool args:', error);
      return [{}];
    }
  }
}
