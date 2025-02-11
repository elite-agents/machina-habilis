# @elite-agents/habilis 🛠️

**Habilis** is an AI agent library that connects to Model Context Protocol (MCP) servers, named after the Homo Habilis, humanity's first tool-using species. It enables sophisticated tool usage and cognitive capabilities through MCP integrations.

## Features

- 🤖 Autonomous agent core with tool orchestration
- 🔗 Automatic MCP server discovery and connection
- 🧠 Context-aware memory integration
- 🎭 Custom persona system for agent personality
- ⚡ Multi-model support (OpenAI, Anthropic, etc.)

## Installation

```bash
# Using bun:
bun add @elite-agents/habilis
```

## Quick Start

1. **Create an Agent**:

```typescript
import { Habilis } from '@elite-agents/habilis';
import { Keypair } from '@solana/web3.js';

const memoryServer = 'http://localhost:3000';
const keypair = Keypair.generate();

const agent = await Habilis.create(memoryServer, {
  persona: {
    name: 'Research Assistant',
    bio: ['Knowledge-focused', 'Detail-oriented', 'Curious'],
  },
  abilities: [
    {
      name: 'web_search',
      abilityServer: 'http://localhost:3001',
    },
  ],
  modelApiKeys: {
    generationKey: 'sk-your-openai-key',
  },
  privateKey: keypair,
});
```

2. **Use Your Agent**:

```typescript
const response = await agent.message(
  "What's the latest progress in AI alignment?",
  { channelId: 'research-discussions' }
);

console.log(response.output);
```

## Key Concepts

### Agent Core

- Maintains conversation state and context
- Orchestrates tool usage across MCP servers
- Handles memory storage and retrieval

### Tool Integration

- Discovers tools from connected MCP servers
- Validates tool inputs/outputs
- Handles error recovery and fallbacks

### Persona System

- Defines agent personality and behavior
- Manages identity-consistent responses
- Supports dynamic persona adaptation

## API Reference

### `Habilis.create()`

```typescript
static async create(
  memoryServer: string,
  config: {
    persona: SimplePersona;
    abilities: Ability[];
    privateKey: Keypair;
    modelApiKeys: { generationKey: string };
  }
): Promise<Habilis>
```

### `Habilis.addMCPServer()`

```typescript
async addMCPServer(config: {
  url: string;
  toolNames?: string[];
}): Promise<void>
```

### `Habilis.message()`

```typescript
async message(
  message: string,
  options?: { channelId?: string }
): Promise<IMessageLifecycle>
```

## MCP Integration

Habilis works with any MCP-compliant server created with [Oldowan](https://github.com/elite-agents/oldowan):

- Automatic tool discovery
- Secure communication channel
- Context-aware request routing

## License

MIT © [Elite Agents](https://github.com/elite-agents)
