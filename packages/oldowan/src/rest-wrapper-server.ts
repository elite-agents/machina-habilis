import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { RestApiWrappedOldowanTool } from './rest-wrapper-tool';
import { z } from 'zod';
import type {
  IOldowanServer,
  IRestApiWrappedOldowanTool,
  IRestApiWrappedOldowanToolRepository,
  ToolSchemaProperties,
} from './types';
import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createSseServerHono } from './transport/sse-hono';
import type { HonoServerWithPort } from './types';
import { createRestServerHono } from './transport/rest-http';
import { Hono } from 'hono';

const DEFAULT_PORT = 6004;
const DEFAULT_ENDPOINT = '/sse';

export class RestApiWrappedOldowanServer implements IOldowanServer {
  honoServer: HonoServerWithPort;
  mcpServer: Server;
  toolRepository: IRestApiWrappedOldowanToolRepository;

  constructor(
    toolRepository: IRestApiWrappedOldowanToolRepository,
    opts?: {
      port?: number;
      endpoint?: string;
    },
  ) {
    this.mcpServer = new Server(
      {
        name: 'rest-wrapper-oldowan-server',
        version: '0.1.0',
      },
      { capabilities: { tools: {} } },
    );

    this.toolRepository = toolRepository;

    this.mcpServer.setRequestHandler(
      ListToolsRequestSchema,
      this.listTools.bind(this),
    );

    const callToolHandler = async (request: any) => {
      const tool = await this.toolRepository.findOne(request.params.name);

      if (!tool) {
        throw new Error(`Tool ${request.params.name} not found`);
      }

      return this.callTool(tool, request.params.arguments ?? {});
    };

    this.mcpServer.setRequestHandler(CallToolRequestSchema, callToolHandler);

    const port = opts?.port ?? DEFAULT_PORT;
    const endpoint = opts?.endpoint ?? DEFAULT_ENDPOINT;

    const sseServer = createSseServerHono({
      server: this.mcpServer,
      endpoint,
    });

    const restApiServer = createRestServerHono({
      server: this.mcpServer,
    });

    const honoServer = new Hono();
    honoServer.route('', restApiServer);
    honoServer.route('', sseServer);

    this.honoServer = Object.assign(honoServer, { port });
  }

  addTool(tool: RestApiWrappedOldowanTool) {
    return this.toolRepository.create(tool);
  }

  async listTools() {
    const tools = await this.toolRepository.find();
    return { tools };
  }

  async callTool(tool: IRestApiWrappedOldowanTool, args?: Record<string, any>) {
    // We probably need a better schema for this!
    // This feels like parsing a string back to an object
    const parsedArgs = z
      .record(
        z.union([
          z.string(),
          z.number(),
          z.boolean(),
          z.record(z.any()),
          z.array(z.any()),
        ]),
      )
      .parse(args) as Record<string, any>;

    const { method, url, parameters, requestBody, headers } =
      tool.endpointDefinition;

    // Process the URL path with path parameters
    let processedUrl = url;
    const pathParams: Record<string, any> = {};
    const queryParams: Record<string, any> = {};

    // Extract path and query parameters from the OpenAPI parameters
    if (parameters) {
      for (const param of parameters) {
        if (param.in === 'path' && parsedArgs[param.name] !== undefined) {
          pathParams[param.name] = parsedArgs[param.name];
          // Replace path parameters in the URL
          processedUrl = processedUrl.replace(
            `{${param.name}}`,
            parsedArgs[param.name],
          );
        } else if (
          param.in === 'query' &&
          parsedArgs[param.name] !== undefined
        ) {
          queryParams[param.name] = parsedArgs[param.name];
        }
      }
    }

    // Add query parameters to the URL
    if (Object.keys(queryParams).length > 0) {
      const queryString = new URLSearchParams();
      for (const [key, value] of Object.entries(queryParams)) {
        queryString.append(key, value.toString());
      }
      processedUrl = `${processedUrl}?${queryString.toString()}`;
    }

    // Process request body if it exists and method is not GET
    let body = undefined;
    if (method !== 'GET' && requestBody && requestBody.content) {
      // Get the first content type from the requestBody
      const contentType = Object.keys(requestBody.content)[0];

      // Extract request body properties from parsed args
      const bodyParams: Record<string, any> = {};

      // Create a list of path and query param names for exclusion
      const paramNames = new Set<string>();
      if (parameters) {
        for (const param of parameters) {
          if (param.in === 'path' || param.in === 'query') {
            paramNames.add(param.name);
          }
        }
      }

      // Include in body any args that aren't path or query params
      for (const [key, value] of Object.entries(parsedArgs)) {
        if (!paramNames.has(key)) {
          bodyParams[key] = value;
        }
      }

      // Only set body if we have parameters
      if (Object.keys(bodyParams).length > 0) {
        body = JSON.stringify(bodyParams);
      }
    }

    // Combine default headers with endpoint headers
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(headers || {}),
    };

    const resp = await fetch(processedUrl, {
      method,
      headers: requestHeaders,
      body,
    });

    const transformer = tool.endpointDefinition.transformFn;
    let transformed = await resp.json();

    if (transformer) {
      const transformerFn = new Function(
        'response',
        `return (${transformer})(response);`,
      );
      transformed = transformerFn(transformed);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(transformed, null, 2),
        },
      ],
    };
  }
}
