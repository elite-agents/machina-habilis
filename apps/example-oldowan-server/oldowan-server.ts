import { searchTokenTool } from './src/tools/search-token';
import { blinkSwapTool } from './src/tools/blink-swap';
import { OldowanServer } from '@elite-agents/oldowan';
import { getTokenInfoTool } from './src/tools/get-token-info';
import { trendingTokensTool } from './src/tools/trending-tokens';
import { tokenBurnTool } from './src/tools/token-burn';
import { tokenVolumeHolderCountTool } from './src/tools/token-volume-holder-count';

const oldowan = new OldowanServer('example-oldowan-server', '0.0.1', {
  tools: [
    searchTokenTool,
    blinkSwapTool,
    getTokenInfoTool,
    trendingTokensTool,
    tokenBurnTool,
    tokenVolumeHolderCountTool,
  ],
  port: 3003,
});

export default oldowan.honoServer;
