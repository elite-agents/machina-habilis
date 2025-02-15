import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { RestApiWrappedOldowanTool } from './rest-wrapper-tool';
import { z } from 'zod';
import type {
  IOldowanServer,
  OldowanSseServer,
  ToolSchemaProperties,
} from './types';
import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createSseServerHono } from './utils';

const DEFAULT_PORT = 6004;
const DEFAULT_ENDPOINT = '/sse';

export class RestApiWrappedOldowanServer implements IOldowanServer {
  sseServer: OldowanSseServer;
  mcpServer: Server;
  tools: Map<string, RestApiWrappedOldowanTool> = new Map();

  updateServerWithNewTool?: (
    tool: RestApiWrappedOldowanTool,
  ) => void | Promise<void>;

  constructor(
    tools: RestApiWrappedOldowanTool[],
    opts: {
      updateServerWithNewTool?: (
        tool: RestApiWrappedOldowanTool,
      ) => void | Promise<void>;
      port?: number;
      endpoint?: string;
    },
  ) {
    this.mcpServer = new Server({
      name: 'rest-wrapper-oldowan-server',
      version: '0.1.0',
    });

    this.mcpServer.setRequestHandler(ListToolsRequestSchema, this.listTools);

    this.mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
      const tool = this.tools.get(request.params.name);

      if (!tool) {
        throw new Error(`Tool ${request.params.name} not found`);
      }

      return this.callTool(tool, request.params.arguments ?? {});
    });

    tools.forEach((tool) => {
      this.addTool(tool);
    });

    this.updateServerWithNewTool = opts.updateServerWithNewTool;

    this.sseServer = createSseServerHono({
      server: this.mcpServer,
      port: opts.port ?? DEFAULT_PORT,
      endpoint: opts.endpoint ?? DEFAULT_ENDPOINT,
    });
  }

  addTool(tool: RestApiWrappedOldowanTool) {
    this.tools.set(tool.uniqueName, tool);
    this.updateServerWithNewTool?.(tool);
  }

  listTools() {
    return { tools: Array.from(this.tools.values()) };
  }

  async callTool(
    tool: RestApiWrappedOldowanTool,
    args: Record<string, unknown>,
  ) {
    const parsedArgs = z
      .object(
        Object.entries(
          tool.inputSchema.properties as ToolSchemaProperties,
        ).reduce(
          (acc, [key, value]) => ({
            ...acc,
            [key]: z[value.type]().describe(value.description),
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
