import OpenAI from 'openai';
import type { IMessageLifecycle, ModelSettings } from './types';
import Anthropic from '@anthropic-ai/sdk';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { ChatCompletionCreateParamsNonStreaming } from 'openai/resources/chat/completions.mjs';

export const SYSTEM_PROMPT = `
You are an tool-using AI agent operating within a framework that provides you with:
- An identity (who you are and your core traits)
- Context (memories and relevant information)
- Tools (capabilities you can use)

# Core Principles
1. Maintain consistent personality and behavior aligned with your identity
2. Use provided context to inform your responses
3. Consider past interactions when making decisions
4. Use available tools appropriately to accomplish tasks

# Input Structure
Each interaction will provide:
- Identity Prompt: Your specific role and personality
- Message: The user's current request/message
- Context: Relevant memories and information

# Response Protocol
1. First, process your identity and maintain that persona
2. Review provided context and incorporate relevant information
3. Analyze the user's message
4. Formulate a response that:
   - Stays true to your defined identity
   - Incorporates relevant context naturally
   - Uses appropriate tools when needed
   - Maintains conversation history coherence
   - Keep your responses concise
   
It's *very* important that if you do not know something, then you don't make something up. Instead you should either ask questions about it or ignore it.

# Memory Usage Guidelines
- Reference provided memories naturally, as a person would recall information
- Don't explicitly mention that you're using RAG or accessing memories
- Integrate past knowledge smoothly into conversations

# Tool Usage Guidelines
- When you are using a tool, you should always let the user know that you are doing so with a message
- Use tools when they would genuinely help accomplish the task
- Maintain in-character behavior while using tools
- Only use tools that have been explicitly provided
- If a tool fails, see if you can fix it or use another tool to accomplish the task
- If you can't fix it, then see if the user can help you fix it by providing more information

Remember: You are not just processing queries - you are embodying a specific identity with consistent traits, memories, and capabilities.
`;

export async function generateEmbeddings(
  embeddingModelSettings: ModelSettings,
  embeddingModelKey: string,
  message: string,
): Promise<number[]> {
  switch (embeddingModelSettings?.provider) {
    case 'openai':
      const client = new OpenAI({
        apiKey: embeddingModelKey,
        baseURL: embeddingModelSettings.endpoint,
        dangerouslyAllowBrowser: true,
      });

      const embedding = await client.embeddings.create({
        model: embeddingModelSettings.name,
        input: message,
      });
      return embedding.data[0].embedding;
      break;
    case 'anthropic':
      throw new Error('Anthropic embedding not implemented');
      break;
  }
}

