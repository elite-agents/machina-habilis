import type { Context } from 'hono';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import {
  type JSONRPCMessage,
  JSONRPCMessageSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { v4 as randomUUID } from 'uuid';
import { SSEStreamingApi, streamSSE } from 'hono/streaming';
import type { MCPServerLike } from '../types';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

/**
 * Server transport for SSE: this will send messages over an SSE connection and receive messages from HTTP POST requests.
 *
 */
export class SSEServerTransportHono implements Transport {
  private _sessionId: string;

  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  /**
   * Creates a new SSE server transport, which will direct the client to POST messages to the relative or absolute URL identified by `_endpoint`.
   */
  constructor(
    private _endpoint: string,
    private stream: SSEStreamingApi,
  ) {
    this._sessionId = randomUUID();
  }

  /**
   * Handles the initial SSE connection request.
   *
   * This should be called when a GET request is made to establish the SSE stream.
   */
  async start(): Promise<void> {
    // Send the endpoint event
    this.stream.writeSSE({
      event: 'endpoint',
      data: `${encodeURI(this._endpoint)}?sessionId=${this._sessionId}`,
    });

    this.stream.onAbort(() => {
      this.onclose?.();
    });
  }

  /**
   * Handles incoming POST messages.
   *
   * This should be called when a POST request is made to send a message to the server.
   */
  async handlePostMessage(context: Context): Promise<void> {
    let body: string | unknown;
    try {
      const ct = context.req.header('content-type');

      if (ct !== 'application/json') {
        throw new Error(`Unsupported content-type: ${ct}`);
      }

      body = await context.req.json();
    } catch (error) {
      context.status(400);
      context.body(String(error));
      this.onerror?.(error as Error);
      return;
    }

    await this.handleMessage(
      typeof body === 'string' ? JSON.parse(body) : body,
    );
  }

  /**
   * Handle a client message, regardless of how it arrived. This can be used to inform the server of messages that arrive via a means different than HTTP POST.
   */
  async handleMessage(message: unknown): Promise<void> {
    let parsedMessage: JSONRPCMessage;
    try {
      parsedMessage = JSONRPCMessageSchema.parse(message);
    } catch (error) {
      this.onerror?.(error as Error);
      throw error;
    }

    this.onmessage?.(parsedMessage);
  }

  async close(): Promise<void> {
    await this.stream.close();
    this.onclose?.();
  }

  async send(message: JSONRPCMessage): Promise<void> {
    console.debug(`[Session ID: ${this._sessionId}] Sending message`, message);

    this.stream.writeSSE({
      event: 'message',
      data: JSON.stringify(message),
    });
  }

  /**
   * Returns the session ID for this transport.
   *
   * This can be used to route incoming POST requests.
   */
  get sessionId(): string {
    return this._sessionId;
  }
}

export const createSseServerHono = (opts: {
  server: MCPServerLike;
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
    const { writable, readable } = new TransformStream();
    const stream = new SSEStreamingApi(writable, readable);

    console.log('SSE connection received');
    const transport = new SSEServerTransportHono('/messages', stream);
    activeTransports[transport.sessionId] = transport;
    console.log(
      `SSE connection established for session ${transport.sessionId}`,
    );

    await server.connect(transport);

    await transport.send({
      jsonrpc: '2.0',
      method: 'sse/connection',
      params: { message: 'SSE Connection established' },
    });

    c.executionCtx.waitUntil(
      new Promise<void>((resolve) => {
        stream.onAbort(() => {
          console.log(
            `SSE connection closed for session ${transport.sessionId}`,
          );
          delete activeTransports[transport.sessionId];
          resolve();
        });
      }),
    );

    return c.newResponse(stream.responseReadable);
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
