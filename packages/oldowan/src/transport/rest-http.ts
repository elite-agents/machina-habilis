import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import {
  type JSONRPCMessage,
  JSONRPCMessageSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import type { MCPServerLike } from '../types';
import EventEmitter from 'events';

export class RESTServerTransportHono implements Transport {
  private _eventEmitter: EventEmitter;

  onclose?: () => void;
  onerror?: (error: Error) => void;
  // send to the mcp server
  onmessage?: (message: JSONRPCMessage) => void;

  constructor() {
    this._eventEmitter = new EventEmitter();
  }

  start(): Promise<void> {
    return Promise.resolve();
  }

  async handleMessage(message: unknown, c: Context): Promise<Response> {
    let parsedMessage: JSONRPCMessage;
    try {
      parsedMessage = JSONRPCMessageSchema.parse(message);
    } catch (error) {
      this.onerror?.(error as Error);
      throw error;
    }

    this.onmessage?.(parsedMessage); // sends to the MCP server, return is decoupled

    return new Promise((resolve) => {
      this._eventEmitter.once('message', (message: JSONRPCMessage) => {
        resolve(c.body(JSON.stringify(message)));
      });
    });
  }

  async close(): Promise<void> {
    this.onclose?.();
  }

  // received from MCP server
  async send(message: JSONRPCMessage): Promise<void> {
    this._eventEmitter.emit('message', message);
  }
}

export const createRestServerHono = (opts: { server: MCPServerLike }) => {
  const app = new Hono();

  app.use(
    '*',
    cors({
      origin: '*',
      allowMethods: ['POST', 'OPTIONS'],
      allowHeaders: ['Content-Type'],
    }),
  );

  app.post('/rpc', async (c) => {
    try {
      const transport = new RESTServerTransportHono();

      const body = await c.req.json();
      // connect the MCP Server to the Transport
      await opts.server.connect(transport);
      // post the message payload

      c.header('Content-Type', 'application/json');
      return transport.handleMessage(body, c);
    } catch (error) {
      console.error('RPC Error:', error);
      c.status(400);
      return c.json({ error: (error as Error).message });
    }
  });

  return app;
};
