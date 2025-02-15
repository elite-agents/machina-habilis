import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { IEndpointDefinition, OldowanToolDefinition } from './types';
import { deriveToolUniqueName } from './utils';

export class RestApiWrappedOldowanTool implements OldowanToolDefinition {
  [key: string]: unknown;
  name: string;
  description: string;
  endpointDefinition: IEndpointDefinition;
  inputSchema: Tool['inputSchema'];
  uniqueName: string;
  serverUrl: string;
  tokenGate?: {
    mint: string;
    amount: bigint;
  };

  constructor(
    endpointDefinition: IEndpointDefinition,
    creator: {
      authorName: string;
      serverUrl: string;
    },
    opts: {
      tokenGate?: {
        mint: string;
        amount: bigint;
      };
    },
  ) {
    this.name = endpointDefinition.name;
    this.description = endpointDefinition.description;
    this.endpointDefinition = endpointDefinition;
    this.uniqueName = deriveToolUniqueName(
      creator.authorName,
      endpointDefinition.name,
    );
    this.serverUrl = creator.serverUrl;
    this.tokenGate = opts.tokenGate;

    this.inputSchema = {
      type: 'object',
      properties: {
        ...this.convertParamsToSchema(endpointDefinition.pathParams),
        ...this.convertParamsToSchema(endpointDefinition.queryParams),
        ...this.convertParamsToSchema(endpointDefinition.body),
      },
    };
  }

  convertParamsToSchema = (params: Record<string, string> = {}) =>
    Object.entries(params).reduce(
      (acc, [key, type]) => ({
        ...acc,
        [key]: {
          type,
          description: this.endpointDefinition.paramDescriptions?.[key],
        },
      }),
      {},
    );
}
