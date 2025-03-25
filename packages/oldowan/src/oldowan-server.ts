import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { OldowanTool } from './oldowan-tool';
import type { HonoServerWithPort, IOldowanServer } from './types';
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

    const restApiServer = createRestServerHono({
      server: this.mcpServer,
    });

    this.honoServer = Object.assign(restApiServer, { port: this.port });
  }
}
