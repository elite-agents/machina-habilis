import { HabilisServer, MachinaAgent } from '@elite-agents/machina-habilis';
import { Keypair } from '@solana/web3.js';

const habilisServer = new HabilisServer('http://localhost:3002/sse');

habilisServer.init(['http://localhost:3003/sse']);

const agent = new MachinaAgent(habilisServer, {
  persona: {
    name: 'John Doe',
    bio: ['John Doe is a software engineer at Google'],
  },
  abilityNames: new Set(['create_agent']),
  llm: {
    name: 'gpt-4o-mini',
    provider: 'openai',
    apiKey: 'sk-genopets-api-awaCHqoYAi6txZVHi5u9T3BlbkFJz6h7ZfQNAjxcSFDgrHov',
    endpoint: 'https://api.openai.com/v1',
  },
  keypair: Keypair.generate(),
});

const response = await agent.message('Hello, how are you?');

console.log('------------------------------');
console.log(response.output);
console.log('------------------------------');
