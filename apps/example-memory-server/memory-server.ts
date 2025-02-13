import { MnemonServer } from '@elite-agents/mnemon';
import { DualRagMemoryServer } from './rag/DualRagMemoryServer';

const isDocker = () => process.env.IS_DOCKER === 'true';
const proxyPort = +(process.env.PROXY_PORT || 3002);
const ssePort = +(process.env.SSE_PORT || 6002);

const rag = new DualRagMemoryServer(
  {
    baseUrl: 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY,
    vectorDimensions: 1536,
  },
  {
    socket: {
      host: process.env.FALKORDB_HOST ?? (isDocker() ? 'falkordb' : 'localhost'),
      port: +(process.env.FALKORDB_PORT ?? (isDocker() ? 6379 : 6902)),
    },
    username: process.env.FALKORDB_USER ?? '',
    password: process.env.FALKORDB_PASSWORD ?? '',
  },
  {
    host: process.env.POSTGRES_HOST ?? (isDocker() ? 'postgres' : 'localhost'),
    port: +(process.env.POSTGRES_PORT ?? (isDocker() ? 5432 : 6901)),
    user: process.env.POSTGRES_USER ?? 'postgres',
    password: process.env.POSTGRES_PASSWORD ?? 'postgres',
    database: process.env.POSTGRES_DB ?? 'memserver'
  }
);

await rag.init();

const mnemon = new MnemonServer({
  proxyPort,
  ssePort,
  getContextFromQuery: rag.getContextFromQuery,
  insertKnowledge: rag.insertKnowledge,
});

const proxyServer = await mnemon.getProxy();

export default proxyServer;
