import type { OpenAPIParameter, IEndpointDefinition } from './types';
import { RestApiWrappedOldowanTool } from './rest-wrapper-tool';
import OASNormalize from 'oas-normalize';

interface OpenAPIPathItem {
  parameters?: any[];
  get?: any;
  post?: any;
  put?: any;
  delete?: any;
  patch?: any;
  [key: string]: any;
}

interface OpenAPIOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  parameters?: any[];
  requestBody?: any;
  responses?: Record<string, any>;
  [key: string]: any;
}

/**
 * Create a list of tools from an OpenAPI spec
 * @param creator Creator of the endpoints
 * @param openapiSpec The OpenAPI specification
 * @param options Options for tool creation
 * @returns An array of RestApiWrappedOldowanTools
 */
export async function createToolsFromOpenAPI(
  creator: string,
  openapiSpec: Record<string, any>,
  options?: {
    namePrefix?: string;
    transformFn?: string;
    headers?: Record<string, string>;
    tokenGate?: {
      mint: string;
      amount: bigint;
    };
  },
): Promise<RestApiWrappedOldowanTool[]> {
  // Create endpoint definitions from the OpenAPI spec
  const endpointDefinitions = await createEndpointDefinitionsFromOpenAPI(
    creator,
    openapiSpec,
    options,
  );

  // Convert endpoint definitions to tools
  const tools = endpointDefinitions.map(
    (endpointDefinition) =>
      new RestApiWrappedOldowanTool(
        endpointDefinition,
        options?.tokenGate ? { tokenGate: options.tokenGate } : undefined,
      ),
  );

  return tools;
}

/**
 * Create endpoint definitions from an OpenAPI spec
 * @param creator Creator of the endpoints
 * @param openapiSpec The OpenAPI specification
 * @param options Options for endpoint creation
 * @returns An array of endpoint definitions
 */
export async function createEndpointDefinitionsFromOpenAPI(
  creator: string,
  openapiSpec: Record<string, any>,
  options?: {
    namePrefix?: string;
    transformFn?: string;
    headers?: Record<string, string>;
    tokenGate?: {
      mint: string;
      amount: bigint;
    };
  },
): Promise<IEndpointDefinition[]> {
  // Validate the OpenAPI specification using @readme/openapi-parser
  try {
    // Convert to string for validation as required by the library
    const normalizedSpec = new OASNormalize(openapiSpec);

    // Validate the normalized spec
    await normalizedSpec.validate();

    // Check if servers is present
    if (!openapiSpec.servers) {
      throw new Error('No servers found in OpenAPI spec');
    }
  } catch (error) {
    throw new Error(
      `Invalid OpenAPI specification: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const endpointDefinitions: IEndpointDefinition[] = [];
  const { paths, servers } = openapiSpec;

  if (!paths) {
    throw new Error('No paths found in OpenAPI spec');
  }

  // Extract base URL from the servers array (first server by default)
  let baseUrl = '';
  if (servers && servers.length > 0) {
    // Remove trailing slash if present
    baseUrl = servers[0].url.replace(/\/$/, '');
  }

  // Iterate through each path and HTTP method in the OpenAPI spec
  for (const [path, pathItem] of Object.entries(
    paths as Record<string, OpenAPIPathItem>,
  )) {
    for (const [method, operation] of Object.entries(pathItem)) {
      // Skip if not an HTTP method or if operation is not valid
      if (
        !['get', 'post', 'put', 'delete', 'patch'].includes(
          method.toLowerCase(),
        ) ||
        !operation
      ) {
        continue;
      }

      const methodUpper = method.toUpperCase() as
        | 'GET'
        | 'POST'
        | 'PUT'
        | 'PATCH'
        | 'DELETE';
      const operationObj = operation as OpenAPIOperation;

      // Extract parameters from the OpenAPI spec
      const parameters: OpenAPIParameter[] = [];

      // Combine parameters from path item and operation
      const rawParams = [
        ...(pathItem.parameters || []),
        ...(operationObj.parameters || []),
      ];

      // Process parameters
      for (const param of rawParams) {
        parameters.push({
          name: param.name,
          in: param.in,
          description: param.description,
          required: param.required,
          schema: param.schema,
        });
      }

      // Create a unique name for the endpoint
      const operationId =
        operationObj.operationId || `${method}-${path.replace(/[^\w]/g, '-')}`;
      const name = options?.namePrefix
        ? `${options.namePrefix}-${operationId}`
        : operationId;

      // Create the endpoint definition
      const endpointDefinition: IEndpointDefinition = {
        creator,
        name,
        description:
          operationObj.summary ||
          operationObj.description ||
          `${methodUpper} ${path}`,
        method: methodUpper,
        url: baseUrl ? `${baseUrl}${path}` : path,
        transformFn: options?.transformFn,
        headers: options?.headers,
        openApiSpec: openapiSpec,
        parameters: parameters.length > 0 ? parameters : undefined,
        requestBody: operationObj.requestBody,
      };

      endpointDefinitions.push(endpointDefinition);
    }
  }

  return endpointDefinitions;
}

/**
 * Map OpenAPI schema types to Zod primitive types
 * @param openAPIType OpenAPI type
 * @returns Zod primitive type
 */
export function mapOpenAPITypeToZod(
  openAPIType: string,
): 'string' | 'number' | 'boolean' {
  switch (openAPIType) {
    case 'integer':
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'string':
    default:
      return 'string';
  }
}
