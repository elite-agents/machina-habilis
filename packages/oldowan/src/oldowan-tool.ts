import { type CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

export class OldowanTool<T extends z.ZodRawShape> {
  name: string;
  description: string;
  schema: T;
  call: (input: Record<string, unknown>) => Promise<CallToolResult>;

  constructor({
    name,
    description,
    schema,
    execute,
  }: {
    name: string;
    description: string;
    schema: T;
    execute: (input: z.infer<z.ZodObject<T>>) => Promise<unknown>;
  }) {
    this.name = name;
    this.description = description;
    this.schema = schema;
    this.call = (input: Record<string, unknown>) =>
      this.toolCall(input, execute);
  }

  // TODO: add signature check against token gate for the tool call here
  async toolCall(
    args: Record<string, unknown>,
    cb: (input: z.infer<z.ZodObject<typeof this.schema>>) => Promise<unknown>
  ) {
    try {
      const validatedInput = await this.validateInput(args);
      const result = await cb(validatedInput);
      return this.createSuccessResponse(result);
    } catch (error) {
      return this.createErrorResponse(error as Error);
    }
  }

  private async validateInput(args: Record<string, unknown>) {
    return z.object(this.schema).parse(args);
  }

  private getJsonSchemaType(zodType: z.ZodType<any>): string {
    if (zodType instanceof z.ZodString) return 'string';
    if (zodType instanceof z.ZodNumber) return 'number';
    if (zodType instanceof z.ZodBoolean) return 'boolean';
    if (zodType instanceof z.ZodArray) return 'array';
    if (zodType instanceof z.ZodObject) return 'object';
    return 'string';
  }

  protected createSuccessResponse(data: unknown) {
    return {
      content: [
        {
          type: 'text' as const,
          text: typeof data === 'string' ? data : JSON.stringify(data),
        },
      ],
    };
  }

  protected createErrorResponse(error: Error) {
    return {
      content: [
        { type: 'text' as const, text: `An error occurred: ${error.message}` },
      ],
    };
  }

  static async fetch<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, init);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  }
}
