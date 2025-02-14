import { MnemonServer } from '@elite-agents/mnemon';
import { DualRagMemoryServer } from './rag/DualRagMemoryServer';

const isDocker = () => process.env.IS_DOCKER === 'true';

const rag = new DualRagMemoryServer(
  {
    baseUrl: 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY,
    vectorDimensions: 1536,
  },
  {
    socket: {
      host: isDocker() ? 'falkordb' : 'localhost',
      port: isDocker() ? 6379 : 6902,
    },
  },
  {
    host: isDocker() ? 'postgres' : 'localhost',
    port: isDocker() ? 5432 : 6901,
    user: 'postgres',
    password: 'postgres',
    database: 'memserver',
  },
);

await rag.init();

const mnemon = new MnemonServer({
  proxyPort: 3002,
  ssePort: 6002,
  getContextFromQuery: rag.getContextFromQuery.bind(rag),
  insertKnowledge: rag.insertKnowledge.bind(rag),
});

const proxyServer = await mnemon.getProxy();

export default proxyServer;
