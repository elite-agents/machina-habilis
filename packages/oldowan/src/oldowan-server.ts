import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { OldowanTool } from './oldowan-tool';
import type {
  HonoServerWithPort,
  IOldowanServer,
  OldowanSseServer,
} from './types';
import { createSseServerHono } from './transport/sse-hono';
import { Hono } from 'hono';
import { createRestServerHono } from './transport/rest-http';

// Port for the SSE server that handles MCP protocol communication
const DEFAULT_PORT = 8888;

export class OldowanServer implements IOldowanServer {
  private mcpServer: McpServer;
  private port: number;
  honoServer: HonoServerWithPort;

  constructor(
    name: string,
    version: string,
    opts: {
      tools: OldowanTool<any>[];
      port?: number;
    },
  ) {
    this.port = opts?.port ?? DEFAULT_PORT;

    this.mcpServer = new McpServer({
      name,
      version,
    });

    opts.tools.forEach((tool) => {
      this.mcpServer.tool(tool.name, tool.description, tool.schema, tool.call);
    });

    const sseServer = createSseServerHono({
      server: this.mcpServer,
    });

    const restApiServer = createRestServerHono({
      server: this.mcpServer,
    });

    const honoServer = new Hono();
    honoServer.route('', restApiServer);
    honoServer.route('', sseServer);

    this.honoServer = Object.assign(honoServer, { port: this.port });
  }
}
