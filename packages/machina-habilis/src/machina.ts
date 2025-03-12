import { type IMessageLifecycle } from './types.js';
import type { Keypair } from '@solana/web3.js';
import { invokeLLM } from './llm.js';
import { nanoid } from 'nanoid';
import type {
  IMachinaAgent,
  IMachinaAgentOpts,
  ModelSettings,
  OldowanToolDefinition,
} from './types.js';
import type { SimplePersona } from './persona.js';
import type { HabilisServer } from './habilis';
export class MachinaAgent implements IMachinaAgent {
  habilisServer: HabilisServer;

  persona: SimplePersona;
  abilityNames: Set<string>;
  llm: ModelSettings;
  keypair: Keypair;

  abilityMap: Map<string, OldowanToolDefinition>;

  constructor(habilisServer: HabilisServer, opts: IMachinaAgentOpts) {
    this.habilisServer = habilisServer;
    this.persona = opts.persona;
    this.abilityNames = new Set(opts.abilityNames);
    this.llm = opts.llm;
    this.keypair = opts.keypair;

    this.abilityMap = new Map(
      Array.from(habilisServer.toolsMap.entries()).filter(([key]) =>
        this.abilityNames.has(key),
      ),
    );
  }

  learnAbility(ability: OldowanToolDefinition) {
    this.abilityMap.set(ability.uniqueName, ability);
    this.abilityNames.add(ability.uniqueName);
  }

  async message(
    message: string,
    opts?: {
      channelId?: string;
      callback?: (lifecycle: IMessageLifecycle) => void;
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

    const tools = this.abilityMap
      .values()
      .toArray()
      .map((tool) => ({
        ...tool,
        name: tool.uniqueName,
      }));

    // If this agent has a recall memory tool, recall context from it
    if (this.habilisServer.recallContextTool) {
      // Recall context from memory server
      const contextResults = await this.habilisServer.callTool(
        this.habilisServer.recallContextTool,
        {
          lifecycle,
        },
      );

      console.log('Context Results:', contextResults);

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

        opts?.callback?.(lifecycle);

        const toolResult = await this.habilisServer.callTool(
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

      // If this agent has an add knowledge tool, add the knowledge to the memory server
      if (this.habilisServer.addKnowledgeTool) {
        this.habilisServer.callTool(this.habilisServer.addKnowledgeTool, {
          lifecycle,
        });
      }
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
