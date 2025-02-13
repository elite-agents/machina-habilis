import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { Keypair } from '@solana/web3.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { Ability, SimplePersona } from './persona';
import * as z from 'zod';

export type OldowanToolDefinition = Tool & {
  uniqueName: string;
  serverUrl: string;
  tokenGate?: {
    mint: string;
    amount: bigint;
  };
};

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
  tools: z.array(z.string()).default([]),
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
  mcpClients: {
    [url: string]: Client;
  };
  toolsMap: Map<string, OldowanToolDefinition>;
  recallContextTool?: string;
  addKnowledgeTool?: string;
}

export type IMachinaAgentOpts = {
  persona: SimplePersona;
  abilityNames: string[];
  llm: ModelSettings;
  keypair: Keypair;
};

export interface IMachinaAgent extends IMachinaAgentOpts {
  // Properties
  habilisServer: IHabilisServer;
  tools: OldowanToolDefinition[];

  // Methods
  message(
    message: string,
    opts?: {
      channelId?: string;
      context?: boolean;
    }
  ): Promise<IMessageLifecycle>;
}
