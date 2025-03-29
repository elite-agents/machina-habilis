import * as z from 'zod';

const ZResponseFunctionToolCall = z.object({
  arguments: z.string(),
  call_id: z.string(),
  name: z.string(),
  type: z.literal('function_call'),
  id: z.string().optional(),
  status: z.enum(['in_progress', 'completed', 'incomplete']).optional(),
});

const ZResponseFunctionToolCallOutputItem = z.object({
  call_id: z.string(),
  output: z.string(),
  type: z.literal('function_call_output'),
  status: z.enum(['in_progress', 'completed', 'incomplete']).optional(),
});

const ZToolUseTuple = z.tuple([
  ZResponseFunctionToolCall,
  ZResponseFunctionToolCallOutputItem,
]);

export type IResponseFunctionToolCallOutputItem = z.infer<
  typeof ZResponseFunctionToolCallOutputItem
>;

export const ZAgentPromptState = z.object({
  agentPubkey: z.string(),
  message: z.string(),
  messageId: z.string(),
  createdAt: z.string(),
  approval: z.string(),
  channelId: z.string().nullable(),
  agentName: z.string().default(''),
  identityPrompt: z.string().nullable(),
  context: z.array(z.string()).default([]),
  tools: z.array(ZToolUseTuple).default([]),
  generatedPrompt: z.string().default(''),
  output: z.string().default(''),
  actionsLog: z.array(z.string()).default([]),
  previousResponseId: z.string().optional(),
});

export const ZModelSettings = z.object({
  provider: z.enum(['openai', 'google']),
  endpoint: z.string(),
  name: z.string(), // gpt-4o, claude-3-5-sonnet, etc.
  apiKey: z.string(),
  temperature: z.number().optional(),
  maxTokens: z.number().optional(),
  dimensions: z.number().optional(),
});

export type ModelSettings = z.infer<typeof ZModelSettings>;

export type IAgentPromptState = z.infer<typeof ZAgentPromptState>;

export type MemoryFunction = (
  lifecycle: IAgentPromptState,
) => Promise<IAgentPromptState>;

export type MemoryService = {
  recallMemory: MemoryFunction;
  createMemory: MemoryFunction;
};
