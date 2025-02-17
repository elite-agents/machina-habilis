import { searchTokenTool } from './src/tools/search-token';
import { blinkSwapTool } from './src/tools/blink-swap';
import { OldowanServer } from '@elite-agents/oldowan';

const oldowan = new OldowanServer('example-oldowan-server', '0.0.1', {
  tools: [searchTokenTool, blinkSwapTool],
  port: 3003,
});

export default oldowan.honoServer;
