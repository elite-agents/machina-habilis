import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { TextContent } from '@modelcontextprotocol/sdk/types.js';
import {
  deriveToolUniqueName,
  type OldowanToolDefinition,
} from '@elite-agents/oldowan';
import { HTTPClientTransport } from './HTTPClientTransport';

/**
 * A server that coordinates calls to tools from MCP servers.
 *
 * This class is used to initialize the server with a pre-existing set of tools
 * or connect to multiple MCP servers to load all available tools.
 *
 * It can be optionally used by the MachinaAgent class to call tools.
 * This is useful in low latency environments where tools are called frequently.
 * The HabilisServer becomes the single point of contact for all tool calls.
 *
 * @example
 * ```typescript
 * const habilisServer = new HabilisServer();
 * await habilisServer.init(['https://mcp.example.com']);
 * ```
 *
 */
export class HabilisServer {
  mcpServers: string[] = [];

  toolsMap = new Map<string, OldowanToolDefinition>();

  /**
   * Initialize the server with a pre-existing set of tools.
   * This method is used when tools have already been loaded from cache,
   * avoiding the need to connect to MCP servers again.
   *
   * @param tools - Array of pre-loaded tool definitions
   */
  async initWithCache(tools: OldowanToolDefinition[]) {
    // Add tools to the existing toolsMap
    tools.forEach((tool) => {
      this.toolsMap.set(tool.id, tool);
    });
    // Add server URLs to the existing mcpServers array, avoiding duplicates
    tools.forEach((tool) => {
      if (!this.mcpServers.includes(tool.serverUrl)) {
        this.mcpServers.push(tool.serverUrl);
      }
    });
  }

  /**
   * Initialize the server by connecting to multiple MCP servers.
   * This method connects to each server and loads all available tools.
   * Use this when starting fresh without cached tools.
   *
   * @param mcpServers - Array of MCP server URLs to connect to
   */
  async init(mcpServers: string[]) {
    const mcpServerPromises = mcpServers.map((server) =>
      this.addMCPServer(server),
    );

    await Promise.all(mcpServerPromises);
  }

  async addMCPServer(url: string) {
    try {
      const client = new Client({
        name: url,
        version: '1.0.0',
      });

      console.log('Connecting to MCP server:', url);

      try {
        await client.connect(new HTTPClientTransport(new URL(url)));
        console.log('Connected to MCP server:', url);
      } catch (error) {
        let retries = 0;
        const maxRetries = 3;
        let lastError = error;
        while (retries < maxRetries) {
          console.warn('error ', lastError);
          console.warn(
            `Connection attempt to ${url} failed, error is ${lastError instanceof Error ? lastError.message : 'unknown'}, retrying...`,
          );
          try {
            await client.connect(new HTTPClientTransport(new URL(url)));
            break;
          } catch (err) {
            retries++;
            lastError = err;
            if (retries === maxRetries) {
              console.error(
                `Failed to connect to MCP server ${url} after ${maxRetries} attempts:`,
                lastError,
              );
              return [];
            }

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
          id: toolName,
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
    toolId: string,
    args: any,
    callback?: (message: string) => void,
  ): Promise<any> {
    const tool = this.toolsMap.get(toolId);
    if (!tool) {
      console.error(`Tool ${toolId} not found`);
      return `Tool ${toolId} not found`;
    }

    const url = tool.serverUrl;

    return HabilisServer.callToolWithRetries(tool, url, args, {
      retryCount: 0,
      callback,
    });
  }

  static async callToolWithRetries(
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

      await client.connect(new HTTPClientTransport(new URL(url)));

      const rawResult = await client.callTool(
        {
          name: tool.name,
          arguments: args,
        },
        undefined,
        {
          timeout: 5000,
        },
      );

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
      console.error(`Error calling tool ${tool.id}:`, error);

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
          return this.callToolWithRetries(tool, url, args, {
            retryCount: retryCount + 1,
            callback: retryCallback,
          });
        }

        return `Tool ${tool.id} failed after ${MAX_RETRIES + 1} attempts due to timeout`;
      }

      return `Failed to call tool ${tool.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
}
