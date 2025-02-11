import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { Keypair } from '@solana/web3.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { SimplePersona } from './persona';
import * as z from 'zod';

export type ToolWithServer = Tool & {
  serverUrl: string;
};

export const ZMessageLifecycle = z.object({
  habilisPubkey: z.string(),
  message: z.string(),
  messageId: z.string(),
  createdAt: z.string(),
  approval: z.string(),
  channelId: z.string().nullable(),
  habilisName: z.string().default(''),
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
  apiKey: z.string().optional(),
  temperature: z.number().optional(),
  maxTokens: z.number().optional(),
  dimensions: z.number().optional(),
});

export type ModelSettings = z.infer<typeof ZModelSettings>;

export type IMessageLifecycle = z.infer<typeof ZMessageLifecycle>;

export interface IHabilis {
  // Properties
  persona: SimplePersona | undefined;
  keypair: Keypair | undefined;
  mcpClients: {
    [url: string]: Client;
  };
  tools: ToolWithServer[];
  modelApiKeys: {
    generationKey: string | undefined;
  };

  // Methods
  init(opts: {
    persona: SimplePersona;
    privateKey: Keypair;
    modelApiKeys: {
      generationKey: string;
      embeddingKey?: string;
    };
  }): Promise<void>;

  addMCPServer(opts: { url: string }): Promise<void>;

  message(
    message: string,
    opts?: {
      channelId?: string;
      context?: boolean;
      actions?: boolean;
      postProcess?: boolean;
    }
  ): Promise<IMessageLifecycle>;
}
