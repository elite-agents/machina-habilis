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
import {
  GET_CONTEXT_FROM_QUERY_TOOL_NAME,
  INSERT_KNOWLEDGE_TOOL_NAME,
} from './constants.js';
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

    // Recall context from memory server
    const contextResults = await this.habilisServer.callTool(
      GET_CONTEXT_FROM_QUERY_TOOL_NAME,
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

      // Insert the knowledge into the memory server
      await this.habilisServer.callTool(INSERT_KNOWLEDGE_TOOL_NAME, {
        lifecycle,
      });
    }

    return lifecycle;
  }
}
