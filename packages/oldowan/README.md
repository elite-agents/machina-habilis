# @elite-agents/oldowan 🪨

**Oldowan** is a library for building AI tools with the Model Context Protocol (MCP), named after humanity's first stone tool technology. It provides abstractions to simplify tool development while handling protocol communication and validation automatically.

## Features

- 🛠️ Zero-config server setup for MCP tooling
- 🔒 Automatic input validation with Zod schemas
- 🔄 Built-in proxy server for secure tool access
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
    // Implementation logic here
    return { temp: 22, unit: unit || 'celsius', location };
  },
});
```

2. **Set Up Server** (`src/server.ts`):

```typescript
import { OldowanServer } from '@elite-agents/oldowan';
import { weatherTool } from './tools/weather';

const server = new OldowanServer('Weather Service', '1.0.0', {
  tools: [weatherTool],
  proxyPort: 3000,
});

// Start the server
Bun.serve(await server.getProxy());
```

3. **Run your service**:

```bash
bun run server.ts
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
    proxyPort?: number;  // default: 8888
    ssePort?: number;    // default: 8889
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

## Contributing

Contributions welcome! Please follow our [contribution guidelines](CONTRIBUTING.md).

## License

MIT © [Elite Agents](https://github.com/elite-agents)
