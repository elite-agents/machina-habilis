import { OldowanTool } from '@elite-agents/oldowan';
import { z } from 'zod';

const tokenVolumeHolderCountToolSchema = {
  token: z
    .enum(['ki', 'gene'])
    .describe('token name to use to get its holder, volume count data'),
};

const FLIPSIDE_API_KEY = '744d64da-da43-441f-963d-09bb247230fb';
const FLIPSIDE_JSON_RPC_URL = 'https://api-v2.flipsidecrypto.xyz/json-rpc';

const headers = {
  'Content-Type': 'application/json',
  'x-api-key': FLIPSIDE_API_KEY,
  Accept: 'application/json',
};

const KI_TOKEN_MINT = `kiGenopAScF8VF31Zbtx2Hg8qA5ArGqvnVtXb83sotc`;
const GENE_TOKEN_MINT = `GENEtH5amGSi8kHAtQoezp1XEXwZJ8vcuePYnXdKrMYz`;

export const tokenVolumeHolderCountTool = new OldowanTool<
  typeof tokenVolumeHolderCountToolSchema
>({
  name: 'tokenVolumeHolderCountTool',
  description:
    'Get token(KI, Genopets, Gene) holder count(buy, sell, ratio), volume(buy, sell) data by weekly',
  schema: tokenVolumeHolderCountToolSchema,
  execute: async (input) => {
    const { token } = input;

    // default to ki
    let tokenMint = KI_TOKEN_MINT;
    if (token === 'gene') {
      tokenMint = GENE_TOKEN_MINT;
    }

    const requestBody = {
      jsonrpc: '2.0',
      id: 1,
      method: 'createQueryRun',
      params: [
        {
          sql: `
            WITH dex_activity AS (
            SELECT 
                DATE_TRUNC('day', block_timestamp) as trade_date,
                COUNT(CASE WHEN swap_to_mint = '${tokenMint}' THEN 1 END) as buy_count,
                COUNT(CASE WHEN swap_from_mint = '${tokenMint}' THEN 1 END) as sell_count,
                SUM(CASE WHEN swap_to_mint = '${tokenMint}' THEN swap_to_amount ELSE 0 END) as buy_volume,
                SUM(CASE WHEN swap_from_mint = '${tokenMint}' THEN swap_from_amount ELSE 0 END) as sell_volume
            FROM solana.defi.ez_dex_swaps
            WHERE (swap_from_mint = '${tokenMint}' 
                OR swap_to_mint = '${tokenMint}')
                AND block_timestamp >= DATEADD('day', -70, CURRENT_TIMESTAMP)
            GROUP BY 1
            )
            SELECT 
                trade_date,
                buy_count,
                sell_count,
                ROUND(buy_count::FLOAT / NULLIF(sell_count, 0), 2) as buy_sell_ratio,
                buy_volume,
                sell_volume,
                ROUND(buy_volume::FLOAT / NULLIF(sell_volume, 0), 2) as volume_ratio
            FROM dex_activity
            ORDER BY trade_date DESC;
          `,
          ttlMinutes: 60,
          maxAgeMinutes: 60,
          dataSource: 'snowflake-default',
          dataProvider: 'flipside',
        },
      ],
    };

    try {
      const data = await OldowanTool.fetch<{
        result?: { queryRun?: { id?: string } };
      }>(FLIPSIDE_JSON_RPC_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      const queryRunId = data?.result?.queryRun?.id;

      try {
        let queryResultData;
        let getQueryResultAttemps = 0;
        // fetch the query result with max attempt retries
        while (getQueryResultAttemps < 5) {
          const response = await OldowanTool.fetch<{
            result?: {
              queryRun?: {
                id?: string;
              };
              rows: [];
            };
            error?: {
              message?: string;
            };
          }>(FLIPSIDE_JSON_RPC_URL, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 2,
              method: 'getQueryRunResults',
              params: [
                {
                  queryRunId: queryRunId,
                  format: 'json',
                  page: {
                    number: 1,
                    size: 100,
                  },
                },
              ],
            }),
          });
          queryResultData = response?.result?.rows;
          if ((queryResultData!?.length ?? 0) > 0) {
            break;
          }

          await new Promise((res) => setTimeout(() => res(true), 1000));
          getQueryResultAttemps++;
        }

        return JSON.stringify(queryResultData);
      } catch (errorResult: any) {
        throw new Error(errorResult?.message);
      }
    } catch (errorQuery: any) {
      throw new Error(errorQuery?.message);
    }
  },
});
