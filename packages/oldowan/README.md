# @elite-agents/oldowan 🪨

**Oldowan** is a library for building AI tools with the Model Context Protocol (MCP), named after humanity's first stone tool technology. It provides abstractions to simplify tool development while handling protocol communication and validation automatically.

## Features

- 🛠️ Zero-config server setup for MCP tooling
- 🔒 Automatic input validation with Zod schemas
- 🔄 Built-in proxy server for secure tool access
- 🌐 REST API wrapping for existing endpoints
- 📦 Type-safe tool development with TypeScript
- ⚡ Bun runtime optimized for fast development

## Installation

```bash
# Using bun:
bun add @elite-agents/oldowan
```

## Quick Start

1. **Create a Tool** (`src/tools/weather.ts`):

```typescript
import { OldowanTool } from '@elite-agents/oldowan';
import { z } from 'zod';

export const weatherTool = new OldowanTool({
  name: 'get_weather',
  description: 'Get current weather conditions',
  schema: {
    location: z.string().describe('City name or postal code'),
    unit: z.enum(['celsius', 'fahrenheit']).optional(),
  },
  async execute({ location, unit }) {
    // Example API call
    const response = await fetch(`https://api.weather.com/${location}`);
    const data = await response.json();
    return {
      temp: data.current.temp,
      unit: unit || 'celsius',
      conditions: data.current.conditions,
    };
  },
});
```

2. **Set Up Server** (`src/server.ts`):

```typescript
import { OldowanServer } from '@elite-agents/oldowan';
import { weatherTool } from './tools/weather';

const server = new OldowanServer('Weather Service', '1.0.0', {
  tools: [weatherTool],
  port: 3000, // SSE server port
});

// Start the server with Bun
Bun.serve({
  ...server,
  idleTimeout: 255, // Need this to keep SSE connection alive
});
```

3. **Run your service**:

```bash
bun run server.ts
```

## REST API Wrapping

Oldowan can also wrap existing REST APIs into MCP-compatible tools. The constructor for `RestApiOldowanServer` takes a `IRestApiWrappedOldowanToolRepository` as an argument, which is a repository of `RestApiWrappedOldowanTool`s.

```typescript
import {
  RestApiWrappedOldowanTool,
  RestApiWrappedOldowanServer,
} from '@elite-agents/oldowan';

// Create a wrapped API endpoint
const weatherApiTool = new RestApiWrappedOldowanTool(
  {
    name: 'weather_api',
    description: 'Access weather API',
    method: 'GET',
    url: 'https://api.weather.com/:city',
    pathParams: { city: 'string' },
    queryParams: { unit: 'string' },
  },
  'https://weather-service.com',
);

// Set up server with REST tools
const server = new RestApiWrappedOldowanServer(repository, {
  port: 4000,
});
```

## Key Concepts

### Tool Development

Define tools with:

- **Name**: Unique tool identifier
- **Description**: Natural language explanation
- **Schema**: Zod validation rules
- **Execute**: Core tool functionality

### Server Features

- Automatic SSE server setup
- CORS-enabled proxy server
- Health check endpoint
- Request forwarding to MCP backend

## Error Handling

Oldowan automatically:

- Validates inputs against Zod schemas
- Converts errors to MCP-compatible format
- Provides detailed error messages in responses

## API Reference

### `OldowanServer`

```typescript
new OldowanServer(
  name: string,
  version: string,
  options: {
    tools: OldowanTool[];
    port?: number;  // default: 8888
  }
)
```

### `RestApiWrappedOldowanServer`

```typescript
new RestApiWrappedOldowanServer(
  toolRepository: IRestApiWrappedOldowanToolRepository,
  options?: {
    port?: number;    // default: 6004
    endpoint?: string // default: '/sse'
  }
)
```

### `OldowanTool`

```typescript
new OldowanTool({
  name: string,
  description: string,
  schema: z.ZodRawShape,
  execute: (input) => Promise<unknown>,
});
```
