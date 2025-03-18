import {
  createToolsFromOpenAPI,
  RestApiWrappedOldowanServer,
  RestApiWrappedOldowanTool,
  ZEndpointDefinition,
  type IEndpointDefinition,
} from '@elite-agents/oldowan';
import { sqliteDb } from './src/sqlite';
import { z } from 'zod';

const PORT = 3004;

const openapiSpec = await Bun.file('./src/example-open-api.json').json();

const tools = await createToolsFromOpenAPI('irai-graffle', openapiSpec, {
  headers: {
    'irai-api-key': process.env.IRAI_API_KEY ?? '',
  },
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

  const tool = new RestApiWrappedOldowanTool(parsedEndpointDefinition);

  const result = await sqliteDb.upsert(tool);

  return c.json(result);
});

Bun.serve({
  port: PORT,
  fetch: server.honoServer.fetch,
  idleTimeout: 255,
});

console.log(`Server started on port ${PORT}`);
