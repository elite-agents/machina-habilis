import { searchTokenTool } from './tools/search-token';
import { blinkSwapTool } from './tools/blink-swap';
import { OldowanServer } from '@elite-agents/oldowan';

const oldowan = new OldowanServer('example-oldowan-server', '0.0.1', {
  tools: [searchTokenTool, blinkSwapTool],
  port: 8787,
});

export default oldowan;
