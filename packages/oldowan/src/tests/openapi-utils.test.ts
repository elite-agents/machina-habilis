import { mapOpenAPITypeToZod, createToolsFromOpenAPI } from '../openapi-utils';
import { expect, test, describe } from 'bun:test';

// Example OpenAPI spec for testing
const testOpenApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Test API',
    version: '1.0.0',
  },
  servers: [
    {
      url: 'http://localhost:3000',
    },
  ],
  paths: {
    '/test/{id}': {
      get: {
        operationId: 'getTest',
        summary: 'Get test by ID',
        description: 'Get a test item by ID',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
          },
          {
            name: 'include',
            in: 'query',
            schema: {
              type: 'boolean',
            },
          },
        ],
        responses: {
          '200': {
            description: 'OK',
          },
        },
      },
      post: {
        operationId: 'createTest',
        summary: 'Create a test',
        description: 'Create a new test item',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
          },
        ],
        requestBody: {
          description: 'Test object to add',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: {
                    type: 'string',
                  },
                  status: {
                    type: 'string',
                  },
                },
                required: ['name'],
              },
            },
          },
          required: true,
        },
        responses: {
          '201': {
            description: 'Created',
          },
        },
      },
    },
    '/search': {
      get: {
        operationId: 'searchTests',
        summary: 'Search tests',
        parameters: [
          {
            name: 'query',
            in: 'query',
            schema: {
              type: 'string',
            },
          },
        ],
        responses: {
          '200': {
            description: 'OK',
          },
        },
      },
    },
  },
};

