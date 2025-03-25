# @elite-agents/machina-habilis 🛠️

**Machina Habilis** is an AI agent library that connects to Model Context Protocol (MCP) servers, named after the Homo Habilis, humanity's first tool-using species. It enables sophisticated tool usage and cognitive capabilities through MCP integrations.

## Features

- 🤖 Autonomous agent core with tool orchestration
- 🔗 Automatic MCP server discovery and connection
- 🧠 Context-aware memory integration
- 🎭 Custom persona system for agent personality
- ⚡ Multi-model support (OpenAI, Anthropic, etc.)
- 🔄 Flexible architecture - works with or without HabilisServer
- 📝 Integrated memory operations for context management

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
  { channelId: 'research-discussions' },
);

console.log(response.output);
```

3. **Standalone Agent (Without HabilisServer)**:

```typescript
import { MachinaAgent } from '@elite-agents/machina-habilis';
import { Keypair } from '@solana/web3.js';

// Create agent with direct ability map
const agent = new MachinaAgent(null, {
  persona: {
    name: 'Task Assistant',
    bio: ['Efficient', 'Precise', 'Helpful'],
  },
  abilities: {
    web_search: {
      name: 'web_search',
      description: 'Search the web for information',
      schema: { query: 'string' },
      // Tool implementation is handled directly by MachinaAgent
    },
    // Add other abilities as needed
  },
  llm: {
    provider: 'anthropic',
    name: 'claude-3-opus',
    apiKey: 'sk-your-anthropic-key',
  },
  keypair: Keypair.generate(),
});

// Agent will handle tool calls directly
const response = await agent.message("What's trending today?");
```

## Memory System Components

The package includes a robust memory system through the `mnemon.ts` module, which provides both server and client implementations for memory services:

### MnemonServer

The `MnemonServer` class creates a Hono-based HTTP server that handles memory operations:

```typescript
import { MnemonServer } from '@elite-agents/machina-habilis';

// Create a memory service with custom recall and create functions
const memoryServer = new MnemonServer({
  recallMemory: async (lifecycle) => {
    // Custom memory recall logic
    return { ...lifecycle, context: ['Retrieved memory'] };
  },
  createMemory: async (lifecycle) => {
    // Custom memory creation logic
    return lifecycle;
  }
});

// Start the server with Bun
Bun.serve({
  ...memoryServer.app,
  port: 3000
});
```

### MnemonClient

The `MnemonClient` class provides a client implementation to connect to a MnemonServer:

```typescript
import { MnemonClient } from '@elite-agents/machina-habilis';

// Connect to a memory server
const memoryClient = new MnemonClient('http://localhost:3000');

// Use the client to recall or create memories
const memory = await memoryClient.recallMemory(messageLifecycle);
```

The memory system integrates seamlessly with the `MachinaAgent` through the `recallContext` and `addKnowledge` methods.

## Key Concepts

### Agent Architecture

**HabilisServer** - The foundational service layer that:

- Manages connections to MCP servers
- Discovers and catalogs available tools
- Handles cross-server communication
- Provides shared memory/cache services

A Habilis Server can be thought of as the central repository for a web service that aggregates agent abilities and personas.
You may create an API wrapper around it to provide a simple MCP tool and agent personality listing service.
It also acts as a caching tool for MCP on the backend. You can imagine a cache ttl that is used to determine whether the entire list needs to be refreshed.

**MachinaAgent** - The user-facing agent instance that:

- Processes incoming messages through LLM pipelines
- Maintains conversation state and context
- Orchestrates tool usage via HabilisServer or directly
- Manages persona-specific behavior
- Handles cryptographic identity and signatures
- Supports memory operations for context management

A MachinaAgent can be used in the front-end or backend. Its main focus is to create encapsulation for an agent with abilities.

### Relationship Flow

1. `HabilisServer` initializes first, connecting to MCP services (if using HabilisServer)
2. `MachinaAgent` is instantiated with a configured HabilisServer or with direct abilities
3. Agent uses server's tool registry or internal abilities during message processing
4. Server handles low-level tool execution and memory operations when available
5. Agent focuses on LLM interaction and conversation management

### Agent Core

- Maintains conversation state and context
- Orchestrates tool usage across MCP servers or directly
- Handles memory storage and retrieval with methods:
  - `recallContext`: Retrieve contextual information
  - `addKnowledge`: Store new information

### Tool Integration

- Discovers tools from connected MCP servers or uses direct abilities
- Validates tool inputs/outputs
- Handles error recovery and fallbacks
- Supports direct tool calls with `callTool` method

### Memory System

- Integrated memory operations for context management
- Automatic detection of memory tools from abilities
- Context-aware retrieval based on conversation state
- Client-server architecture through MnemonServer and MnemonClient
- HTTP-based communication for memory operations

### Persona System

- Defines agent personality and behavior
- Manages identity-consistent responses
- Supports dynamic persona adaptation

## API Reference

### `MachinaAgent`

```typescript
new MachinaAgent(
  habilisServer: HabilisServer | null,
  config: {
    persona: SimplePersona;
    abilityNames?: string[];
    abilities?: Record<string, Ability>;
    llm: {
      provider: string;
      name: string;
      apiKey: string;
      endpoint?: string;
    };
    keypair: Keypair;
  }
)
```

### `MachinaAgent.message()`

```typescript
async message(
  message: string,
  options?: { channelId?: string }
): Promise<IMessageLifecycle>
```

### `MachinaAgent.callTool()`

```typescript
async callTool(
  toolName: string,
  params: Record<string, any>
): Promise<any>
```

### `MachinaAgent.recallContext()`

```typescript
async recallContext(
  query: string,
  options?: { limit?: number }
): Promise<any>
```

### `MachinaAgent.addKnowledge()`

```typescript
async addKnowledge(
  content: string,
  metadata?: Record<string, any>
): Promise<any>
```

## MCP Integration

Habilis works with any MCP-compliant server created with [Oldowan](https://github.com/elite-agents/oldowan):

- Automatic tool discovery
- Secure communication channel
- Context-aware request routing
