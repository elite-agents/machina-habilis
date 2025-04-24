import { OldowanServer } from '@elite-agents/oldowan';
import { solanaTransferTool } from './src/tools/solana-transfer';
import { getWorkerEnv, setWorkerEnv } from './src/utils/utils';
import { mintNftTool } from './src/tools/mint_nft';
import { createCollectionTool } from './src/tools/create_collection';
import { blinkSwapTool } from './src/tools/blink-swap';
import { getTokenInfoTool } from './src/tools/get-token-info';
import { searchTokenTool } from './src/tools/search-token';
import { tokenBurnTool } from './src/tools/token-burn';
import { tokenVolumeHolderCountTool } from './src/tools/token-volume-holder-count';
import { trendingTokensTool } from './src/tools/trending-tokens';

const oldowan = new OldowanServer('Solana Operations Service', '1.0.0', {
  tools: [
    solanaTransferTool,
    createCollectionTool,
    mintNftTool,
    blinkSwapTool,
    getTokenInfoTool,
    searchTokenTool,
    tokenBurnTool,
    tokenVolumeHolderCountTool,
    trendingTokensTool,
  ],
  port: 3004,
});

// Reusable handler for blink KV fetch
async function handleBlinkKVRequest(c) {
  const key = c.req.param('key');
  const blinkJson = await getWorkerEnv().BLINK_EPHEMERAL_STORE.get(key);
  return c.json(JSON.parse(blinkJson));
}

// Add blink KV routes to the Hono server
oldowan.honoServer.post('/blink/:key', handleBlinkKVRequest);
oldowan.honoServer.get('/blink/:key', handleBlinkKVRequest);

export default {
  ...oldowan.honoServer,
  fetch: async (request, env, ctx) => {
    // We need to set the worker environment here at the beginning of the fetch handler
    // to ensure Cloudflare Workers environment variables are accessible throughout
    // the request lifecycle, specifically for the BLINK_EPHEMERAL_STORE KV access.
    // This is because the Oldowan Tool doesn't get the env forwarded to its `execute` handler.
    setWorkerEnv(env);
    return oldowan.honoServer.fetch(request);
  },
};
