import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { Hono } from 'hono';
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
    description: string | undefined;
  };
};

export const ZEndpointDefinition = z.object({
  creator: z.string(),
  name: z.string(),
  description: z.string(),
  method: ZHttpMethod,
  url: z.string(),
  pathParams: z.record(z.string(), ZPrimitiveType).optional(),
  queryParams: z.record(z.string(), ZPrimitiveType).optional(),
  body: z.record(z.string(), ZJsonSchema).optional(),
  transformFn: z.string().optional(),
  headers: z.record(z.string()).optional(),
  paramDescriptions: z.record(z.string(), z.string()).optional(),
  requiredParams: z.array(z.string()).optional(),
});

export type IEndpointDefinition = z.infer<typeof ZEndpointDefinition>;

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

export interface IRestApiWrappedOldowanTool extends OldowanToolDefinition {
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