describe('OpenAPI Utilities', () => {
  // Test the mapOpenAPITypeToZod function
  describe('mapOpenAPITypeToZod', () => {
    test('should map integer to number', () => {
      expect(mapOpenAPITypeToZod('integer')).toBe('number');
    });

    test('should map number to number', () => {
      expect(mapOpenAPITypeToZod('number')).toBe('number');
    });

    test('should map boolean to boolean', () => {
      expect(mapOpenAPITypeToZod('boolean')).toBe('boolean');
    });

    test('should map string to string', () => {
      expect(mapOpenAPITypeToZod('string')).toBe('string');
    });

    test('should default to string for unknown types', () => {
      expect(mapOpenAPITypeToZod('unknown')).toBe('string');
    });
  });

  // Test the createToolsFromOpenAPI function
  describe('createToolsFromOpenAPI', () => {
    test('should create tools from an OpenAPI spec', async () => {
      const tools = await createToolsFromOpenAPI('test-user', testOpenApiSpec);

      // Should have created 3 tools (2 for /test/{id} path, 1 for /search path)
      expect(tools).toHaveLength(3);

      // Verify GET /test/{id} tool
      const getTestTool = tools.find((tool) => tool.name === 'getTest');
      expect(getTestTool).toBeDefined();
      expect(getTestTool?.description).toBe(
        'Get test by ID\n\nGet a test item by ID',
      );
      expect(getTestTool?.endpointDefinition.method).toBe('GET');
      expect(getTestTool?.endpointDefinition.url).toBe(
        'http://localhost:3000/test/{id}',
      );

      // Verify parameters
      const getTestParams = getTestTool?.endpointDefinition.parameters;
      expect(getTestParams).toHaveLength(2);

      const idParam = getTestParams?.find((p) => p.name === 'id');
      expect(idParam?.in).toBe('path');
      expect(idParam?.required).toBe(true);
      expect(idParam?.schema?.type).toBe('integer');

      // Verify inputSchema correctly generated for GET tool
      expect(getTestTool?.inputSchema).toBeDefined();
      expect(getTestTool?.inputSchema.properties).toHaveProperty('id');
      expect(getTestTool?.inputSchema.properties).toHaveProperty('include');

      // Verify POST /test/{id} tool
      const createTestTool = tools.find((tool) => tool.name === 'createTest');
      expect(createTestTool).toBeDefined();
      expect(createTestTool?.description).toBe(
        'Create a test\n\nCreate a new test item',
      );
      expect(createTestTool?.endpointDefinition.method).toBe('POST');
      expect(createTestTool?.endpointDefinition.url).toBe(
        'http://localhost:3000/test/{id}',
      );
      expect(createTestTool?.endpointDefinition.requestBody).toBeDefined();

      // Verify request body schema
      const requestBody = createTestTool?.endpointDefinition.requestBody;
      expect(requestBody?.content?.['application/json']).toBeDefined();

      // Verify inputSchema correctly generated for POST tool
      expect(createTestTool?.inputSchema).toBeDefined();
      expect(createTestTool?.inputSchema.properties).toHaveProperty('name');
      expect(createTestTool?.inputSchema.properties).toHaveProperty('status');

      // Verify GET /search tool
      const searchTool = tools.find((tool) => tool.name === 'searchTests');
      expect(searchTool).toBeDefined();
      expect(searchTool?.description).toBe('Search tests');
      expect(searchTool?.endpointDefinition.method).toBe('GET');
      expect(searchTool?.endpointDefinition.url).toBe(
        'http://localhost:3000/search',
      );

      // Verify search parameter
      const searchParams = searchTool?.endpointDefinition.parameters;
      expect(searchParams).toHaveLength(1);
      expect(searchParams?.[0].name).toBe('query');
      expect(searchParams?.[0].in).toBe('query');
    });

    test('should create tools with a name prefix', async () => {
      const tools = await createToolsFromOpenAPI('test-user', testOpenApiSpec, {
        namePrefix: 'api',
      });

      // Verify names have the prefix
      expect(tools.every((tool) => tool.name.startsWith('api-'))).toBe(true);
      expect(tools.find((tool) => tool.name === 'api-getTest')).toBeDefined();
      expect(
        tools.find((tool) => tool.name === 'api-createTest'),
      ).toBeDefined();
      expect(
        tools.find((tool) => tool.name === 'api-searchTests'),
      ).toBeDefined();
    });

    test('should add custom headers to all tools', async () => {
      const headers = {
        'X-API-Key': 'test-key',
        'X-Custom-Header': 'custom-value',
      };

      const tools = await createToolsFromOpenAPI('test-user', testOpenApiSpec, {
        headers,
      });

      // Verify all tools have the custom headers
      expect(
        tools.every((tool) => tool.endpointDefinition.headers === headers),
      ).toBe(true);
    });

    test('should apply a custom transform function to all tools', async () => {
      const transformFn =
        'function(response) { return { transformed: true, ...response }; }';

      const tools = await createToolsFromOpenAPI('test-user', testOpenApiSpec, {
        transformFn,
      });

      // Verify all tools have the transform function
      expect(
        tools.every(
          (tool) => tool.endpointDefinition.transformFn === transformFn,
        ),
      ).toBe(true);
    });

    test('should throw an error if no paths are found in the OpenAPI spec', async () => {
      const emptySpec = {
        openapi: '3.0.0',
        info: {
          title: 'Empty API',
          version: '1.0.0',
        },
        // No paths property
      };

      await expect(
        createToolsFromOpenAPI('test-user', emptySpec),
      ).rejects.toThrow('Invalid OpenAPI specification');
    });

    test('should throw an error if openapi field is missing', async () => {
      const invalidSpec = {
        // Missing openapi field
        info: {
          title: 'Invalid API',
          version: '1.0.0',
        },
        paths: {},
      };

      await expect(
        createToolsFromOpenAPI('test-user', invalidSpec),
      ).rejects.toThrow('Invalid OpenAPI specification');
    });

    test('should throw an error if info field is missing', async () => {
      const invalidSpec = {
        openapi: '3.0.0',
        // Missing info field
        paths: {},
      };

      await expect(
        createToolsFromOpenAPI('test-user', invalidSpec),
      ).rejects.toThrow('Invalid OpenAPI specification');
    });

    test('should throw an error on malformed OpenAPI spec', async () => {
      const invalidSpec = {
        openapi: '3.0.0',
        info: {
          title: 'Test API',
          // Missing required version field
        },
        paths: {
          '/test': {
            get: {
              // Invalid operation object - missing responses
              operationId: 'getTest',
              description: 'Get a test',
            },
          },
        },
      };

      await expect(
        createToolsFromOpenAPI('test-user', invalidSpec),
      ).rejects.toThrow('Invalid OpenAPI specification');
    });

    test('should throw an error if an operation is missing responses', async () => {
      const malformedOperationSpec = {
        openapi: '3.0.0',
        info: {
          title: 'Malformed Operation API',
          version: '1.0.0',
        },
        servers: [{ url: 'http://localhost:3000' }],
        paths: {
          '/test': {
            get: {
              operationId: 'getTest',
              summary: 'Test Operation',
              // Missing required 'responses' field
            },
          },
        },
      };

      await expect(
        createToolsFromOpenAPI('test-user', malformedOperationSpec),
      ).rejects.toThrow(/requires property "responses"/);
    });
  });
});
