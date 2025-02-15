# Machina Habilis 🛠️ - TypeScript Framework for Tool-Using Autonomous Agents

**Machina Habilis** is an evolutionary step in AI agent development - a TypeScript framework enabling sophisticated tool usage through the Model Context Protocol (MCP). Named after the Homo Habilis, humanity's first tool-using species, it comprises three core components:

1. **🪨 @elite-agents/oldowan** - Foundational tool server implementation that allows you to quickly build custom agent tools or wrap existing APIs into MCP-compatible tools
2. **🛠️ @elite-agents/machina-habilis** - Tool-first agent library with:
   - `HabilisServer`: Infrastructure layer for tool management
   - `MachinaAgent`: Cognitive layer for conversation handling
3. **🧠 @elite-agents/mnemon** - Memory MCP server that allows you to store and retrieve memories from a variety of storage systems

```mermaid
graph TD
    A[MachinaAgent] -->|Talks Via| B[HabilisServer]
    B -->|MCP| C[Oldowan Tools Server]
    B -->|MCP| D[3rd-party Tools Server]
    B -->|MCP| E[Mnemon Memory Server]
    C --> F[External APIs]
    D --> G[Other Services]
    E --> H[Custom Memory System]
```

## Features

- **Layered Architecture**  
  Clear separation between infrastructure (HabilisServer) and cognition (MachinaAgent)
- **Distributed Tool Ecosystem**  
  Discover/use tools across multiple MCP servers
- **Secure Protocol**  
  End-to-end encrypted tool communications
- **Multi-Model Runtime**  
  OpenAI, Anthropic, Google, etc.

```bash
bun add @elite-agents/oldowan
```

- MCP-compliant tool servers
- Automatic validation & security
- Zero-config proxy setup

## Quick Start

1. **Install dependencies**:

```bash
bun install
```

2. **Start core services** (from repository root):

```bash
docker compose up --build
```

3. **Launch builder UI**:

```bash
cd apps/machina-habilis-builder
bun dev
```

Access the development environment at `http://localhost:5173`

> **Note**: Requires [Docker](https://docker.com) and [Bun](https://bun.sh) installed

## Using The Framework

1. **Create Agent**:

```typescript
import { MachinaAgent, HabilisServer } from '@elite-agents/habilis';
import { Keypair } from '@solana/web3.js';

const habilisServer = new HabilisServer('http://localhost:8080'); // Memory server

await habilisServer.init(['http://localhost:8888', 'http://localhost:9999']); // Tool servers

const agent = new MachinaAgent(habilisServer, {
  persona: {
    name: 'Research Assistant',
    bio: ['Knowledge-focused', 'Detail-oriented'],
  },
  abilityNames: ['web_search'],
  llm: {
    provider: 'openai',
    name: 'gpt-4',
    apiKey: 'sk-your-key',
  },
  keypair: Keypair.generate(),
});
```

2. **Use Your Agent**:

```typescript
const response = await agent.message("What's the weather in Nairobi?", {
  channelId: 'weather-requests',
});

console.log(response.output);
```

## Architecture Overview

### Component Roles

**HabilisServer**

- Infrastructure backbone
- Tool discovery/registration
- Cross-server coordination
- Shared memory services

**MachinaAgent**

- User interaction interface
- LLM reasoning pipelines
- Contextual conversation state
- Persona enforcement

### Operational Flow

```mermaid
sequenceDiagram
    participant User
    participant MachinaAgent
    participant HabilisServer
    participant Tools

    User->>MachinaAgent: Message
    MachinaAgent->>HabilisServer: Get context/tools
    HabilisServer->>Tools: Query services
    Tools-->>HabilisServer: Response
    HabilisServer-->>MachinaAgent: Context data
    MachinaAgent->>LLM: Generate response
    LLM-->>MachinaAgent: Response plan
    MachinaAgent->>HabilisServer: Execute tools
    HabilisServer->>Tools: Call endpoints
    Tools-->>HabilisServer: Tool results
    HabilisServer-->>MachinaAgent: Processed data
    MachinaAgent-->>User: Final response
```

## Why Machina Habilis?

1. **Evolutionary Architecture**  
   Clear separation between infrastructure and cognition layers

2. **Distributed Cognition**  
   Tools remain decoupled from agent core

3. **Protocol-first Design**  
   MCP enables cross-platform interoperability

4. **Secure Foundation**  
   Crypto-native identity & permissions

## License

GPL-3.0 © [Elite Agents](https://github.com/elite-agents)
