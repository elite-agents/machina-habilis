import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { Hono } from 'hono';
import { z } from 'zod';

const ZPrimitiveType = z.enum(['string', 'number', 'boolean']);
const ZHttpMethod = z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

type JSONPrimitive = z.infer<typeof ZPrimitiveType>;
export type JSONValue =
  | JSONPrimitive
  | JSONValue[]
  | { [key: string]: JSONValue };

const ZJsonSchema: z.ZodType<JSONValue> = z.lazy(() =>
  z.union([ZPrimitiveType, z.array(ZJsonSchema), z.record(ZJsonSchema)]),
);

export type ToolSchemaProperties = {
  [key: string]: {
    type: JSONPrimitive;
    description: string | undefined;
  };
};

// OpenAPI specific types
export const ZOpenAPIParameter = z.object({
  name: z.string(),
  in: z.enum(['path', 'query', 'header', 'cookie']),
  description: z.string().optional(),
  required: z.boolean().optional(),
  schema: z.record(z.any()).optional(),
});

export const ZOpenAPIRequestBody = z.object({
  description: z.string().optional(),
  content: z.record(
    z.object({
      schema: z.record(z.any()).optional(),
    }),
  ),
  required: z.boolean().optional(),
});

export const ZEndpointDefinition = z.object({
  creator: z.string(),
  name: z.string(),
  description: z.string(),
  method: ZHttpMethod,
  url: z.string(),
  transformFn: z.string().optional(),
  headers: z.record(z.string()).optional(),
  // OpenAPI specific fields
  openApiSpec: z.record(z.any()).optional(), // Store the complete OpenAPI spec
  parameters: z.array(ZOpenAPIParameter).optional(),
  requestBody: ZOpenAPIRequestBody.optional(),
});

export type IEndpointDefinition = z.infer<typeof ZEndpointDefinition>;
export type OpenAPIParameter = z.infer<typeof ZOpenAPIParameter>;
export type OpenAPIRequestBody = z.infer<typeof ZOpenAPIRequestBody>;

export type OldowanToolDefinition = Tool & {
  id: string;
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
  honoServer: HonoServerWithPort;
}

export interface IRestApiWrappedOldowanTool extends Tool {
  endpointDefinition: IEndpointDefinition;
  convertParamsToSchema: (params: Record<string, string>) => {
    [key: string]: {
      type: JSONPrimitive;
      description: string | undefined;
    };
  };
}

export interface IRepository<T> {
  /**
   * Creates a new entity in the repository
   * @param entity The entity to create
   * @returns Promise resolving to the created entity
   */
  create(entity: T): Promise<T>;

  /**
   * Retrieves all entities from the repository
   * @returns Promise resolving to array of all entities
   */
  find(): Promise<T[]>;

  /**
   * Finds a single entity by ID
   * @param id The unique identifier of the entity
   * @returns Promise resolving to the found entity or null if not found
   */
  findOne(id: string): Promise<T | null>;

  /**
   * Updates an existing entity
   * @param entity The entity with updated values
   * @returns Promise resolving to the updated entity
   */
  update(id: string, entity: T): Promise<T>;

  /**
   * Removes an entity from the repository
   * @param id The unique identifier of the entity
   * @returns Promise resolving to the removed entity
   */
  remove(id: string): Promise<T>;
}

export interface IEndpointDefinitionRepository
  extends IRepository<IEndpointDefinition> {}

export interface IRestApiWrappedOldowanToolRepository
  extends IRepository<IRestApiWrappedOldowanTool> {}

export type MCPServerLike = {
  connect: Server['connect'];
  close: Server['close'];
};

export type HonoServerWithPort = Hono & {
  port: number;
};
