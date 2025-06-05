import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import {
  type JSONRPCMessage,
  JSONRPCMessageSchema,
} from '@modelcontextprotocol/sdk/types.js';
import {
  deriveDidIdentifierFromEd25519KeyPair,
  generateDidKeyEd25519JWT,
} from '@elite-agents/auth';

/**
 * Implements the {@link Transport} interface for client-side communication to MCP servers
 * using authenticated HTTP POST requests. This transport sends and receives JSON-RPC messages.
 *
 * It authenticates requests to `tools/call` methods by generating a DID Key JWT
 * using the provided Ed25519 keypair.
 *
 * This transport does not use streaming; it makes individual HTTP requests for each message
 * and expects a JSON response.
 */
export class HTTPClientEd25519AuthenticatedTransport implements Transport {
  private _url: URL;
  private _keypair: CryptoKeyPair;
  private _requestInit?: RequestInit;
  private _didIdentifier?: string;

  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  /**
   * Constructs an instance of HTTPClientAuthenticatedTransport.
   *
   * @param url The URL of the MCP server endpoint.
   * @param opts Configuration options for the transport.
   * @param opts.requestInit Optional `RequestInit` object for customizing fetch requests (e.g., adding custom headers).
   * @param opts.keypair The Ed25519 `CryptoKeyPair` used to generate a DID Key for authenticating `tools/call` requests.
   */
  constructor(
    url: URL,
    opts: {
      requestInit?: RequestInit;
      keypair: CryptoKeyPair;
    },
  ) {
    this._url = url;
    this._keypair = opts.keypair;
    this._requestInit = opts?.requestInit;

    this._deriveDidIdentifier();
  }

  /**
   * Derives the DID (Decentralized Identifier) key string from the Ed25519 public key.
   * The DID is used in the 'kid' (Key ID) header of the JWT for `tools/call` requests.
   * Stores the derived identifier in `this._didIdentifier`.
   *
   * @private
   * @returns A promise that resolves to the derived DID identifier string.
   */
  private async _deriveDidIdentifier() {
    const didIdentifier = await deriveDidIdentifierFromEd25519KeyPair(
      this._keypair,
    );

    this._didIdentifier = didIdentifier;

    return didIdentifier;
  }

  /**
   * Initializes the transport. For this HTTP-based transport, no specific setup is required
   * beyond what's done in the constructor.
   *
   * @returns A promise that resolves when the transport is ready.
   */
  async start(): Promise<void> {
    return Promise.resolve();
  }

  /**
   * Closes the transport connection. Triggers the `onclose` callback if registered.
   * For this HTTP transport, there's no persistent connection to close, so this method
   * primarily serves to notify listeners.
   *
   * @returns A promise that resolves when the close operation is complete.
   */
  async close(): Promise<void> {
    this.onclose?.();
  }

  /**
   * Sends a JSON-RPC message to the MCP server via an HTTP POST request.
   *
   * If the message method includes 'tools/call', it generates a DID Key JWT
   * using the provided keypair and includes it in the 'Authorization' header.
   *
   * Notifications (methods including 'notification') are sent without expecting a response.
   * For other messages, it expects a JSON-RPC response, which is then parsed and passed
   * to the `onmessage` callback. Errors during the request or response parsing are passed
   * to the `onerror` callback.
   *
   * @param message The JSON-RPC message to send.
   * @returns A promise that resolves when the message has been sent and a response processed (if applicable).
   *          It throws an error if the HTTP request fails or the response is not OK.
   */
  async send(message: JSONRPCMessage): Promise<void> {
    if ('method' in message && message.method.includes('notification')) {
      // Notifications are not expected to have a response
      return;
    }

    try {
      const headers = new Headers(this._requestInit?.headers);
      headers.set('content-type', 'application/json');

      if ('method' in message && message.method.includes('tools/call')) {
        // set auth header here if method is 'tools/call'

        const didIdentifier =
          this._didIdentifier ?? (await this._deriveDidIdentifier());

        const jwt = await generateDidKeyEd25519JWT(
          this._url.toString(),
          this._keypair,
          {
            didIdentifier,
          },
        );

        const authHeader = `Bearer ${jwt}`;
        headers.set('Authorization', authHeader);
      }

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
