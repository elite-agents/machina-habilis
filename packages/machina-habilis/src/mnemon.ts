import { Hono } from 'hono';
import { ZAgentPromptState } from './types';
import type { MemoryFunction, MemoryService, IAgentPromptState } from './types';
import { cors } from 'hono/cors';

export class MnemonServer {
  app: Hono;

  recallMemory: MemoryFunction;
  createMemory: MemoryFunction;

  constructor(opts: MemoryService) {
    this.app = new Hono();
    this.recallMemory = opts.recallMemory;
    this.createMemory = opts.createMemory;

    this.app.use(
      '*',
      cors({
        origin: '*',
        allowMethods: ['POST', 'OPTIONS'],
        allowHeaders: ['Content-Type'],
      }),
    );

    this.app.post('/recall-memory', async (c) => {
      const lifecycle = await c.req.json();

      const result = ZAgentPromptState.safeParse(lifecycle);
      if (!result.success) {
        return c.json(
          { error: 'Invalid lifecycle payload', details: result.error },
          400,
        );
      }

      const memory = await this.recallMemory(result.data);
      return c.json(memory);
    });

    this.app.post('/create-memory', async (c) => {
      const lifecycle = await c.req.json();

      const result = ZAgentPromptState.safeParse(lifecycle);
      if (!result.success) {
        return c.json(
          { error: 'Invalid lifecycle payload', details: result.error },
          400,
        );
      }

      const memory = await this.createMemory(result.data);
      return c.json(memory);
    });
  }
}

export class MnemonClient implements MemoryService {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async recallMemory(lifecycle: IAgentPromptState): Promise<IAgentPromptState> {
    const response = await fetch(`${this.baseUrl}/recall-memory`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(lifecycle),
    });

    if (!response.ok) {
      throw new Error(`Failed to recall memory: ${response.statusText}`);
    }

    const memory = await response.json();

    console.log('Recalled memory:', memory);

    return memory;
  }

  async createMemory(lifecycle: IAgentPromptState): Promise<IAgentPromptState> {
    const response = await fetch(`${this.baseUrl}/create-memory`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(lifecycle),
    });

    if (!response.ok) {
      throw new Error(`Failed to create memory: ${response.statusText}`);
    }

    return response.json();
  }
}
