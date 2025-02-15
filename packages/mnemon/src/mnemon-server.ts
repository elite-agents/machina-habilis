import {
  type IMessageLifecycle,
  ZMessageLifecycle,
  GET_CONTEXT_FROM_QUERY_TOOL_NAME,
  INSERT_KNOWLEDGE_TOOL_NAME,
} from '@elite-agents/machina-habilis';
import { OldowanServer, OldowanTool } from '@elite-agents/oldowan';

export type GetContextFn = (
  lifecycle: IMessageLifecycle,
) => Promise<IMessageLifecycle>;

export type InsertKnowledgeFn = (
  lifecycle: IMessageLifecycle,
) => Promise<IMessageLifecycle>;

export class MnemonServer extends OldowanServer {
  constructor(opts: {
    port?: number;
    getContextFromQuery: GetContextFn;
    insertKnowledge: InsertKnowledgeFn;
  }) {
    const getContextFromQueryTool = new OldowanTool({
      name: GET_CONTEXT_FROM_QUERY_TOOL_NAME,
      description: 'Get context for a message',
      schema: {
        lifecycle: ZMessageLifecycle,
      },
      execute: async (args) => {
        return await opts.getContextFromQuery(args.lifecycle);
      },
    });

    const insertKnowledgeTool = new OldowanTool({
      name: INSERT_KNOWLEDGE_TOOL_NAME,
      description: 'Insert knowledge for a message',
      schema: {
        lifecycle: ZMessageLifecycle,
      },
      execute: async (args) => {
        return await opts.insertKnowledge(args.lifecycle);
      },
    });

    super('Mnemon Server', '1.0.0', {
      tools: [getContextFromQueryTool, insertKnowledgeTool],
      port: opts.port,
    });
  }
}
