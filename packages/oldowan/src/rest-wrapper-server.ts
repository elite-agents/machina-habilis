import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { RestApiWrappedOldowanTool } from './rest-wrapper-tool';
import { z } from 'zod';
import type {
  IOldowanServer,
  IRestApiWrappedOldowanTool,
  IRestApiWrappedOldowanToolRepository,
  OldowanSseServer,
  ToolSchemaProperties,
} from './types';
import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createSseServerHono } from './utils';
import type { Hono } from 'hono';

const DEFAULT_PORT = 6004;
const DEFAULT_ENDPOINT = '/sse';

export class RestApiWrappedOldowanServer implements IOldowanServer {
  sseServer: OldowanSseServer;
  restApiServer: Hono;
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

    this.restApiServer = createSseServerHono({
      server: this.mcpServer,
      port: opts?.port ?? DEFAULT_PORT,
      endpoint: opts?.endpoint ?? DEFAULT_ENDPOINT,
    });

    this.sseServer = {
      fetch: this.restApiServer.fetch,
      port: opts?.port ?? DEFAULT_PORT,
    };
  }

  addTool(tool: RestApiWrappedOldowanTool) {
    return this.toolRepository.create(tool);
  }

  async listTools() {
    const tools = await this.toolRepository.find();
    return { tools };
  }

  async callTool(
    tool: IRestApiWrappedOldowanTool,
    args: Record<string, unknown>,
  ) {
    const parsedArgs = z
      .object(
        Object.entries(
          tool.inputSchema.properties as ToolSchemaProperties,
        ).reduce(
          (acc, [key, value]) => ({
            ...acc,
            [key]: z[value.type](),
          }),
          {},
        ),
      )
      .parse(args) as Record<string, any>;

    const { method, url, pathParams, queryParams, body, headers } =
      tool.endpointDefinition;

    // Process path parameters
    let processedUrl = url;
    if (pathParams) {
      for (const param of Object.keys(pathParams)) {
        processedUrl = processedUrl.replace(`:${param}`, parsedArgs[param]);
      }
    }

    // Process query parameters
    const query = new URLSearchParams();
    if (queryParams) {
      for (const param of Object.keys(queryParams)) {
        if (parsedArgs[param] !== undefined) {
          query.append(param, parsedArgs[param]);
        }
      }
    }
    const queryString = query.toString();
    if (queryString) {
      processedUrl += `?${queryString}`;
    }

    // Process request body
    let requestBody = undefined;
    if (body && method !== 'GET') {
      requestBody = JSON.stringify(
        Object.entries(body).reduce(
          (acc, [key]) => {
            acc[key] = parsedArgs[key];
            return acc;
          },
          {} as Record<string, any>,
        ),
      );
    }

    const response = await fetch(processedUrl, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: requestBody,
    });

    // TODO: add transformer code here

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.json(), null, 2),
        },
      ],
    };
  }
}
