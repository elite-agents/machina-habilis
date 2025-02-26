import { OldowanTool } from '@elite-agents/oldowan';
import { z } from 'zod';

const COINGECKO_TRENDING_TOKENS_API =
  'https://api.coingecko.com/api/v3/search/trending';

const trendingTokensSchema = {
  type: z
    .enum(['coins', 'nfts', 'categories'])
    .describe('category type of what is currently trending in crypto industry'),
};

export const trendingTokensTool = new OldowanTool<typeof trendingTokensSchema>({
  name: 'trendingTokens',
  description:
    'Get the current trending search coins, nfts, categories on CoinGecko',
  schema: trendingTokensSchema,
  execute: async (input) => {
    const { type } = input;

    const responseData = await OldowanTool.fetch<{
      coins: [];
      nfts: [];
      categories: [];
    }>(COINGECKO_TRENDING_TOKENS_API);

    if (!responseData) {
      throw new Error('No tokens found');
    }

    if (!responseData[type]) {
      throw new Error(`${type} is not supported!`);
    }
    return JSON.stringify(responseData[type]);
  },
});
