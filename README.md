# Machina Habilis 🛠️ - TypeScript Framework for Tool-Using Autonomous Agents

**Machina Habilis** is a lightweight TypeScript framework enabling sophisticated tool usage through the Model Context Protocol (MCP). Named after the Homo Habilis, humanity's first tool-using species, it comprises two core libraries:

1. **🪨 @elite-agents/oldowan** - Foundational tool server implementation that allows you to quickly build custom agent tools or wrap existing APIs into MCP-compatible tools with HTTP transport and OpenAPI 3.0 support with payment-gating
2. **🛠️ @elite-agents/machina-habilis** - Tool-first agent library with:
   - `MachinaAgent`: Cognitive layer for conversation handling that connects directly to LLMs and memory systems
   - `HabilisServer`: Optional infrastructure layer for tool management and MCP connection orchestration
   - `Mnemon`: Simple memory system that enables agents to store and retrieve contextual information

```mermaid
graph TD
    subgraph "With HabilisServer"
        A1[MachinaAgent] -->|Talks Via| B[HabilisServer]
        B -->|MCP| D[Oldowan Tools Server]
        B -->|MCP| E[3rd-party Tools Server]
        A1 -->|Connects to| F[Custom Memory System]
        A1 -->|Connects to| LLM1[LLM Service]
        D --> G[External APIs]
        E --> H[Other Services]
    end

    subgraph "Without Habilis Server"
        A2[MachinaAgent] -->|MCP| D2[Oldowan Tools Server]
        A2 -->|MCP| E2[3rd-party Tools Server]
        A2 -->|Connects to| F2[Custom Memory System]
        A2 -->|Connects to| LLM2[LLM Service]
        D2 --> G2[External APIs]
        E2 --> H2[Other Services]
    end
```

## Features

- **Flexible Architecture**  
  MachinaAgent can operate with HabilisServer for tool orchestration or connect directly to MCP tools for different deployment scenarios
- **Direct LLM Integration**  
  Seamless connections to AI models from OpenAI, Anthropic, Google, etc.
- **Customizable Memory Management**  
  Bring your own memory system or use the included Mnemon implementation
- **Distributed Tool Ecosystem**  
  Discover/use tools across multiple MCP servers
- **Stateless MCP Servers**  
  Uses the latest MCP Spec of HTTP (not SSE) so MCP servers can be deployed in a stateless manner
- **OpenAPI 3.0 Support**  
  Define and expose tool endpoints with standardized documentation

```bash
bun add @elite-agents/oldowan
```

- MCP-compliant tool servers
- Automatic validation & security
- Zero-config server setup
- REST API wrapping with OpenAPI specifications

## Quick Start

1. **Install dependencies**:

```bash
bun install
```

2. **Start example services** (from repository root):

```bash
docker compose up --build
```

> **Note**: Requires [Docker](https://docker.com) and [Bun](https://bun.sh) installed

## Using The Framework

1. **Create Agent with HabilisServer**:

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

2. **Create Standalone Agent**:

```typescript
import { MachinaAgent } from '@elite-agents/habilis';
import { Keypair } from '@solana/web3.js';

const agent = new MachinaAgent(null, {
  persona: {
    name: 'Task Assistant',
    bio: ['Efficient', 'Precise'],
  },
  abilities: {
    weather: {
      name: 'get_weather',
      description: 'Get weather information',
      schema: { location: 'string' },
    },
    // Other abilities
  },
  llm: {
    provider: 'anthropic',
    name: 'claude-3-opus',
    apiKey: 'sk-your-key',
  },
  keypair: Keypair.generate(),
});
```

3. **Use Your Agent**:

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
- Direct tool execution (when used standalone)
- Memory operations for context management

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

3. **Flexible Deployment**  
   Use with HabilisServer for local systems or standalone for distributed applications

4. **Protocol-first Design**  
   MCP enables cross-platform interoperability

5. **HTTP and OpenAPI Standards**  
   Built on reliable and widely-adopted web standards

6. **Secure Foundation**  
   Crypto-native identity & permissions

## License

GPL-3.0 © [Elite Agents](https://github.com/elite-agents)
