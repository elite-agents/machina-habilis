import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type {
  IEndpointDefinition,
  IRestApiWrappedOldowanTool,
  PaymentDetails,
  ToolSchemaProperties,
} from './types';

export class RestApiWrappedOldowanTool implements IRestApiWrappedOldowanTool {
  [key: string]: unknown;
  id: string;
  name: string;
  description: string;
  endpointDefinition: IEndpointDefinition;
  inputSchema: Tool['inputSchema'];
  paymentDetails?: PaymentDetails;

  constructor(
    endpointDefinition: IEndpointDefinition,
    opts?: {
      paymentDetails?: PaymentDetails;
    },
  ) {
    this.name = endpointDefinition.name;
    this.id = endpointDefinition.name;
    this.description = endpointDefinition.description;
    this.endpointDefinition = endpointDefinition;

    this.paymentDetails = opts?.paymentDetails;

    // Build inputSchema from OpenAPI parameters and requestBody
    const properties: ToolSchemaProperties = {};
    const requiredParams: string[] = [];

    // Process OpenAPI parameters if available
    if (endpointDefinition.parameters) {
      for (const param of endpointDefinition.parameters) {
        // Add parameter to properties
        properties[param.name] = {
          type: this.mapOpenAPITypeToZod(param.schema?.type || 'string'),
          description: param.description,
        };

        // Add to required params if the parameter is required
        // if (param.required) { // all params are currently required in strict mode
        requiredParams.push(param.name);
        // }
      }
    }

    // Process request body if available
    if (
      endpointDefinition.requestBody &&
      endpointDefinition.requestBody.content
    ) {
      // Get the first content type (typically application/json)
      const contentType = Object.keys(
        endpointDefinition.requestBody.content,
      )[0];
      const schema = endpointDefinition.requestBody.content[contentType].schema;

      // If schema has properties, add them to our inputSchema
      if (schema && schema.properties) {
        for (const [propName, propSchema] of Object.entries<any>(
          schema.properties,
        )) {
          properties[propName] = {
            type: this.mapOpenAPITypeToZod(propSchema.type || 'string'),
            description: propSchema.description,
          };

          // If the property is required in the schema, add it to required params
          if (schema.required && schema.required.includes(propName)) {
            requiredParams.push(propName);
          }
        }
      }
    }

    this.inputSchema = {
      type: 'object',
      properties,
      required: requiredParams.length > 0 ? requiredParams : [],
    };
  }

  convertParamsToSchema = (params: Record<string, string> = {}) =>
    Object.entries(params).reduce(
      (acc, [key, type]) => ({
        ...acc,
        [key]: {
          type,
          description: undefined,
        },
      }),
      {},
    );

  private mapOpenAPITypeToZod(
    openAPIType: string,
  ): 'string' | 'number' | 'boolean' {
    switch (openAPIType) {
      case 'integer':
      case 'number':
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'string':
      default:
        return 'string';
    }
  }
}
