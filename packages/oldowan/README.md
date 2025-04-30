# @elite-agents/oldowan 🪨

**Oldowan** is a library for building AI tools with the Model Context Protocol (MCP), named after humanity's first stone tool technology. It provides abstractions to simplify tool development while handling protocol communication and validation automatically.

## Features

- 🛠️ Zero-config server setup for MCP tooling
- 🌐 REST API wrapping with OpenAPI 3.0 specifications support for existing endpoints
- 📦 Type-safe tool development with TypeScript
- 🪙 Monetization support with token-gated, subscription, and credit-based access
- ⚡ Cloudflare Workers blazingly fast deployment

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
  port: 3000, // HTTP server port
});

export default server.honoServer;
```

3. **Run your service**:

```bash
bun dev
```

## REST API Wrapping with OpenAPI Support

Oldowan can wrap existing REST APIs into MCP-compatible tools with OpenAPI 3.0 specifications. This enables proper documentation and type safety for your API endpoints.

```typescript
import {
  RestApiWrappedOldowanTool,
  RestApiWrappedOldowanServer,
} from '@elite-agents/oldowan';

// Create a wrapped API endpoint with OpenAPI definitions
const weatherApiTool = new RestApiWrappedOldowanTool(
  {
    name: 'weather_api',
    description: 'Access weather API',
    method: 'GET',
    url: 'https://api.weather.com/:city',
    pathParams: { city: 'string' },
    queryParams: { unit: 'string' },
    // OpenAPI response definitions
    responses: {
      200: {
        description: 'Successful response',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                temp: { type: 'number' },
                unit: { type: 'string' },
                conditions: { type: 'string' },
              },
            },
          },
        },
      },
    },
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
- **Payment Details**: Optional payment configuration

### Server Features

- Uses the latest stateless MCP specification
- Deploys as a Cloudflare Worker

## Error Handling

Oldowan automatically:

- Validates inputs against Zod schemas
- Converts errors to MCP-compatible format
- Provides detailed error messages in responses

## Monetization Examples

Oldowan supports built-in monetization via the `paymentDetails` field. See [Monetization Guide](../../docs/oldowan-monetization.md) for full details.

#### Token-Gated

```typescript
import { OldowanTool } from '@elite-agents/oldowan';
import { z } from 'zod';

export const premiumTool = new OldowanTool({
  name: 'premium_tool',
  description: 'Premium functionality requiring tokens per call',
  schema: { data: z.string() },
  paymentDetails: {
    type: 'token-gated',
    mint: 'So11111111111111111111111111111111111111112',
    amountUi: 5,
    description: 'Charge 5 tokens per call',
  },
  async execute({ data }) {
    return `Processed ${data}`;
  },
});
```

#### Subscription

```typescript
export const subscriptionTool = new OldowanTool({
  name: 'subscription_tool',
  description: 'Tool requiring a subscription plan',
  schema: { value: z.number() },
  paymentDetails: {
    type: 'subscription',
    planId: 'basic_monthly',
    description: 'Basic monthly subscription',
  },
  async execute({ value }) {
    return value * 2;
  },
});
```

#### Credit-Based

```typescript
export const creditTool = new OldowanTool({
  name: 'credit_tool',
  description: 'Tool deducting from user credits',
  schema: { id: z.string(), amount: z.number() },
  paymentDetails: {
    type: 'credit',
    amount: 10,
    creditId: 'user-credits-123',
    description: 'Deduct 10 credits per use',
  },
  async execute({ id, amount }) {
    return { id, result: amount + 100 };
  },
});
```

## API Reference

### `ED25519_ALGORITHM_IDENTIFIER`

Constant identifier for the Ed25519 algorithm when using the Web Crypto API. Use with `crypto.subtle.generateKey`, `crypto.subtle.importKey`, etc.

```typescript
import { ED25519_ALGORITHM_IDENTIFIER } from '@elite-agents/oldowan';
console.log(ED25519_ALGORITHM_IDENTIFIER);
```

### `generateKeypairRawBytes`

Generates a new Ed25519 keypair and returns a 64-byte `Buffer` with `[publicKey (32 bytes) || privateKey (32 bytes)]`. Useful for creating key pairs for signing tool calls.

```typescript
import { generateKeypairRawBytes } from '@elite-agents/oldowan';
const keypairBytes = await generateKeypairRawBytes();
const keypairBase64 = Buffer.from(keypairBytes).toString('base64');
```

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
    endpoint?: string // default: '/api'
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

### `OldowanTool` Example

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
