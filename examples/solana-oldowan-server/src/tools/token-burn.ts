import { OldowanTool } from '@elite-agents/oldowan';
import { z } from 'zod';

const tokenBurnToolSchema = {
  token: z
    .enum(['ki', 'gene'])
    .describe('token name to use to get its burn data'),
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

export const tokenBurnTool = new OldowanTool<typeof tokenBurnToolSchema>({
  name: 'tokenBurn',
  description: 'Token (KI, Genopets, Gene) Burn amount data by weekly',
  schema: tokenBurnToolSchema,
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
            WITH token_actions AS (
              -- Get burn amounts
              SELECT 
                  DATE_TRUNC('week', block_timestamp) AS week_date,
                  burn_amount/POW(10, decimal) AS burn_amount,
                  0 AS mint_amount
              FROM solana.defi.fact_token_burn_actions
              WHERE mint = '${tokenMint}'
              AND block_timestamp >= DATEADD(day, -70, CURRENT_TIMESTAMP)
              AND succeeded = true
              
              UNION ALL
              
              -- Get mint amounts
              SELECT 
                  DATE_TRUNC('week', block_timestamp) AS week_date,
                  0 AS burn_amount,
                  mint_amount/POW(10, decimal) AS mint_amount
              FROM solana.defi.fact_token_mint_actions
              WHERE mint = '${tokenMint}'
              AND block_timestamp >= DATEADD(day, -70, CURRENT_TIMESTAMP)
              AND succeeded = true
          )
    
          SELECT 
              week_date,
              SUM(burn_amount) AS total_burned,
              SUM(mint_amount) AS total_minted,
              SUM(mint_amount - burn_amount) AS net_amount
          FROM token_actions
          GROUP BY 1
          ORDER BY week_date DESC;
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
        body: JSON.stringify(requestBody),
        headers,
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
            headers,
          });
          queryResultData = response?.result?.rows;
          if ((queryResultData?.length ?? 0) > 0) {
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
