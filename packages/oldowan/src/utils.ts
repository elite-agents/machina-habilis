import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { Hono } from 'hono';
import http from 'http';
import { SSEServerTransportHono } from './transport/sse-hono';
import { cors } from 'hono/cors';
import { streamSSE } from 'hono/streaming';

export const deriveToolUniqueName = (serverName: string, toolName: string) => {
  // Normalize server name by replacing any non-alphanumeric/hyphen characters with hyphens
  // This ensures the server name can be safely used as part of tool identifiers
  const normalizedServerName = `${serverName.replace(/[^a-zA-Z0-9-]+/g, '-')}`;
  const toolUniqueName = `${normalizedServerName}_${toolName}`;

  return toolUniqueName;
};

export const createSseServer = (opts: {
  server: Server;
  port: number;
  endpoint?: string;
}) => {
  const endpoint = opts.endpoint ?? '/sse';
  const { server } = opts;
  const activeTransports: Record<string, SSEServerTransport> = {};

  const httpServer = http.createServer(async (req, res) => {
    // Add CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.writeHead(204).end();
      return;
    }

    if (req.method === 'GET' && req.url === `/ping`) {
      res.writeHead(200).end('pong');

      return;
    }

    if (req.method === 'GET' && req.url === endpoint) {
      const transport = new SSEServerTransport('/messages', res);

      activeTransports[transport.sessionId] = transport;

      await server.connect(transport);

      await transport.send({
        jsonrpc: '2.0',
        method: 'sse/connection',
        params: { message: 'SSE Connection established' },
      });

      res.on('close', async () => {
        try {
          await server.close();
        } catch (error) {
          console.error('Error closing server:', error);
        }

        delete activeTransports[transport.sessionId];
      });

      return;
    }

    if (req.method === 'POST' && req.url?.startsWith('/messages')) {
      const sessionId = new URL(
        req.url,
        'https://example.com',
      ).searchParams.get('sessionId');

      if (!sessionId) {
        res.writeHead(400).end('No sessionId');

        return;
      }

      const activeTransport: SSEServerTransport | undefined =
        activeTransports[sessionId];

      if (!activeTransport) {
        res.writeHead(400).end('No active transport');

        return;
      }

      await activeTransport.handlePostMessage(req, res);

      return;
    }

    res.writeHead(404).end();
  });

  return httpServer;
};

type ServerLike = {
  connect: Server['connect'];
  close: Server['close'];
};

export const createSseServerHono = (opts: {
  server: ServerLike;
  port: number;
  endpoint?: string;
}) => {
  const endpoint = opts.endpoint ?? '/sse';
  const { server } = opts;
  const activeTransports: Record<string, SSEServerTransportHono> = {};
  const app = new Hono();

  app.use(
    '*',
    cors({
      origin: '*',
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
      exposeHeaders: ['Content-Length'],
    }),
  );

  // Preflight handler
  app.options('*', (c) => c.text('ok'));

  app.get('/ping', (c) => {
    console.log('ping request received');
    return c.text('pong');
  });

  app.use(`${endpoint}/*`, async (c, next) => {
    c.header('Content-Type', 'text/event-stream');
    c.header('Cache-Control', 'no-cache');
    c.header('Connection', 'keep-alive');
    await next();
  });

  app.get(endpoint, async (c) => {
    return streamSSE(c, async (stream) => {
      console.log('SSE connection received');
      const transport = new SSEServerTransportHono('/messages', stream);
      activeTransports[transport.sessionId] = transport;
      console.log(
        `SSE connection established for session ${transport.sessionId}`,
      );

      stream.onAbort(() => {
        console.log(`SSE connection closed for session ${transport.sessionId}`);
      });

      await server.connect(transport);

      await transport.send({
        jsonrpc: '2.0',
        method: 'sse/connection',
        params: { message: 'SSE Connection established' },
      });

      // Keep the connection open by returning a never-resolving promise
      return new Promise(() => {});
    });
  });

  app.post('/messages', async (c) => {
    const sessionId = new URL(
      c.req.url,
      'https://example.com',
    ).searchParams.get('sessionId');

    if (!sessionId) {
      c.status(400);
      return c.text('No sessionId');
    }

    const activeTransport = activeTransports[sessionId];
    if (!activeTransport) {
      c.status(400);
      return c.text('No active transport');
    }

    try {
      await activeTransport.handlePostMessage(c);
    } catch (error) {
      console.error('Error handling POST message:', error);
      c.status(400);
      return c.text('Error handling POST message');
    }

    c.status(202);
    return c.body('Accepted');
  });

  return app;
};
