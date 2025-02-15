import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { IEndpointDefinition, IRestApiWrappedOldowanTool } from './types';
import { deriveToolUniqueName } from './utils';

export class RestApiWrappedOldowanTool implements IRestApiWrappedOldowanTool {
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
    serverUrl: string,
    opts?: {
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
      endpointDefinition.creator,
      endpointDefinition.name,
    );
    this.serverUrl = serverUrl;
    this.tokenGate = opts?.tokenGate;

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
