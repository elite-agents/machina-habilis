import { OldowanTool } from '@elite-agents/oldowan';
import { z } from 'zod';
import { PublicKey, Connection } from '@solana/web3.js';
import { constructSwapTransaction } from './utils/swap';
import bs58 from 'bs58';

const RPC_URL = process.env.RPC_URL || 'https://api.mainnet-beta.solana.com';

const blinkSwapSchema = {
  inputToken: z
    .string()
    .describe(
      'Input token mint address, this needs to be a Base58 string, find it with searchToken if necessary'
    ),
  outputToken: z
    .string()
    .describe(
      'Output token mint address, this needs to be a Base58 string, find it with searchToken if necessary'
    ),
  amount: z.number().describe('Amount of input token to swap'),
  walletAddress: z
    .string()
    .describe(
      'Wallet address to perform the swap from, defaults to the user wallet'
    ),
};

export const blinkSwapTool = new OldowanTool<typeof blinkSwapSchema>({
  name: 'blinkSwap',
  description: 'Perform a quick token swap using Jupiter Exchange',
  schema: blinkSwapSchema,
  async execute(input) {
    try {
      const connection = new Connection(RPC_URL);
      const walletPublicKey = new PublicKey(input.walletAddress);

      const { transaction, outputUIAmount } = await constructSwapTransaction(
        connection,
        walletPublicKey,
        input.inputToken,
        input.outputToken,
        input.amount
      );

      const blinkJson = {
        icon: `https://jup.ag/_next/image?url=%2Fsvg%2Fjupiter-logo.png&w=48&q=75`,
        label: `Swap ${input.amount} ${input.inputToken} for ${outputUIAmount} ${input.outputToken}`,
        title: `Swap ${input.inputToken} for ${input.outputToken}`,
        description: `Swap ${input.amount} ${input.inputToken} for ${input.outputToken} via Jupiter`,
        transaction,
      };

      // Convert JSON to base58
      const blinkJsonStr = JSON.stringify(blinkJson);
      const blinkJsonBytes = new TextEncoder().encode(blinkJsonStr);
      const base58Data = bs58.encode(blinkJsonBytes);

      return `https://dev-api.eliteagents.ai/blink/${base58Data}`;
    } catch (error) {
      throw new Error(
        `Swap failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  },
});
