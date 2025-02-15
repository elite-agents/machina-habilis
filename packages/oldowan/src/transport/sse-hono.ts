import type { Context } from 'hono';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import {
  type JSONRPCMessage,
  JSONRPCMessageSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { v4 as randomUUID } from 'uuid';
import { SSEStreamingApi } from 'hono/streaming';
/**
/**
 * Server transport for SSE: this will send messages over an SSE connection and receive messages from HTTP POST requests.
 *
 */
export class SSEServerTransportHono implements Transport {
  private _sseStream?: SSEStreamingApi;
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
    if (this._sseStream) {
      throw new Error(
        'SSEServerTransport already started! If using Server class, note that connect() calls start() automatically.',
      );
    }

    // Send the endpoint event
    this.stream.write(
      `event: endpoint\ndata: ${encodeURI(this._endpoint)}?sessionId=${this._sessionId}\n\n`,
    );

    this._sseStream = this.stream;

    this.stream.onAbort(() => {
      this._sseStream = undefined;
      this.onclose?.();
    });
  }

  /**
   * Handles incoming POST messages.
   *
   * This should be called when a POST request is made to send a message to the server.
   */
  async handlePostMessage(context: Context): Promise<void> {
    if (!this._sseStream) {
      const message = 'SSE connection not established';
      context.status(500);
      context.body(message);
      throw new Error(message);
    }

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
    await this._sseStream?.close();
    this._sseStream = undefined;
    this.onclose?.();
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if (!this._sseStream) {
      throw new Error('Not connected');
    }

    console.debug(`[Session ID: ${this._sessionId}] Sending message`, message);

    this._sseStream.writeSSE({
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
