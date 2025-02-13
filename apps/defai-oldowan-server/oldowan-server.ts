import { searchTokenTool } from './src/tools/search-token';
import { blinkSwapTool } from './src/tools/blink-swap';
import { OldowanServer } from '@elite-agents/oldowan';

const oldowan = new OldowanServer('defai-oldowan-server', '0.0.1', {
  tools: [searchTokenTool, blinkSwapTool],
  proxyPort: 3003,
  ssePort: 6003,
});

export default oldowan;