async function generateText(
  generationModelSettings: ModelSettings,
  prompt: string,
  lifecycle: IMessageLifecycle,
  tools: Tool[],
  streamTextHandler?: (text: string) => void,
): Promise<OpenAI.Chat.Completions.ChatCompletion | void> {
  switch (generationModelSettings?.provider) {
    case 'openai':
      const openai = new OpenAI({
        apiKey: generationModelSettings.apiKey,
        baseURL: generationModelSettings.endpoint,
        dangerouslyAllowBrowser: true,
      });

      const payload: ChatCompletionCreateParamsNonStreaming = {
        model: generationModelSettings.name,
        messages: [
          {
            role: 'system' as const,
            content: SYSTEM_PROMPT,
          },
          {
            role: 'user' as const,
            content: prompt,
          },
        ],
        temperature: generationModelSettings.temperature,
        max_completion_tokens: generationModelSettings.maxTokens,
        tools:
          tools?.length > 0
            ? tools.map((tool) => ({
                type: 'function' as const,
                function: {
                  name: tool.name,
                  description: tool.description,
                  parameters: {
                    type: tool.inputSchema.type,
                    properties: tool.inputSchema.properties,
                    required: tool.inputSchema.required,
                    additionalProperties: false,
                  },
                  strict: true,
                },
              }))
            : undefined,
      };

      if (lifecycle.tools.length > 0) {
        const toolMessages = lifecycle.tools.flatMap((tool) => [
          {
            role: 'assistant' as const,
            tool_calls: [
              {
                ...tool.toolCall,
                type: 'function' as const,
              },
            ],
          },
          {
            role: 'tool' as const,
            tool_call_id: tool.toolCall.id,
            content: tool.result,
          },
        ]);
        payload.messages.push(...toolMessages);
      }

      console.log('Payload:', payload);

      let openaiResponse:
        | Partial<OpenAI.Chat.Completions.ChatCompletion>
        | undefined = {};

      if (streamTextHandler) {
        // Create a streaming completion with the same payload
        const stream = await openai.chat.completions.create({
          ...payload,
          stream: true,
        });

        // Track both the accumulated text and tool calls across chunks
        let allText = '';
        let toolCalls: any[] = [];
        let currentToolCall: any = null;

        // Process each chunk from the stream
        for await (const chunk of stream) {
          // Store the initial response metadata (id, etc.)
          if (!openaiResponse?.id) {
            openaiResponse =
              chunk as unknown as OpenAI.Chat.Completions.ChatCompletion;
          }

          const delta = chunk.choices[0]?.delta;

          // Handle tool calls that come in chunks
          if (delta?.tool_calls) {
            const toolCall = delta.tool_calls[0];

            // Start a new tool call if we don't have one in progress
            if (!currentToolCall) {
              currentToolCall = {
                id: toolCall.id,
                type: 'function',
                function: {
                  name: toolCall.function?.name || '',
                  arguments: toolCall.function?.arguments || '',
                },
              };
              toolCalls.push(currentToolCall);
            } else {
              // Append to existing tool call (arguments often come in multiple chunks)
              if (toolCall.function?.arguments) {
                currentToolCall.function.arguments +=
                  toolCall.function.arguments;
              }
              if (toolCall.function?.name) {
                currentToolCall.function.name = toolCall.function.name;
              }
            }
          }

          // Handle content chunks and stream to UI
          if (delta?.content) {
            allText += delta.content;
            streamTextHandler(delta.content);
          }

          // Reset current tool call when it's complete
          if (chunk.choices[0]?.finish_reason === 'tool_calls') {
            currentToolCall = null;
          }
        }

        // Construct a non-streaming style response for compatibility
        // This ensures the rest of the system works the same way for both streaming and non-streaming
        openaiResponse.choices = [
          {
            index: 0,
            logprobs: null,
            message: {
              role: 'assistant',
              content: allText,
              refusal: null,
              tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
            },
            // Set finish reason based on whether we used tools
            finish_reason: toolCalls.length > 0 ? 'tool_calls' : 'stop',
          },
        ];
      } else {
        // Non-streaming case
        openaiResponse = await openai.chat.completions.create(payload);
      }

      return openaiResponse as OpenAI.Chat.Completions.ChatCompletion;
    case 'anthropic':
      // const anthropic = new Anthropic({
      //   apiKey: generationModelKey,
      //   baseURL: generationModelSettings.endpoint,
      // });

      // const anthropicResponse = await anthropic.messages.create({
      //   model: generationModelSettings.name,
      //   system: SYSTEM_PROMPT,
      //   messages: [
      //     {
      //       role: 'user',
      //       content: userMessage,
      //     },
      //   ],
      //   max_tokens: generationModelSettings.maxTokens ?? 1000,
      //   temperature: generationModelSettings.temperature ?? 0.2,
      // });

      // return anthropicResponse.content.join('\n');
      break;
  }
}

function createPrompt(lifecycle: IMessageLifecycle): string {
  return `
  <Your Name>
  ${lifecycle.agentName}
  </Your Name>

  <Your Identity>
  ${lifecycle.identityPrompt}
  </Your Identity>

  <User Current Message>
  ${lifecycle.message}
  </User Current Message>

  <Context>
  ${lifecycle.context.join('\n')}
  </Context>
  `;
}

export function invokeLLM(
  generationModelSettings: ModelSettings,
  lifecycle: IMessageLifecycle,
  tools: Tool[],
  streamTextHandler?: (chunk: any) => void, // Add stream handler
) {
  const prompt = createPrompt(lifecycle);
  return generateText(
    generationModelSettings,
    prompt,
    lifecycle,
    tools,
    streamTextHandler,
  );
}
