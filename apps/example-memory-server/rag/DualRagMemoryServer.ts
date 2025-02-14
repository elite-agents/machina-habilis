import { RecencyRAG } from './RecencyRAG';
import type { IMessageLifecycle } from '@elite-agents/machina-habilis';
import { SimpleRAG } from './SimpleRAG';
import type { AIConfig, FalkorConfig, PostgresConfig } from './types';

export class DualRagMemoryServer {
  private simpleRag: SimpleRAG;
  private recencyRag: RecencyRAG;

  constructor(
    aiConfig: AIConfig,
    falkorConfig: FalkorConfig,
    postgresConfig: PostgresConfig,
  ) {
    this.simpleRag = new SimpleRAG(aiConfig, falkorConfig);
    this.recencyRag = new RecencyRAG(aiConfig, postgresConfig);
  }

  async init(): Promise<void> {
    try {
      await this.simpleRag.init();
      await this.recencyRag.init();
    } catch (error) {
      console.error('Failed to initialize Memory Server: ', error);
      throw error;
    }
  }

  async getContextFromQuery(
    lifecycle: IMessageLifecycle,
  ): Promise<IMessageLifecycle> {
    try {
      console.log(`Fetching context for`, { lifecycle });
      if (!this.simpleRag || !this.recencyRag) {
        return lifecycle;
      }
      const [simpleRagResults, recencyRagResults] = await Promise.all([
        this.simpleRag.query(
          lifecycle.message,
          lifecycle.agentPubkey,
          lifecycle.channelId ?? undefined,
        ),
        this.recencyRag.query(
          lifecycle.agentPubkey,
          lifecycle.channelId ?? 'None',
        ),
      ]);

      console.log('Simple RAG Results: ', simpleRagResults);
      console.log('Recency RAG Results: ', recencyRagResults);

      lifecycle.context.push(
        `\n# Entities Found In Previous Memory\n${simpleRagResults.join('\n')}`,
      );

      lifecycle.context.push(
        `\n# Messages Found In Recent Memory\n${recencyRagResults.join('\n')}`,
      );

      return lifecycle;
    } catch (error) {
      // LOG ERROR
      return lifecycle;
    }
  }

  async insertKnowledge(
    lifecycle: IMessageLifecycle,
  ): Promise<IMessageLifecycle> {
    try {
      if (!this.simpleRag || !this.recencyRag) {
        return lifecycle;
      }

      console.log('Inserting knowledge', { lifecycle });

      const simpleRagMsgToInsert = `
  # User Message
  ${lifecycle.message}
  
  # Agent Reply
  ${lifecycle.output}            
            `;

      await Promise.all([
        this.simpleRag.insert(
          simpleRagMsgToInsert,
          lifecycle.agentPubkey,
          lifecycle.channelId ?? undefined,
        ),
        this.recencyRag.insert(
          lifecycle.message,
          'user',
          lifecycle.agentPubkey,
          {
            channelId: lifecycle.channelId ?? 'None',
            createdAt: lifecycle.createdAt,
          },
        ),
        this.recencyRag.insert(
          lifecycle.output,
          'agent',
          lifecycle.agentPubkey,
          {
            channelId: lifecycle.channelId ?? 'None',
            createdAt: lifecycle.createdAt,
          },
        ),
      ]);

      return lifecycle;
    } catch (error) {
      // LOG ERROR
      return lifecycle;
    }
  }
}
