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

  mcpServers: string[] = [];

  toolsMap = new Map<string, OldowanToolDefinition>();

  recallContextTool?: string;
  addKnowledgeTool?: string;

  constructor(memoryServerUrl: string) {
    this.memoryServerUrl = memoryServerUrl;
  }

  async init(mcpServers: string[]) {
    console.log('Initializing Habilis Server with the following MCP servers:', [
      this.memoryServerUrl,
      ...mcpServers,
    ]);

    const mcpServerPromises = [
      ...mcpServers.map((server) => this.addMCPServer(server)),
      this.addMCPServer(this.memoryServerUrl).then((memoryServerTools) => {
        console.log('memoryServerTools', memoryServerTools);

        this.recallContextTool = memoryServerTools.find((tool) =>
          tool.includes(GET_CONTEXT_FROM_QUERY_TOOL_NAME),
        );

        this.addKnowledgeTool = memoryServerTools.find((tool) =>
          tool.includes(INSERT_KNOWLEDGE_TOOL_NAME),
        );

        return memoryServerTools;
      }),
    ];

    await Promise.all(mcpServerPromises);

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

      this.mcpServers.push(url);

      // disconnect from the client
      await client.close();

      return toolsAdded;
    } catch (error) {
      console.error(`Unexpected error adding MCP server ${url}:`, error);
      return [];
    }
  }

  async callTool(
    toolUniqueName: string,
    args: any,
    callback?: (message: string) => void,
  ): Promise<any> {
    const tool = this.toolsMap.get(toolUniqueName);
    if (!tool) {
      console.error(`Tool ${toolUniqueName} not found`);
      return `Tool ${toolUniqueName} not found`;
    }

    const url = tool.serverUrl;

    return this.callToolWithRetries(toolUniqueName, tool, url, args, {
      retryCount: 0,
      callback,
    });
  }

  async callToolWithRetries(
    toolUniqueName: string,
    tool: OldowanToolDefinition,
    url: string,
    args: any,
    opts: {
      retryCount?: number;
      callback?: (message: string) => void;
    } = {},
  ): Promise<any> {
    const MAX_RETRIES = 2; // Up to 2 retries (3 attempts total)
    const { retryCount = 0, callback: retryCallback } = opts;

    // Establish a new connection for this specific tool call
    try {
      const client = new Client({
        name: url,
        version: '1.0.0',
      });

      console.log('Connecting to MCP server:', url);

      await client.connect(new SSEClientTransport(new URL(url)));

      console.log('Connected to MCP server:', url);

      console.log('calling tool', toolUniqueName, tool.name, args);

      const rawResult = await client.callTool({
        name: tool.name,
        arguments: args,
      });

      const result = rawResult.content as TextContent[];

      // disconnect from the client
      await client.close();

      if (result[0].text.includes('Error')) {
        return `The tool has failed with the following error: ${result[0].text}`;
      } else {
        try {
          return JSON.parse(result[0].text);
        } catch {
          return result[0].text;
        }
      }
    } catch (error: unknown) {
      console.error(`Error calling tool ${toolUniqueName}:`, error);

      // Check if error is a timeout error (code -32001)
      if (error instanceof Error && 'code' in error && error.code === -32001) {
        if (retryCount < MAX_RETRIES) {
          console.log(
            `Timeout detected. Retrying (${retryCount + 1}/${MAX_RETRIES})...`,
          );

          // Notify via callback if provided
          if (retryCallback) {
            retryCallback(
              `Timeout detected. Retrying (${retryCount + 1}/${MAX_RETRIES})...`,
            );
          }

          // Exponential backoff
          const delay = 1000 * Math.pow(2, retryCount);
          await new Promise((resolve) => setTimeout(resolve, delay));

          // Retry with incremented counter
          return this.callToolWithRetries(toolUniqueName, tool, url, args, {
            retryCount: retryCount + 1,
            callback: retryCallback,
          });
        }

        return `Tool ${toolUniqueName} failed after ${MAX_RETRIES + 1} attempts due to timeout`;
      }

      return `Failed to call tool ${toolUniqueName}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
}
