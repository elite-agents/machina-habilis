import type { Keypair } from '@solana/web3.js';
import type { SimplePersona } from './persona';
import type { IRepository, OldowanToolDefinition } from '@elite-agents/oldowan';
import * as z from 'zod';

export type { OldowanToolDefinition };

export const ZMessageLifecycle = z.object({
  agentPubkey: z.string(),
  message: z.string(),
  messageId: z.string(),
  createdAt: z.string(),
  approval: z.string(),
  channelId: z.string().nullable(),
  agentName: z.string().default(''),
  identityPrompt: z.string().nullable(),
  context: z.array(z.string()).default([]),
  tools: z
    .array(
      z.object({
        toolCall: z.object({
          id: z.string(),
          function: z.object({
            name: z.string(),
            arguments: z.string(),
          }),
        }),
        result: z.string(),
        type: z.literal('function'),
      }),
    )
    .default([]),
  generatedPrompt: z.string().default(''),
  output: z.string().default(''),
  actionsLog: z.array(z.string()).default([]),
});

export const ZModelSettings = z.object({
  provider: z.enum(['openai', 'anthropic']),
  endpoint: z.string(),
  name: z.string(), // gpt-4o, claude-3-5-sonnet, etc.
  apiKey: z.string(),
  temperature: z.number().optional(),
  maxTokens: z.number().optional(),
  dimensions: z.number().optional(),
});

export type ModelSettings = z.infer<typeof ZModelSettings>;

export type IMessageLifecycle = z.infer<typeof ZMessageLifecycle>;

export interface IHabilisServer {
  memoryServerUrl: string;
  mcpServers: string[];
  toolsMap: Map<string, OldowanToolDefinition>;
  recallContextTool?: string;
  addKnowledgeTool?: string;
  cacheDb?: IRepository<OldowanToolDefinition>;

  init(mcpServers: string[]): Promise<void>;
  addMCPServer(url: string): Promise<string[]>;
  callTool(
    toolId: string,
    args: any,
    statusCallback?: (message: string) => void,
  ): Promise<any>;
}

export type IMachinaAgentOpts = {
  persona: SimplePersona;
  abilityNames: Set<string>;
  llm: ModelSettings;
  keypair: Keypair;
};

export interface IMachinaAgent extends IMachinaAgentOpts {
  // Properties
  habilisServer: IHabilisServer;
  abilityMap: Map<string, OldowanToolDefinition>;

  // Methods
  message(
    message: string,
    opts?: {
      channelId?: string;
      callback?: (lifecycle: IMessageLifecycle) => void;
      streamTextHandler?: (text: string) => void;
    },
  ): Promise<IMessageLifecycle>;

  learnAbility(ability: OldowanToolDefinition): void;
}
