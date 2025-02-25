import { OldowanTool } from '@elite-agents/oldowan';
import { z } from 'zod';

const COINGECKO_TOKEN_DATA_API =
  'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=';

const getTokenInfoSchema = {
  query: z.string().describe('Name of the token'),
};

interface ICoingeckoToken {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  fully_diluted_valuation: number;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  market_cap_change_24h: number;
  market_cap_change_percentage_24h: number;
  circulating_supply: number;
  total_supply: number;
  max_supply: number;
  ath: number;
  ath_change_percentage: number;
  ath_date: string;
  atl: number;
  atl_change_percentage: number;
  atl_date: string;
  last_updated: string;
}

export const getTokenInfoTool = new OldowanTool<typeof getTokenInfoSchema>({
  name: 'getTokenInfo',
  description:
    'Get details of a token like current price (current, all time high, all time low), price changes, market cap value, rank, volume, supply (total, circulating) using token name',
  schema: getTokenInfoSchema,
  execute: async (input) => {
    const { query } = input;

    const response = await OldowanTool.fetch<ICoingeckoToken[]>(
      `${COINGECKO_TOKEN_DATA_API}${query}`,
    );

    if (!response) {
      throw new Error('No tokens found');
    }

    const token = response.find((token) => token.id === query.toLowerCase());

    if (!token) {
      throw new Error(`Token not found: ${input.query}`);
    }

    return JSON.stringify(token);
  },
});
