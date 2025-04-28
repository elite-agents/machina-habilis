import { type CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { type PaymentDetails, type ToolAuthArg } from './types';
import {
  verifySignature,
  type SignatureBytes,
  getBase58Encoder,
} from '@solana/kit';
import { generateDeterministicPayloadForSigning } from './utils';
import { ED25519_ALGORITHM_IDENTIFIER } from './crypto';

export class OldowanTool<T extends z.ZodRawShape> {
  name: string;
  description: string;
  schema: T;
  call: (input: Record<string, unknown>) => Promise<CallToolResult>;
  paymentDetails?: PaymentDetails;

  constructor({
    name,
    description,
    schema,
    execute,
    paymentDetails,
  }: {
    name: string;
    description: string;
    schema: T;
    execute: (input: z.infer<z.ZodObject<T>>) => Promise<unknown>;
    paymentDetails?: PaymentDetails;
  }) {
    if ('auth' in schema) {
      throw new Error(
        `The field 'auth' is reserved and cannot be defined in the tool schema.`,
      );
    }

    this.name = name;
    this.description = description;
    this.schema = schema;
    this.call = (input: Record<string, unknown>) =>
      this.toolCall(input, execute);
    this.paymentDetails = paymentDetails;
  }

  async toolCall(
    args: Record<string, unknown>,
    cb: (input: z.infer<z.ZodObject<typeof this.schema>>) => Promise<unknown>,
  ) {
    try {
      const validatedInput = await this.validateInput(args);

      if (this.paymentDetails) {
        // if there is no paymentDetails, then no signature check is required
        // for best performance

        if (!args.auth)
          throw new Error(
            'No authentication payload provided. You are not allowed to call this tool.',
          );

        const { signatureBase64Url, publicKeyBase58, nonce } =
          args.auth as ToolAuthArg;

        const currentTimestamp = Date.now();

        // if the nonce is more than 3 minutes old, then the signature is invalid
        if (currentTimestamp - nonce > 3 * 60 * 1000) {
          throw new Error('Invalid signature. Signature is too old.');
        }

        const payload = generateDeterministicPayloadForSigning(
          validatedInput,
          nonce,
        );

        const publicKey = await crypto.subtle.importKey(
          'raw',
          getBase58Encoder().encode(publicKeyBase58),
          ED25519_ALGORITHM_IDENTIFIER,
          true,
          ['verify'],
        );

        const verified = await verifySignature(
          publicKey,
          new Uint8Array(
            Buffer.from(signatureBase64Url, 'base64url'),
          ) as SignatureBytes,
          payload,
        );

        if (!verified) {
          throw new Error(
            'Invalid signature. You are not allowed to call this tool.',
          );
        }

        // TODO: now check payment based on the public key
      }

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
