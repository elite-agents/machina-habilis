import {
  expect,
  test,
  beforeEach,
  afterEach,
  describe,
  jest,
  type Mock,
} from 'bun:test';
import { RestApiWrappedOldowanTool } from '../rest-wrapper-tool';
import { RestApiWrappedOldowanServer } from '../rest-wrapper-server';
import { InMemoryRepository } from './in-memory-repository';
import type {
  IEndpointDefinition,
  OpenAPIParameter,
  IRestApiWrappedOldowanToolRepository,
} from '../types';

// Example OpenAPI specification for a simple API (similar to Swagger Petstore)
const petStoreOpenApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Petstore API',
    version: '1.0.0',
    description: 'A sample API for testing OpenAPI integration',
  },
  paths: {
    '/pet/{petId}': {
      get: {
        summary: 'Find pet by ID',
        description: 'Returns a single pet',
        parameters: [
          {
            name: 'petId',
            in: 'path',
            description: 'ID of pet to return',
            required: true,
            schema: {
              type: 'integer',
            },
          },
        ],
        responses: {
          '200': {
            description: 'successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    id: { type: 'integer' },
                    name: { type: 'string' },
                    status: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/pet': {
      post: {
        summary: 'Add a new pet',
        description: 'Add a new pet to the store',
        requestBody: {
          description: 'Pet object to add',
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string' },
                  status: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    id: { type: 'integer' },
                    name: { type: 'string' },
                    status: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

// Create the tool repository type using the in-memory implementation
class InMemoryToolRepository
  extends InMemoryRepository<RestApiWrappedOldowanTool>
  implements IRestApiWrappedOldowanToolRepository {}

describe('Oldowan Rest Wrapper', () => {
  let toolRepository: InMemoryToolRepository;
  let server: RestApiWrappedOldowanServer;

  beforeEach(() => {
    // Create a fresh repository for each test
    toolRepository = new InMemoryToolRepository();
    server = new RestApiWrappedOldowanServer(toolRepository);

    // Mock fetch to avoid making real API calls
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // TEST 1: Initialize RestApiWrappedOldowanTool with an example endpoint
  test('should initialize a tool with OpenAPI endpoint definition', () => {
    // Create an endpoint definition with OpenAPI parameters
    const parameters: OpenAPIParameter[] = [
      {
        name: 'petId',
        in: 'path',
        description: 'ID of pet to return',
        required: true,
        schema: { type: 'integer' },
      },
    ];

    const endpoint: IEndpointDefinition = {
      creator: 'test-user',
      name: 'get-pet',
      description: 'Find a pet by ID',
      method: 'GET',
      url: 'https://petstore.swagger.io/v2/pet/{petId}',
      parameters,
      openApiSpec: petStoreOpenApiSpec,
    };

    // Initialize the tool with the endpoint
    const tool = new RestApiWrappedOldowanTool(endpoint);

    // Verify tool properties
    expect(tool.name).toBe('get-pet');
    expect(tool.description).toBe('Find a pet by ID');

    // Verify that inputSchema was correctly created from OpenAPI parameters
    expect(tool.inputSchema.type).toBe('object');
    expect(tool.inputSchema.properties).toBeDefined();
    const properties = tool.inputSchema.properties as Record<string, any>;
    expect(properties).toHaveProperty('petId');
    expect(properties.petId.type).toBe('number');
    expect(properties.petId.description).toBe('ID of pet to return');
    expect(tool.inputSchema.required).toContain('petId');
  });

  // TEST 2: Add tools to the server and verify they can be retrieved
  test('should add a tool to the server repository and retrieve it', async () => {
    // Create an endpoint definition with OpenAPI parameters
    const endpoint: IEndpointDefinition = {
      creator: 'test-user',
      name: 'get-pet',
      description: 'Find a pet by ID',
      method: 'GET',
      url: '/pet/{petId}',
      parameters: [
        {
          name: 'petId',
          in: 'path',
          description: 'ID of pet to return',
          required: true,
          schema: { type: 'integer' },
        },
      ],
    };

    // Create a tool from the endpoint
    const tool = new RestApiWrappedOldowanTool(endpoint);

    // Add the tool to the repository
    await toolRepository.create(tool);

    // Retrieve the tool and verify it's the same
    const retrievedTool = await toolRepository.findOne(tool.id);
    expect(retrievedTool).not.toBeNull();
    expect(retrievedTool?.id).toBe(tool.id);
    expect(retrievedTool?.name).toBe('get-pet');

    // Retrieve all tools and verify our tool is included
    const allTools = await toolRepository.find();
    expect(allTools.length).toBe(1);
    expect(allTools[0].id).toBe(tool.id);
  });

  // TEST 3: Call a previously added tool
  test('should call a tool with parameters and handle the response', async () => {
    // Create an endpoint definition with path parameters
    const endpoint: IEndpointDefinition = {
      creator: 'test-user',
      name: 'get-pet',
      description: 'Find a pet by ID',
      method: 'GET',
      url: 'https://petstore.swagger.io/v2/pet/10',
      parameters: [
        {
          name: 'petId',
          in: 'path',
          description: 'ID of pet to return',
          required: true,
          schema: { type: 'integer' },
        },
      ],
      transformFn: `
        function(response) {
          return {
            petId: response.id,
            petName: response.name,
            status: response.status
          };
        }
      `,
    };

    // Create a tool from the endpoint
    const tool = new RestApiWrappedOldowanTool(endpoint);

    // Add the tool to the repository
    await toolRepository.create(tool);

    // Mock the fetch response
    const mockResponse = {
      id: 10,
      name: 'Test Pet',
      status: 'available',
    };

    const mockFetch = global.fetch as Mock<typeof fetch>;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    } as Response);

    // Call the tool with parameters
    const result = await server.callTool(tool, { petId: 10 });

    // Verify that fetch was called correctly
    expect(mockFetch).toHaveBeenCalledWith(
      'https://petstore.swagger.io/v2/pet/10',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      }),
    );

    // Verify that the transform function was applied
    const expectedResult = {
      petId: 10,
      petName: 'Test Pet',
      status: 'available',
    };

    // Parse the response to verify
    const parsedResponse = JSON.parse(result.content[0].text);
    expect(parsedResponse).toEqual(expectedResult);
  });

  // TEST 4: Handle request body parameters
  test('should handle request body parameters for POST requests', async () => {
    // Create an endpoint definition with request body
    const endpoint: IEndpointDefinition = {
      creator: 'test-user',
      name: 'add-pet',
      description: 'Add a new pet to the store',
      method: 'POST',
      url: 'https://petstore.swagger.io/v2/pet',
      requestBody: {
        description: 'Pet object to add',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['name'],
              properties: {
                name: { type: 'string', description: 'Pet name' },
                status: { type: 'string', description: 'Pet status' },
              },
            },
          },
        },
        required: true,
      },
    };

    // Create a tool from the endpoint
    const tool = new RestApiWrappedOldowanTool(endpoint);

    // Add the tool to the repository
    await toolRepository.create(tool);

    // Mock the fetch response
    const mockResponse = {
      id: 123,
      name: 'New Pet',
      status: 'available',
    };

    const mockFetch = global.fetch as Mock<typeof fetch>;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    } as Response);

    // Call the tool with request body params
    const result = await server.callTool(tool, {
      name: 'New Pet',
      status: 'available',
    });

    // Verify that fetch was called with the correct URL and body
    expect(mockFetch).toHaveBeenCalledWith(
      'https://petstore.swagger.io/v2/pet',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
        body: expect.any(String),
      }),
    );

    // Verify that the body was correctly serialized
    const fetchCall = mockFetch.mock.calls[0];
    const requestInit = fetchCall[1] || {};
    const requestBody = requestInit.body
      ? JSON.parse(requestInit.body as string)
      : {};

    expect(requestBody).toEqual({
      name: 'New Pet',
      status: 'available',
    });

    // Verify the response
    expect(result.content[0].type).toBe('text');
    expect(JSON.parse(result.content[0].text)).toEqual(mockResponse);
  });

  // TEST 5: Handle both query and path parameters
  test('should handle both path and query parameters', async () => {
    // Create an endpoint with both path and query parameters
    const endpoint: IEndpointDefinition = {
      creator: 'test-user',
      name: 'get-pet-with-options',
      description: 'Find a pet by ID with options',
      method: 'GET',
      url: 'https://petstore.swagger.io/v2/pet/{petId}',
      parameters: [
        {
          name: 'petId',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
        },
        {
          name: 'includeDetails',
          in: 'query',
          schema: { type: 'boolean' },
        },
      ],
    };

    // Create the tool
    const tool = new RestApiWrappedOldowanTool(endpoint);

    // Add the tool to the repository
    await toolRepository.create(tool);

    // Mock the fetch response
    const mockFetch = global.fetch as Mock<typeof fetch>;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 10, name: 'Test Pet' }),
    } as Response);

    // Call the tool with both path and query parameters
    await server.callTool(tool, {
      petId: 10,
      includeDetails: true,
    });

    // Verify that fetch was called with both parameters correctly processed
    expect(mockFetch).toHaveBeenCalledWith(
      'https://petstore.swagger.io/v2/pet/10?includeDetails=true',
      expect.objectContaining({
        method: 'GET',
      }),
    );
  });
});
