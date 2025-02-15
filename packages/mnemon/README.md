# @elite-agents/mnemon 🧠

**Mnemon** is a library for building AI memory systems following MCP standards. Provides 2 interfaces for retrieving and inserting memories while remaining unopinionated about storage implementations.

## Features

- 🧩 Modular memory architecture, bring your own system
- ⚡ Bun runtime optimized for real-time operations
- 🔄 MCP-compatible API surface
- 📦 Type-safe core interfaces

## Quick Start

1. **Define Memory Implementations**:

```typescript
class CustomMemorySystem {
  async recall(
    messageLifecycle: IMessageLifecycle,
  ): Promise<IMessageLifecycle> {
    // Your implementation for retrieving memories
  }

  async remember(
    messageLifecycle: IMessageLifecycle,
  ): Promise<IMessageLifecycle> {
    // Your implementation for inserting new memories
  }
}
```

2. **Configure Server**:

```typescript
import { MnemonServer } from '@elite-agents/mnemon';

const server = new MnemonServer({
  port: 3000,
  getContextFromQuery: CustomMemorySystem.recall,
  insertKnowledge: CustomMemorySystem.remember,
});

Bun.serve({
  ...server,
  idleTimeout: 255, // SSE connection setting
});
```

## API Reference

### `MnemonServer`

```typescript
new MnemonServer(options: {
  port?: number; // default: 8888
  getContextFromQuery: GetContextFn;
  insertKnowledge: InsertKnowledgeFn;
})
```
