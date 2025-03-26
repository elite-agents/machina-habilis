import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { TextContent } from '@modelcontextprotocol/sdk/types.js';
import {
  deriveToolUniqueName,
  type OldowanToolDefinition,
} from '@elite-agents/oldowan';
import { HTTPClientTransport } from './HTTPClientTransport';

/**
 * A server that coordinates calls to tools from Model Context Protocol (MCP) servers.
 *
 * This class is responsible for:
 * - Managing connections to MCP servers
 * - Loading and caching available tools
 * - Providing a unified interface for tool execution
 * - Handling retry logic and error recovery for tool calls
 *
 * It can be optionally used by the MachinaAgent class to call tools.
 * In low latency environments where tools are called frequently,
 * the HabilisServer becomes the single point of contact for all tool calls.
 *
 * @example
 * ```typescript
 * // Initialize with MCP server URLs
 * const habilisServer = new HabilisServer();
 * await habilisServer.init(['https://mcp.example.com']);
 *
 * // Call a tool
 * const result = await habilisServer.callTool('tool-id', { param: 'value' });
 * ```
 */
export class HabilisServer {
  /** Array of MCP server URLs that the server is connected to */
  mcpServers: string[] = [];

  /** Map of tool IDs to their definitions */
  toolsMap = new Map<string, OldowanToolDefinition>();

  /**
   * Initialize the server with a pre-existing set of tools.
   *
   * This method is used when tools have already been loaded from cache,
   * avoiding the need to connect to MCP servers again. It populates the
   * internal tools map and records server URLs from the tool definitions.
   *
   * @param tools - Array of pre-loaded tool definitions
   * @returns A promise that resolves when all tools have been added
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
   *
   * This method connects to each specified server and loads all available tools.
   * Use this when starting fresh without cached tools. Each server connection
   * is established in parallel.
   *
   * @param mcpServers - Array of MCP server URLs to connect to
   * @returns A promise that resolves when all servers have been connected and their tools loaded
   */
  async init(mcpServers: string[]) {
    const mcpServerPromises = mcpServers.map((server) =>
      this.addMCPServer(server),
    );

    await Promise.all(mcpServerPromises);
  }

  /**
   * Adds a new MCP server
   *
   * This static method handles the server connection process, including:
   * - Establishing connection with retry logic
   * - Retrieving server version information
   * - Listing and transforming available tools
   * - Closing the connection when finished
   *
   * @param url - URL of the MCP server to add
   * @returns A promise that resolves with an object containing server information and added tools
   * @throws Error if connection, version retrieval, or tool listing fails after retries
   */
  static async addMCPServer(url: string) {
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
              throw lastError;
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
        throw error;
      }

      const serverName = versionInfo?.name ?? url;

      let tools;
      try {
        tools = (await client.listTools()).tools;
      } catch (error) {
        console.error(`Failed to list tools from MCP server ${url}:`, error);
        throw error;
      }

      const toolsAdded = tools.map((tool) => {
        const toolName = deriveToolUniqueName(serverName, tool.name);
        const oldowanToolDefinition: OldowanToolDefinition = {
          ...tool,
          id: toolName,
          serverUrl: url,
        };

        return oldowanToolDefinition;
      });

      // disconnect from the client
      await client.close();

      const serverId = `${serverName.replace(/[^a-zA-Z0-9-]+/g, '-')}`;

      const serverInfo = {
        id: serverId,
        url: url,
        name: serverName,
        version: versionInfo?.version ?? 'Unknown',
        createdAt: Date.now(),
      };

      return { serverInfo, toolsAdded };
    } catch (error) {
      console.error(`Unexpected error adding MCP server ${url}:`, error);
      throw error;
    }
  }

  /**
   * Instance method to add an MCP server to this HabilisServer instance.
   *
   * This method utilizes the static addMCPServer method to connect to the server,
   * then adds the retrieved tools to this instance's toolsMap and records the server URL.
   *
   * @param url - URL of the MCP server to add
   * @returns A promise that resolves with server information and added tools
   * @throws Error if the static addMCPServer method throws an error
   */
  async addMCPServer(url: string) {
    const result = await HabilisServer.addMCPServer(url);

    result.toolsAdded.forEach((tool) => {
      this.toolsMap.set(tool.id, tool);
    });

    this.mcpServers.push(url);

    return result;
  }

  /**
   * Calls a tool by its ID with the provided arguments.
   *
   * This method looks up the tool in the toolsMap, then delegates the actual
   * call to the static callToolWithRetries method. It includes error handling
   * for tools that cannot be found.
   *
   * @param toolId - Unique identifier of the tool to call
   * @param args - Arguments to pass to the tool
   * @param callback - Optional callback function to receive progress updates
   * @returns A promise that resolves with the tool's result or an error message
   */
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

  /**
   * Calls a tool with retry logic for handling connection issues and timeouts.
   *
   * This static method:
   * - Establishes a new connection for each tool call
   * - Executes the tool call with a timeout
   * - Handles error conditions including timeouts
   * - Implements exponential backoff for retries
   * - Parses and returns results appropriately
   *
   * @param tool - Tool definition to call
   * @param url - URL of the MCP server that hosts the tool
   * @param args - Arguments to pass to the tool
   * @param opts - Options for the call including retry count and callback
   * @returns A promise that resolves with the tool's result or an error message
   */
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
