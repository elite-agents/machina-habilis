import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { startSSEServer } from 'mcp-proxy';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { OldowanTool } from './oldowan-tool';

// Port for the SSE server that handles MCP protocol communication
const DEFAULT_SSE_PORT = 8889;
// Port for the Hono proxy server that forwards requests to the SSE server
const DEFAULT_PROXY_PORT = 8888;

export class OldowanServer {
  private server: McpServer;
  private proxy: Hono;
  private proxyPort: number;
  private ssePort: number;

  constructor(
    name: string,
    version: string,
    opts: {
      tools: OldowanTool<any>[];
      proxyPort?: number;
      ssePort?: number;
    }
  ) {
    this.proxyPort = opts?.proxyPort ?? DEFAULT_PROXY_PORT;
    this.ssePort = opts?.ssePort ?? DEFAULT_SSE_PORT;

    this.server = new McpServer({
      name,
      version,
    });

    opts.tools.forEach((tool) => {
      this.server.tool(tool.name, tool.description, tool.schema, tool.call);
    });

    this.proxy = new Hono();

    this.proxy.use(
      '*',
      cors({
        origin: '*',
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization'],
        exposeHeaders: ['Content-Length'],
      })
    );

    this.proxy.get('/health', (c) => {
      return c.text('OK');
    });

    this.proxy.all('*', async (c) => {
      const url = new URL(c.req.url);
      const targetUrl = `http://localhost:${this.ssePort}${url.pathname}${url.search}`;

      try {
        const response = await fetch(targetUrl, {
          method: c.req.method,
          headers: c.req.raw.headers,
          body: ['GET', 'HEAD'].includes(c.req.method)
            ? undefined
            : await c.req.blob(),
        });

        // Forward the response headers
        const headers = new Headers();
        response.headers.forEach((value, key) => {
          headers.set(key, value);
        });

        return new Response(response.body, {
          status: response.status,
          headers,
        });
      } catch (error) {
        console.error('Proxy error:', error);
        return new Response('Proxy Error', { status: 502 });
      }
    });
  }

  private async start() {
    await startSSEServer({
      port: this.ssePort,
      endpoint: '/sse',
      createServer: async () => {
        console.log(`SSE server connected on port ${this.ssePort}`);
        return this.server;
      },
    });
  }

  async getProxy() {
    await this.start();

    console.log(`Proxy server started listening on port ${this.proxyPort}`);

    return {
      port: this.proxyPort,
      fetch: this.proxy.fetch,
    };
  }
}
