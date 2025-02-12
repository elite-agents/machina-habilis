import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from './SSEClientTransport';
import type { TextContent } from '@modelcontextprotocol/sdk/types.js';
import type { IHabilisServer, OldowanToolDefinition } from './types';

export class HabilisServer implements IHabilisServer {
  memoryServerUrl: string;

  mcpClients: {
    [url: string]: Client;
  } = {};

  toolsMap = new Map<string, OldowanToolDefinition>();

  constructor(memoryServerUrl: string) {
    this.memoryServerUrl = memoryServerUrl;
  }

  async init(mcpServers: string[]) {
    await this.addMCPServer(this.memoryServerUrl);

    for (const server of mcpServers) {
      await this.addMCPServer(server);
    }
  }

  async addMCPServer(url: string) {
    const client = new Client({
      name: url,
      version: '1.0.0',
    });

    await client.connect(new SSEClientTransport(new URL(url)));

    const versionInfo = await client.getServerVersion();

    const serverName = versionInfo?.name ?? url;

    const { tools } = await client.listTools();

    // Normalize server name by replacing any non-alphanumeric/hyphen characters with underscores
    // This ensures the server name can be safely used as part of tool identifiers
    const normalizedServerName = `${serverName.replace(
      /[^a-zA-Z0-9-]+/g,
      '_'
    )}`;

    for (const tool of tools) {
      this.toolsMap.set(`${normalizedServerName}/${tool.name}`, {
        ...tool,
        uniqueName: `${normalizedServerName}/${tool.name}`,
        serverUrl: url,
      });
    }
  }

  async callTool(toolUniqueName: string, args: any): Promise<any> {
    const tool = this.toolsMap.get(toolUniqueName);
    if (!tool) {
      return `Tool ${toolUniqueName} not found`;
    }

    const client = this.mcpClients[tool.serverUrl];
    if (!client) {
      return `Unable to call tool ${toolUniqueName} because the client for ${tool.serverUrl} not found`;
    }

    const result = (
      await client.callTool({
        name: tool.name,
        arguments: args,
      })
    ).content as TextContent[];

    if (result[0].text.includes('Error')) {
      return `The tool has failed with the following error: ${result[0].text}`;
    } else {
      try {
        return JSON.parse(result[0].text);
      } catch {
        return result[0].text;
      }
    }
  }
}
