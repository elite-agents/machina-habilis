# @elite-agents/machina-habilis 🛠️

**Machina Habilis** is an AI agent library that connects to Model Context Protocol (MCP) servers, named after the Homo Habilis, humanity's first tool-using species. It enables sophisticated tool usage and cognitive capabilities through MCP integrations.

## Features

- 🤖 Autonomous agent core with tool orchestration
- 🔗 Automatic MCP server discovery and connection
- 🧠 Context-aware memory integration
- 🎭 Custom persona system for agent personality
- ⚡ Multi-model support (OpenAI, Anthropic, etc.)

## Installation

```bash
# Using bun:
bun add @elite-agents/machina-habilis  # Updated package name
```

## Quick Start

1. **Create an Agent**:

```typescript
import { MachinaAgent, HabilisServer } from '@elite-agents/machina-habilis';
import { Keypair } from '@solana/web3.js';

const memoryServer = 'http://localhost:3000';
const keypair = Keypair.generate();

const habilisServer = new HabilisServer(memoryServer);
await habilisServer.init([memoryServer]); // Updated initialization pattern

const agent = new MachinaAgent(habilisServer, {
  // Using MachinaAgent directly
  persona: {
    name: 'Research Assistant',
    bio: ['Knowledge-focused', 'Detail-oriented', 'Curious'],
  },
  abilityNames: ['web_search'], // Changed from 'abilities' to 'abilityNames'
  llm: {
    provider: 'openai',
    name: 'gpt-4',
    apiKey: 'sk-your-openai-key',
    endpoint: 'https://api.openai.com/v1',
  },
  keypair: keypair,
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

### Agent Architecture

**HabilisServer** - The foundational service layer that:

- Manages connections to MCP servers
- Discovers and catalogs available tools
- Handles cross-server communication
- Provides shared memory/cache services

**MachinaAgent** - The user-facing agent instance that:

- Processes incoming messages through LLM pipelines
- Maintains conversation state and context
- Orchestrates tool usage via HabilisServer
- Manages persona-specific behavior
- Handles cryptographic identity and signatures

### Relationship Flow

1. `HabilisServer` initializes first, connecting to MCP services
2. `MachinaAgent` is instantiated with a configured HabilisServer
3. Agent uses server's tool registry during message processing
4. Server handles low-level tool execution and memory operations
5. Agent focuses on LLM interaction and conversation management

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
