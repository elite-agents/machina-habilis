import { MnemonServer } from '@elite-agents/mnemon';

const isDocker = () => process.env.IS_DOCKER === 'true';

const mnemon = new MnemonServer({
  proxyPort: 3002,
  ssePort: 6002,
});

// Initialize the server with configurations
await mnemon.init(
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
  }
);

export default mnemon;
