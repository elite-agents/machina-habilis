import {
  RestApiWrappedOldowanServer,
  RestApiWrappedOldowanTool,
  ZEndpointDefinition,
  type IEndpointDefinition,
} from '@elite-agents/oldowan';
import { sqliteDb } from './src/sqlite';
import { z } from 'zod';

const PORT = 3004;

const endpointDefinitions: IEndpointDefinition[] = [
  {
    creator: 'example-api',
    name: 'get-user',
    description: 'Get user details by ID',
    method: 'GET',
    url: 'https://api.example.com/users/:userId',
    pathParams: {
      userId: 'string',
    },
    responseFields: {
      id: 'string',
      name: 'string',
      email: 'string',
    },
    paramDescriptions: {
      userId: 'The unique identifier of the user',
    },
  },
  {
    creator: 'example-api',
    name: 'create-post',
    description: 'Create a new blog post',
    method: 'POST',
    url: 'https://api.example.com/posts',
    body: {
      title: 'string',
      content: 'string',
      authorId: 'string',
    },
    responseFields: {
      id: 'string',
      title: 'string',
      content: 'string',
      authorId: 'string',
      createdAt: 'string',
    },
    paramDescriptions: {
      title: 'The title of the blog post',
      content: 'The content of the blog post',
      authorId: 'The ID of the post author',
    },
  },
];

const tools = endpointDefinitions.map((endpointDefinition) => {
  return new RestApiWrappedOldowanTool(
    endpointDefinition,
    'http://localhost:6005',
  );
});

for (const tool of tools) {
  await sqliteDb.upsert(tool);
}

const server = new RestApiWrappedOldowanServer(sqliteDb, {
  port: PORT,
});

server.honoServer.post('/create-tool', async (c) => {
  let parsedEndpointDefinition: IEndpointDefinition;
  try {
    const endpointDefinition = await c.req.json();

    parsedEndpointDefinition = ZEndpointDefinition.parse(endpointDefinition);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      const formattedErrors = (error as z.ZodError).issues.map((err) => ({
        path: err.path.join('.'),
        message: err.message,
      }));
      return c.json(
        { error: 'Invalid endpoint definition', details: formattedErrors },
        400,
      );
    }
    return c.json({ error }, 400);
  }

  const tool = new RestApiWrappedOldowanTool(
    parsedEndpointDefinition,
    `http://localhost:${PORT}`,
  );

  const result = await sqliteDb.upsert(tool);

  return c.json(result);
});

Bun.serve({
  port: PORT,
  fetch: server.honoServer.fetch,
  idleTimeout: 255,
});

console.log(`Server started on port ${PORT}`);
