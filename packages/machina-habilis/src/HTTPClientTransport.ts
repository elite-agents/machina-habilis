import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import {
  type JSONRPCMessage,
  JSONRPCMessageSchema,
} from '@modelcontextprotocol/sdk/types.js';

/**
 * Client transport for HTTP: this will connect to a server using simple HTTP POST requests
 * for both sending and receiving messages.
 *
 * Unlike SSEClientTransport, this implementation doesn't use streaming and simply
 * makes HTTP requests and parses JSON responses.
 */
export class HTTPClientTransport implements Transport {
  private _url: URL;
  private _requestInit?: RequestInit;

  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  constructor(url: URL, opts?: { requestInit?: RequestInit }) {
    this._url = url;
    this._requestInit = opts?.requestInit;
  }

  start(): Promise<void> {
    return Promise.resolve();
  }

  async close(): Promise<void> {
    this.onclose?.();
  }

  // send to MCP Server and parse response
  async send(message: JSONRPCMessage): Promise<void> {
    if ('method' in message && message.method.includes('notification')) {
      // Notifications are not expected to have a response
      return;
    }

    try {
      const headers = new Headers(this._requestInit?.headers);
      headers.set('content-type', 'application/json');
      const init = {
        ...this._requestInit,
        method: 'POST',
        headers,
        body: JSON.stringify(message),
      };

      const response = await fetch(this._url, init);

      if (!response.ok) {
        const text = await response.text().catch(() => null);
        throw new Error(
          `Error POSTing to endpoint (HTTP ${response.status}): ${text}`,
        );
      }

      // Parse the response as JSON and process it as a message if available
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        try {
          const data = await response.json();
          const responseMessage = JSONRPCMessageSchema.parse(data);
          this.onmessage?.(responseMessage);
        } catch (error) {
          this.onerror?.(
            new Error(`Failed to parse response as JSON RPC message: ${error}`),
          );
        }
      }
    } catch (error) {
      this.onerror?.(error as Error);
      throw error;
    }
  }
}
