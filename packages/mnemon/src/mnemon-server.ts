import {
  type IMessageLifecycle,
  ZMessageLifecycle,
  GET_CONTEXT_FROM_QUERY_TOOL_NAME,
  INSERT_KNOWLEDGE_TOOL_NAME,
} from '@elite-agents/machina-habilis';
import { SimpleRAG } from './rag/SimpleRAG';
import type { AIConfig, FalkorConfig, PostgresConfig } from './rag/types';
import { RecencyRAG } from './rag/RecencyRAG';
import { OldowanServer, OldowanTool } from '@elite-agents/oldowan';

export class MnemonServer extends OldowanServer {
  simpleRag: SimpleRAG | undefined;
  recencyRag: RecencyRAG | undefined;
  oldowanServer: OldowanServer | undefined;

  constructor(opts: { proxyPort: number; ssePort: number }) {
    const getContextFromQueryTool = new OldowanTool({
      name: GET_CONTEXT_FROM_QUERY_TOOL_NAME,
      description: 'Get context for a message',
      schema: {
        lifecycle: ZMessageLifecycle,
      },
      execute: async (args) => {
        return await this.getContextFromQuery(args.lifecycle);
      },
    });

    const insertKnowledgeTool = new OldowanTool({
      name: INSERT_KNOWLEDGE_TOOL_NAME,
      description: 'Insert knowledge for a message',
      schema: {
        lifecycle: ZMessageLifecycle,
      },
      execute: async (args) => {
        return await this.insertKnowledge(args.lifecycle);
      },
    });

    super('Mnemon Server', '1.0.0', {
      tools: [getContextFromQueryTool, insertKnowledgeTool],
      proxyPort: opts.proxyPort,
      ssePort: opts.ssePort,
    });
  }

  async init(
    aiConfig: AIConfig,
    dbConfig: FalkorConfig,
    postgresConfig: PostgresConfig
  ): Promise<void> {
    try {
      this.simpleRag = new SimpleRAG(aiConfig, dbConfig);
      await this.simpleRag.init();
      this.recencyRag = new RecencyRAG(aiConfig, postgresConfig);
      await this.recencyRag.init();
    } catch (error) {
      console.error('Failed to initialize Memory Server: ', error);
      throw error;
    }
  }

  async getContextFromQuery(
    lifecycle: IMessageLifecycle
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
          lifecycle.channelId ?? undefined
        ),
        this.recencyRag.query(
          lifecycle.agentPubkey,
          lifecycle.channelId ?? 'None'
        ),
      ]);

      console.log('Simple RAG Results: ', simpleRagResults);
      console.log('Recency RAG Results: ', recencyRagResults);

      lifecycle.context.push(
        `\n# Entities Found In Previous Memory\n${simpleRagResults.join('\n')}`
      );

      lifecycle.context.push(
        `\n# Messages Found In Recent Memory\n${recencyRagResults.join('\n')}`
      );

      return lifecycle;
    } catch (error) {
      // LOG ERROR
      return lifecycle;
    }
  }

  async insertKnowledge(
    lifecycle: IMessageLifecycle
  ): Promise<IMessageLifecycle> {
    try {
      if (!this.simpleRag || !this.recencyRag) {
        return lifecycle;
      }

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
          lifecycle.channelId ?? undefined
        ),
        this.recencyRag.insert(
          lifecycle.message,
          'user',
          lifecycle.agentPubkey,
          {
            channelId: lifecycle.channelId ?? 'None',
            createdAt: lifecycle.createdAt,
          }
        ),
        this.recencyRag.insert(
          lifecycle.output,
          'agent',
          lifecycle.agentPubkey,
          {
            channelId: lifecycle.channelId ?? 'None',
            createdAt: lifecycle.createdAt,
          }
        ),
      ]);

      return lifecycle;
    } catch (error) {
      // LOG ERROR
      return lifecycle;
    }
  }
}
