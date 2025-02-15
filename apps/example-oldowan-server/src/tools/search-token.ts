import { OldowanTool } from '@elite-agents/oldowan';
import { z } from 'zod';

const JUPITER_TOKEN_LIST_API = 'https://tokens.jup.ag/tokens?tags=verified';

const searchTokenSchema = {
  query: z.string().describe('Token symbol to search for'),
};

export const searchTokenTool = new OldowanTool<typeof searchTokenSchema>({
  name: 'searchToken',
  description: 'Search for a token by symbol to get its token mint address',
  schema: searchTokenSchema,
  execute: async (input) => {
    const response = await OldowanTool.fetch<
      { symbol: string; address: string }[]
    >(JUPITER_TOKEN_LIST_API);

    if (!response) {
      throw new Error('No tokens found');
    }

    const token = response.find(
      (token) => token.symbol === input.query.toUpperCase(),
    );

    if (!token) {
      throw new Error(`Token not found: ${input.query}`);
    }

    return JSON.stringify({
      symbol: token.symbol,
      address: token.address,
    });
  },
});
