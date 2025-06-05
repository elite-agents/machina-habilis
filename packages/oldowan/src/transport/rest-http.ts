import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import {
  type JSONRPCMessage,
  JSONRPCMessageSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import type { MCPServerLike, PaymentDetails } from '../types';
import EventEmitter from 'events';
import { verifyDidKeyEd25519JWT } from '@elite-agents/auth';

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
    this._eventEmitter.removeAllListeners('message');
    this.onclose?.();
  }

  // received from MCP server
  async send(message: JSONRPCMessage): Promise<void> {
    this._eventEmitter.emit('message', message);
  }
}

export const createRestServerHono = (opts: {
  server: MCPServerLike;
  paymentDetails?: PaymentDetails;
}) => {
  const app = new Hono();

  app.use(
    '*',
    cors({
      origin: '*',
      allowMethods: ['POST', 'OPTIONS'],
      allowHeaders: ['Content-Type'],
    }),
  );

  app.post('/mcp', async (c) => {
    try {
      const transport = new RESTServerTransportHono();

      const body = await c.req.json();

      if (body.method.includes('tools/call') && opts.paymentDetails) {
        if (opts.paymentDetails.type !== 'pay-per-use') {
          const authHeader = c.req.header('Authorization');

          const jwt = authHeader?.substring(7); // Remove "Bearer " prefix

          try {
            const jwtPayloadResult = await verifyDidKeyEd25519JWT(jwt ?? '');

            // TODO: use the jwtPayloadResult to validate the payment
          } catch (error) {
            return c.json({ error: (error as Error).message }, 402);
          }
        } else {
          const paymentHeader = c.req.header('X-PAYMENT');

          if (!paymentHeader) {
            return c.json({ error: 'Payment header is required' }, 402);
          }

          try {
            // TODO: process payment
          } catch (error) {
            return c.json({ error: (error as Error).message }, 402);
          }
        }
      }

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
