import { Connection, PublicKey } from '@solana/web3.js';
import { getMint } from '@solana/spl-token';
import BigNumber from 'bignumber.js';

export interface JupiterToken {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
  tags: string[];
  daily_volume: number;
  created_at: string;
  freeze_authority: string | null;
  mint_authority: string | null;
  permanent_delegate: string | null;
  minted_at: string | null;
  extensions?: {
    coingeckoId?: string;
    [key: string]: any;
  };
}

// The API returns an array of JupiterToken directly
export type TokenListResponse = JupiterToken[];

// Jupiter Quote API Response Types
export interface JupiterQuoteResponse {
  inputMint: string;
  outputMint: string;
  amount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  platformFee?: {
    amount: string;
    feeBps: number;
  };
  priceImpactPct: number;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
  }>;
  contextSlot?: number;
  timeTaken?: number;
  error?: string;
}

const SOL_ADDRESS = 'So11111111111111111111111111111111111111112';

// Jupiter Swap API Response Types
export interface JupiterSwapResponse {
  swapTransaction: string;
  error?: string;
}

async function getTokenDecimals(
  connection: Connection,
  tokenAddress: string,
): Promise<number> {
  try {
    console.log('connection:', connection.rpcEndpoint);
    const mint = await getMint(connection, new PublicKey(tokenAddress));
    return mint.decimals;
  } catch (error) {
    console.error('Error getting token decimals:', error);
    throw error;
  }
}

export async function constructSwapTransaction(
  connection: Connection,
  walletPublicKey: PublicKey,
  inputTokenCA: string,
  outputTokenCA: string,
  amount: number,
) {
  try {
    // Get the decimals for the input token
    const decimals =
      inputTokenCA === SOL_ADDRESS
        ? new BigNumber(9)
        : new BigNumber(await getTokenDecimals(connection, inputTokenCA));

    // Calculate adjusted amount with decimals
    const amountBN = new BigNumber(amount);
    const adjustedAmount = amountBN.multipliedBy(
      new BigNumber(10).pow(decimals),
    );

    console.log('Fetching quote with params:', {
      inputMint: inputTokenCA,
      outputMint: outputTokenCA,
      amount: adjustedAmount.toString(),
    });

    // Get quote from Jupiter API
    const quoteResponse = await fetch(
      `https://quote-api.jup.ag/v6/quote?inputMint=${inputTokenCA}&outputMint=${outputTokenCA}&amount=${adjustedAmount}&slippageBps=50`,
    );
    const quoteData = (await quoteResponse.json()) as JupiterQuoteResponse;

    if (!quoteData || quoteData.error) {
      throw new Error(
        `Failed to get quote: ${quoteData?.error || 'Unknown error'}`,
      );
    }

    // Request swap transaction
    const swapRequestBody = {
      quoteResponse: quoteData,
      userPublicKey: walletPublicKey.toString(),
      wrapAndUnwrapSol: true,
      computeUnitPriceMicroLamports: 2000000,
      dynamicComputeUnitLimit: true,
    };

    const swapResponse = await fetch('https://quote-api.jup.ag/v6/swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(swapRequestBody),
    });

    const swapData = (await swapResponse.json()) as JupiterSwapResponse;

    if (!swapData || !swapData.swapTransaction) {
      throw new Error(
        `Failed to get swap transaction: ${
          swapData?.error || 'No swap transaction returned'
        }`,
      );
    }

    const outputTokenDecimals =
      outputTokenCA === SOL_ADDRESS
        ? new BigNumber(9)
        : new BigNumber(await getTokenDecimals(connection, outputTokenCA));

    const outputUIAmount = new BigNumber(
      quoteData.otherAmountThreshold,
    ).dividedBy(new BigNumber(10).pow(outputTokenDecimals));

    return {
      transaction: swapData.swapTransaction,
      quote: quoteData,
      outputUIAmount,
    };
  } catch (error) {
    console.error('Error in constructSwapTransaction:', error);
    throw error;
  }
}
