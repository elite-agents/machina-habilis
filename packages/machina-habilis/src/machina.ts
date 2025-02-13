import { type IMessageLifecycle } from './types.js';
import type { Keypair } from '@solana/web3.js';
import { createPrompt, generateText } from './llm.js';
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
  abilityNames: string[];
  llm: ModelSettings;
  keypair: Keypair;

  tools: OldowanToolDefinition[];

  constructor(habilisServer: HabilisServer, opts: IMachinaAgentOpts) {
    this.habilisServer = habilisServer;
    this.persona = opts.persona;
    this.abilityNames = opts.abilityNames;
    this.llm = opts.llm;
    this.keypair = opts.keypair;

    this.tools = habilisServer.toolsMap
      .values()
      .filter((tool) => this.abilityNames.includes(tool.name))
      .toArray();
  }

  learnAbility(ability: OldowanToolDefinition) {
    this.tools.push(ability);
    this.abilityNames.push(ability.uniqueName);
  }

  async message(
    message: string,
    opts?: {
      channelId?: string;
      callback?: (lifecycle: IMessageLifecycle) => void;
    }
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

    // If this agent has a recall memory tool, recall context from it
    if (this.habilisServer.recallContextTool) {
      // Recall context from memory server
      const contextResults = await this.habilisServer.callTool(
        this.habilisServer.recallContextTool,
        {
          lifecycle,
        }
      );

      console.log('Context Results:', contextResults);

      lifecycle.context = contextResults.context;
    }

    // Generate Text
    let continuePrompting = true;
    let openaiResponse;

    while (continuePrompting) {
      lifecycle.generatedPrompt = createPrompt(lifecycle);

      openaiResponse = await generateText(
        this.llm,
        lifecycle.generatedPrompt,
        this.tools
      );

      console.log('OpenAI Response:', openaiResponse);

      if (openaiResponse?.choices[0].message.tool_calls) {
        const toolCall = openaiResponse.choices[0].message.tool_calls[0];
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);

        lifecycle.output =
          openaiResponse.choices[0].message.content ??
          `Using ability - ${toolName}`;

        opts?.callback?.(lifecycle);

        const toolResult = await this.habilisServer.callTool(
          toolName,
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

      // If this agent has an add knowledge tool, add the knowledge to the memory server
      if (this.habilisServer.addKnowledgeTool) {
        this.habilisServer.callTool(this.habilisServer.addKnowledgeTool, {
          lifecycle,
        });
      }
    }

    return lifecycle;
  }
}
