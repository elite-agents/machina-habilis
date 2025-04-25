// src/tools/solana-transfer.ts
import { OldowanTool } from '@elite-agents/oldowan';
import { z } from 'zod';
import { Keypair, PublicKey } from '@solana/web3.js';
import {
  create,
  mplCore,
  fetchCollection,
} from '@metaplex-foundation/mpl-core';
import { getBlinkDirective, RPC_URL } from '../utils/utils';

import { generateSigner } from '@metaplex-foundation/umi';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import {
  fromWeb3JsPublicKey,
  toWeb3JsLegacyTransaction,
} from '@metaplex-foundation/umi-web3js-adapters';
import { walletAdapterIdentity } from '@metaplex-foundation/umi-signer-wallet-adapters';

export const mintNftTool = new OldowanTool({
  name: 'mint_nft',
  description: `Create an unsigned transaction to mint an NFT as a Solana BLINK.
  
  The returned string is a special :blink directive that must be displayed EXACTLY as-is.

⚠️ CRITICAL INSTRUCTION ⚠️
The output of this tool MUST be displayed to the user EXACTLY as-is, with NO CHANGES.
- Include the output on its own line
- Do NOT wrap it in brackets, links, or any formatting
- Do NOT modify any values in the output
- Do NOT add explanatory text before or after the output

FAILURE TO FOLLOW THESE INSTRUCTIONS WILL CAUSE THE TRANSACTION TO FAIL.
  `,
  schema: {
    collectionMint: z
      .string()
      .optional()
      .describe('Collection mint address (optional)'),
    ownerPublicKey: z.string().describe('Owner wallet address'),
    name: z.string().describe('NFT name'),
    uri: z.string().describe('NFT metadata URI'),
  },
  async execute({ collectionMint, ownerPublicKey, name, uri }) {
    try {
      // Create UMI instance with connection
      const umi = createUmi(RPC_URL).use(mplCore());
      umi.use(
        walletAdapterIdentity({
          publicKey: new PublicKey(ownerPublicKey),
        }),
      );

      let collection;
      if (collectionMint) {
        const umiCollectionMint = fromWeb3JsPublicKey(
          new PublicKey(collectionMint),
        );
        collection = await fetchCollection(umi, umiCollectionMint);
      }

      const assetSigner = generateSigner(umi);
      const createArgs: any = {
        name,
        uri,
        asset: assetSigner,
      };
      if (collection) {
        createArgs.collection = collection;
      }

      const txnBuilder = create(umi, createArgs);
      // Build & serialize the transaction
      const blockhash = await umi.rpc.getLatestBlockhash();
      const transaction = txnBuilder
        .setBlockhash(blockhash.blockhash)
        .build(umi);
      const web3JsTransaction = toWeb3JsLegacyTransaction(transaction);
      web3JsTransaction.partialSign(
        Keypair.fromSecretKey(assetSigner.secretKey),
      );

      const serializedTransaction = web3JsTransaction
        .serialize({ requireAllSignatures: false })
        .toString('base64');

      // Create the BLINK JSON
      const blinkJson = {
        icon: 'https://pbs.twimg.com/profile_images/1472933274209107976/6u-LQfjG_400x400.jpg',
        label: `Mint NFT`,
        title: `Mint NFT: ${name}`,
        description: `Mint a new NFT named ${name} with URI ${uri}`,
        transaction: serializedTransaction,
      };

      return getBlinkDirective(blinkJson);
    } catch (error: any) {
      throw new Error(`Creating mint NFT transaction failed: ${error.message}`);
    }
  },
});
