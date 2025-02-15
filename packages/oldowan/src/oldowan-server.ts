import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { OldowanTool } from './oldowan-tool';
import type { IOldowanServer, OldowanSseServer } from './types';
import { createSseServerHono } from './utils';

// Port for the SSE server that handles MCP protocol communication
const DEFAULT_PORT = 8888;

export class OldowanServer implements IOldowanServer {
  private mcpServer: McpServer;
  private port: number;
  sseServer: OldowanSseServer;

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

    this.sseServer = createSseServerHono({
      server: this.mcpServer,
      port: this.port,
    });
  }
}
