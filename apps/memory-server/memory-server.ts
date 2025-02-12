import { MnemonServer } from '@elite-agents/mnemon';

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
  { socket: { host: 'falkordb', port: 6379 } },
  {
    host: 'postgres',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'memserver',
  }
);

export default mnemon;
