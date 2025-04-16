import OpenAI from 'openai';
import type { IAgentPromptState, ModelSettings } from './types';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type {
  ResponseCreateParamsBase,
  ResponseInputItem,
} from 'openai/resources/responses/responses.mjs';

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
- Pay very close attention to the tool's description. If it has any instructions, follow them carefully.
- When a tool returns output that must be displayed to the user:
- If the tool description says to output the result as-is or without modification, you MUST copy and paste the EXACT output, with NO changes whatsoever
- Do NOT modify, format, paraphrase, or wrap the tool output in any way unless explicitly instructed
- Do NOT add explanatory text or summaries that alter the original output
- Place tool outputs on their own line when instructed to do so
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
    case 'google':
      throw new Error('Google embedding not implemented');
  }
}

function createInstructionsPrompt(lifecycle: IAgentPromptState): string {
  return `
  <System Prompt>
  ${SYSTEM_PROMPT}
  </System Prompt>
  
  <Your Name>
  ${lifecycle.agentName}
  </Your Name>

  <Your Identity>
  ${lifecycle.identityPrompt}
  </Your Identity>
  `;
}

export async function promptLLM(
  generationModelSettings: ModelSettings,
  lifecycle: IAgentPromptState,
  tools: Tool[],
  streamTextHandler?: (chunk: any) => void, // Add stream handler
): Promise<OpenAI.Responses.Response> {
  const instructions = createInstructionsPrompt(lifecycle);

  switch (generationModelSettings?.provider) {
    case 'openai':
      const openai = new OpenAI({
        apiKey: generationModelSettings.apiKey,
        baseURL: generationModelSettings.endpoint,
        dangerouslyAllowBrowser: true,
      });

      const input: ResponseInputItem[] = [];

      const context = lifecycle.context.join('\n');

      if (context) {
        input.push({
          role: 'assistant' as const,
          content: `<AdditionalContext>\n${context}\n</AdditionalContext>`,
        });
      }

      input.push({
        role: 'user' as const,
        content: lifecycle.message,
      });

      if (lifecycle.tools.length > 0) {
        const toolMessages = lifecycle.tools.flat();
        input.push(...toolMessages);
      }

      const payload: ResponseCreateParamsBase = {
        model: generationModelSettings.name,
        instructions,
        input,
        temperature: generationModelSettings.temperature,
        max_output_tokens: generationModelSettings.maxTokens,
        previous_response_id: lifecycle.previousResponseId,
        tools:
          tools?.length > 0
            ? tools.map((tool) => ({
                type: 'function' as const,
                name: tool.name,
                description: tool.description,
                parameters: {
                  type: tool.inputSchema.type,
                  properties: tool.inputSchema.properties,
                  required: Object.keys(tool.inputSchema.properties ?? {}), // strict mode requires all properties to be present
                  additionalProperties: false,
                },
                strict: true,
              }))
            : undefined,
      };

      console.debug('Payload:', payload);

      let openaiResponse: OpenAI.Responses.Response | undefined;

      if (streamTextHandler) {
        // Create a streaming completion with the same payload
        const stream = await openai.responses.create({
          ...payload,
          stream: true,
        });

        // Track both the accumulated text and tool calls across chunks
        let allText = '';

        // Process each event from the stream
        for await (const event of stream) {
          // Update the response object
          if ('response' in event) {
            openaiResponse = event.response;
          }

          const type = event.type;

          // Handle content chunks and stream to UI
          if (type === 'response.output_text.delta') {
            allText += event.delta;
            streamTextHandler(event.delta);
          }

          if (type === 'response.completed') {
            openaiResponse = event.response;
          }
        }
        // Add a check after the loop to ensure the response was received
        if (!openaiResponse) {
          throw new Error(
            'LLM stream finished but no completion response was received.',
          );
        }
      } else {
        // Non-streaming case
        openaiResponse = (await openai.responses.create(
          payload,
        )) as OpenAI.Responses.Response;
      }

      return openaiResponse;
    case 'google':
      // Not yet implemented
      throw new Error('Google LLM not implemented');
  }
}
