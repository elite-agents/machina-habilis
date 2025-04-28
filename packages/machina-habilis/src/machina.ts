import { type IAgentPromptState } from './types';
import { promptLLM } from './llm';
import { nanoid } from 'nanoid';
import type {
  IResponseFunctionToolCallOutputItem,
  MemoryService,
  ModelSettings,
} from './types';
import {
  generateDeterministicPayloadForSigning,
  type OldowanToolDefinition,
  type ToolAuthArg,
} from '@elite-agents/oldowan';
import type { SimplePersona } from './persona';
import { HabilisServer } from './habilis';
import type { ResponseFunctionToolCall } from 'openai/resources/responses/responses.mjs';
import {
  signBytes,
  getAddressFromPublicKey,
  createKeyPairFromBytes,
} from '@solana/kit';

export type IMachinaAgentOpts = {
  persona: SimplePersona;
  llm: ModelSettings;
  keypairBase64: string;
  abilities?: OldowanToolDefinition[];
  habilisServer?: HabilisServer;
  memoryService?: MemoryService;
};

/**
 * MachinaAgent is an interactive agent that:
 * - Maintains a persona and LLM settings.
 * - Signs and authenticates tool calls with a Solana keypair.
 * - Routes and executes tools via HabilisServer or local abilities.
 * - Manages streaming, retries, and stateful prompting loops.
 * - Recalls and stores conversational memory.
 *
 * @example
 * ```typescript
 * const agent = new MachinaAgent({
 *   persona: { name: 'John Doe', bio: ['John Doe is a helpful assistant.'] },
 *   llm: { model: 'gpt-3.5-turbo', provider: 'openai' },
 *   keypairBase64: 'YOUR_BASE64_KEYPAIR',
 *   abilities: [],
 *   habilisServer: serverInstance,
 *   memoryService: memoryServiceInstance,
 * });
 * ```
 */
export class MachinaAgent {
  habilisServer?: HabilisServer;

  persona: SimplePersona;
  llm: ModelSettings;
  keypair?: CryptoKeyPair;
  keypairBase64: string;
  abilities: OldowanToolDefinition[];

  abilityMap: Map<string, OldowanToolDefinition>;

  memoryService?: MemoryService;

  /**
   * Creates a new MachinaAgent instance.
   * @param opts Initialization options for the agent.
   * @param opts.persona The persona containing name and bio.
   * @param opts.llm LLM model settings for generating responses.
   * @param opts.keypairBase64 Base64-encoded key pair for signing.
   * @param opts.abilities Optional list of tool definitions the agent can call.
   * @param opts.habilisServer Optional HabilisServer to delegate tool calls.
   * @param opts.memoryService Optional memory service for context recall and storage.
   */
  constructor(opts: IMachinaAgentOpts) {
    this.habilisServer = opts.habilisServer;
    this.persona = opts.persona;
    this.abilities = opts.abilities ?? [];

    this.llm = opts.llm;
    this.keypairBase64 = opts.keypairBase64;

    const keypairBytes = Buffer.from(this.keypairBase64, 'base64');
    if (keypairBytes.length !== 64) {
      throw new Error('Keypair must be exactly 64 bytes long');
    }

    this.memoryService = opts.memoryService;

    this.abilityMap =
      this.habilisServer?.toolsMap ??
      new Map(
        this.abilities.map((ability) => [ability.id ?? ability.name, ability]),
      );
  }

  /**
   * Lazily initializes and returns the agent's Solana keypair.
   *
   * If a CryptoKeyPair is already cached, returns it directly;
   * otherwise decodes the Base64URL string and imports a new keypair.
   *
   * @returns A Promise resolving to the agent's CryptoKeyPair used for signing.
   */
  private async getKeypair() {
    return (
      this.keypair ??
      (await createKeyPairFromBytes(Buffer.from(this.keypairBase64, 'base64')))
    );
  }

