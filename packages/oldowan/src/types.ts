import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

const ZPrimitiveType = z.enum(['string', 'number', 'boolean']);
const ZHttpMethod = z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

type JSONPrimitive = z.infer<typeof ZPrimitiveType>;
type JSONValue = JSONPrimitive | JSONValue[] | { [key: string]: JSONValue };

const ZJsonSchema: z.ZodType<JSONValue> = z.lazy(() =>
  z.union([ZPrimitiveType, z.array(ZJsonSchema), z.record(ZJsonSchema)]),
);

export type ToolSchemaProperties = {
  [key: string]: {
    type: JSONPrimitive;
    description: string;
  };
};

export const ZEndpointDefinition = z.object({
  name: z.string(),
  description: z.string(),
  method: ZHttpMethod,
  url: z.string(),
  pathParams: z.record(z.string(), ZPrimitiveType).optional(),
  queryParams: z.record(z.string(), ZPrimitiveType).optional(),
  body: z.record(z.string(), ZPrimitiveType).optional(),
  responseFields: ZJsonSchema,
  transform: z.string().optional(),
  headers: z.record(z.string()).optional(),
  paramDescriptions: z.record(z.string(), z.string()).optional(),
});

export type IEndpointDefinition = z.infer<typeof ZEndpointDefinition>;

export type OldowanToolDefinition = Tool & {
  uniqueName: string;
  serverUrl: string;
  tokenGate?: {
    mint: string;
    amount: bigint;
  };
};

export type OldowanSseServer = {
  fetch: (request: Request) => Response | Promise<Response>;
  port: number;
};

export interface IOldowanServer {
  sseServer: OldowanSseServer;
}
