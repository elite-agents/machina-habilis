import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from './SSEClientTransport';
import type { TextContent } from '@modelcontextprotocol/sdk/types.js';
import type { IHabilisServer, OldowanToolDefinition } from './types';
import {
  GET_CONTEXT_FROM_QUERY_TOOL_NAME,
  INSERT_KNOWLEDGE_TOOL_NAME,
} from './constants';
import { deriveToolUniqueName } from '@elite-agents/oldowan';

export class HabilisServer implements IHabilisServer {
  memoryServerUrl: string;

  mcpClients: {
    [url: string]: Client;
  } = {};

  toolsMap = new Map<string, OldowanToolDefinition>();

  recallContextTool?: string;
  addKnowledgeTool?: string;

  constructor(memoryServerUrl: string) {
    this.memoryServerUrl = memoryServerUrl;
  }

  private async handleConnectionError(
    error: Error,
    client: Client,
    url: string,
  ) {
    console.error(`Error from MCP server ${url}:`, error);
    console.log(
      `Disconnected from MCP server ${url}, attempting to reconnect...`,
    );

    let reconnected = false;
    while (!reconnected) {
      try {
        await client.connect(new SSEClientTransport(new URL(url)));
        console.log(`Successfully reconnected to MCP server ${url}`);
        reconnected = true;
      } catch (error) {
        console.error(`Failed to reconnect to MCP server ${url}:`, error);
        // Wait 5 seconds before trying again
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  async init(mcpServers: string[]) {
    console.log('Initializing Habilis Server with the following MCP servers:', [
      this.memoryServerUrl,
      ...mcpServers,
    ]);

    const memoryServerTools = await this.addMCPServer(this.memoryServerUrl);

    console.log('memoryServerTools', memoryServerTools);

    this.recallContextTool = memoryServerTools.find((tool) =>
      tool.includes(GET_CONTEXT_FROM_QUERY_TOOL_NAME),
    );

    this.addKnowledgeTool = memoryServerTools.find((tool) =>
      tool.includes(INSERT_KNOWLEDGE_TOOL_NAME),
    );

    for (const server of mcpServers) {
      await this.addMCPServer(server);
    }

    console.log('Habilis Server initialized with the following MCP servers:', [
      this.memoryServerUrl,
      ...mcpServers,
    ]);
    console.log('Tools Map:', this.toolsMap);
  }
  async addMCPServer(url: string) {
    try {
      const client = new Client({
        name: url,
        version: '1.0.0',
      });

      console.log('Connecting to MCP server:', url);

      try {
        await client.connect(new SSEClientTransport(new URL(url)));
        console.log('Connected to MCP server:', url);

        // Set up error handlers
        if (client.transport) {
          client.transport.onerror = (error) => {
            this.handleConnectionError(error, client, url);
          };
          client.transport.onclose = () => {
            console.log('Disconnected from MCP server:', url);
            this.handleConnectionError(new Error('Disconnected'), client, url);
          };
        }

        client.onerror = (error) => {
          this.handleConnectionError(error, client, url);
        };

        client.onclose = () => {
          console.log('Disconnected from MCP server:', url);
          this.handleConnectionError(new Error('Disconnected'), client, url);
        };
      } catch (error) {
        let retries = 0;
        const maxRetries = 3;
        while (retries < maxRetries) {
          try {
            await client.connect(new SSEClientTransport(new URL(url)));
            break;
          } catch (err) {
            retries++;
            if (retries === maxRetries) {
              console.error(
                `Failed to connect to MCP server ${url} after ${maxRetries} attempts:`,
                error,
              );
              return [];
            }
            console.warn(`Connection attempt ${retries} failed, retrying...`);
            await new Promise((resolve) => setTimeout(resolve, 1000 * retries)); // Exponential backoff
          }
        }
      }

      let versionInfo;
      try {
        versionInfo = await client.getServerVersion();
      } catch (error) {
        console.error(
          `Failed to get version info from MCP server ${url}:`,
          error,
        );
        return [];
      }

      const serverName = versionInfo?.name ?? url;

      let tools;
      try {
        tools = (await client.listTools()).tools;
      } catch (error) {
        console.error(`Failed to list tools from MCP server ${url}:`, error);
        return [];
      }

      const toolsAdded = tools.map((tool) => {
        const toolName = deriveToolUniqueName(serverName, tool.name);

        this.toolsMap.set(toolName, {
          ...tool,
          uniqueName: toolName,
          serverUrl: url,
        });

        return toolName;
      });

      this.mcpClients[url] = client;

      return toolsAdded;
    } catch (error) {
      console.error(`Unexpected error adding MCP server ${url}:`, error);
      return [];
    }
  }

  async callTool(toolUniqueName: string, args: any): Promise<any> {
    const tool = this.toolsMap.get(toolUniqueName);
    if (!tool) {
      console.error(`Tool ${toolUniqueName} not found`);
      return `Tool ${toolUniqueName} not found`;
    }

    const client = this.mcpClients[tool.serverUrl];
    if (!client) {
      console.error(
        `Unable to call tool ${toolUniqueName} because the client for ${tool.serverUrl} not found`,
      );
      return `Unable to call tool ${toolUniqueName} because the client for ${tool.serverUrl} not found`;
    }

    console.log('calling tool', toolUniqueName, tool.name, args);

    const rawResult = await client.callTool({
      name: tool.name,
      arguments: args,
    });

    const result = rawResult.content as TextContent[];

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