  /**
   * Signs the arguments for a tool call
   * @param args The arguments to sign
   * @returns The signed arguments
   */
  async signArgs(args: Record<string, unknown>): Promise<ToolAuthArg> {
    // use current timestamp as nonce so signature cannot be replayed
    const nonce = Date.now();

    const payload = generateDeterministicPayloadForSigning(args, nonce);

    const keypairToSignWith = await this.getKeypair();

    const signatureBytes = await signBytes(
      keypairToSignWith.privateKey,
      payload,
    );

    const signatureBase64Url =
      Buffer.from(signatureBytes).toString('base64url');

    const publicKeyBase58 = await getAddressFromPublicKey(
      keypairToSignWith.publicKey,
    );

    return { signatureBase64Url, publicKeyBase58, nonce };
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
    const { signatureBase64Url, publicKeyBase58, nonce } =
      await this.signArgs(args);

    // If HabilisServer is available, delegate to it
    if (this.habilisServer) {
      return this.habilisServer.callTool(toolName, args, {
        callback: streamTextHandler,
        auth: {
          signatureBase64Url,
          publicKeyBase58,
          nonce,
        },
      });
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
      auth: {
        signatureBase64Url,
        publicKeyBase58,
        nonce,
      },
    });
  }

  /**
   * Sends a message to the agent and processes it through the LLM, handling tool calls and memory.
   * @param message The input message to process.
   * @param opts Optional settings for the message.
   * @param opts.channelId ID of the communication channel.
   * @param opts.streamTextHandler Callback for streaming text updates.
   * @param opts.previousResponseId Previous message ID to continue context.
   * @param opts.additionalContext Additional context key/value pairs.
   * @returns The updated agent prompt state after processing.
   */
  async message(
    message: string,
    opts?: {
      channelId?: string;
      streamTextHandler?: (text: string) => void;
      previousResponseId?: string;
      additionalContext?: Map<string, string>;
    },
  ): Promise<IAgentPromptState> {
    const agentPubkey = await getAddressFromPublicKey(
      (await this.getKeypair()).publicKey,
    );

    let agentPromptState: IAgentPromptState = {
      agentPubkey,
      agentName: this.persona.name,
      messageId: nanoid(),
      message: message,
      createdAt: new Date().toISOString(),
      approval: '',
      channelId: opts?.channelId ?? null,
      identityPrompt: this.persona.bio.join('\n'),
      context: opts?.additionalContext
        ? Array.from(opts.additionalContext.entries()).map(
            ([key, value]) => `${key}: ${value}`,
          )
        : [],
      tools: [],
      generatedPrompt: '',
      output: '',
      actionsLog: [],
      previousResponseId: opts?.previousResponseId,
    };

    const tools = Array.from(this.abilityMap.values()).map((tool) => ({
      ...tool,
      name: tool.id ?? tool.name,
    }));

    console.debug('Tools:', tools);

    // if previous response id is not provided, recall context from memory if available
    if (!opts?.previousResponseId) {
      const contextResults =
        await this.memoryService?.recallMemory(agentPromptState);
      console.debug('Context Results:', contextResults);
      if (contextResults && contextResults.context) {
        agentPromptState.context.push(...contextResults.context);
      }
    }

    // Generate Text
    let continuePrompting = true;
    let llmResponse;
    let promptCount = 0;
    const MAX_PROMPTS = 10;

    while (continuePrompting && promptCount < MAX_PROMPTS) {
      promptCount++;

      llmResponse = await promptLLM(
        this.llm,
        agentPromptState,
        tools,
        opts?.streamTextHandler,
      );

      console.debug('OpenAI Response:', llmResponse);

      if (llmResponse?.output[0].type === 'function_call') {
        const toolCall = llmResponse.output[0];

        console.debug('Tool Call:', toolCall);

        const toolName = toolCall.name;
        const toolCallId = toolCall.call_id ?? '';
        const toolArgs = this.parseArgs(toolCall.arguments);

        const toolCallMessage =
          llmResponse.output_text || `Using ability - ${toolName}   \n\n`;

        opts?.streamTextHandler?.(toolCallMessage);

        const toolResult = await this.callTool(
          toolName,
          toolArgs,
          opts?.streamTextHandler,
        );

        const thisToolUse: [
          ResponseFunctionToolCall,
          IResponseFunctionToolCallOutputItem,
        ] = [
          toolCall,
          {
            call_id: toolCallId,
            output: JSON.stringify(toolResult),
            type: 'function_call_output',
            status: 'completed',
          },
        ];

        agentPromptState.tools.push(thisToolUse);
      } else {
        continuePrompting = false;
        agentPromptState.output = llmResponse?.output_text ?? '';
      }

      // Add knowledge to memory if available
      await this.memoryService?.createMemory(agentPromptState);
    }

    // Once we've completed all the processing, set the previous response ID
    agentPromptState.previousResponseId = llmResponse?.id;

    return agentPromptState;
  }

  /**
   * Parses concatenated JSON strings into a single merged object.
   * @param args A string containing one or more JSON object segments.
   * @returns An object merging all parsed JSON key/value pairs.
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
