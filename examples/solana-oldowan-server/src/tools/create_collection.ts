import { OldowanTool } from '@elite-agents/oldowan';
import { z } from 'zod';
import { Keypair, PublicKey as Web3JsPublicKey } from '@solana/web3.js';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { mplCore, createCollection } from '@metaplex-foundation/mpl-core';
import { generateSigner } from '@metaplex-foundation/umi';
import { getBlinkDirective, RPC_URL } from '../utils/utils';
import { walletAdapterIdentity } from '@metaplex-foundation/umi-signer-wallet-adapters';
import {
  fromWeb3JsPublicKey,
  toWeb3JsLegacyTransaction,
} from '@metaplex-foundation/umi-web3js-adapters';

export const createCollectionTool = new OldowanTool({
  name: 'create_collection',
  description: `Create a new Solana NFT Collection and return a Solana BLINK for signing.

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
    payerPublicKey: z
      .string()
      .describe('Payer wallet address (will own the collection NFT)'),
    name: z.string().describe('Collection name'),
    uri: z.string().describe('Collection metadata URI'),
  },
  async execute({ payerPublicKey, name, uri }) {
    try {
      const ownerPublicKey = new Web3JsPublicKey(payerPublicKey);
      // Initialize UMI with the mplCore plugin
      const umi = createUmi(RPC_URL).use(mplCore());
      umi.use(
        walletAdapterIdentity({
          publicKey: ownerPublicKey,
        }),
      );

      // Create Collection
      const collectionUpdateAuthority = fromWeb3JsPublicKey(ownerPublicKey);
      // - create random generated collection address
      const collectionAddress = generateSigner(umi);
      const txnBuilder = createCollection(umi, {
        name,
        uri,
        collection: collectionAddress,
        updateAuthority: collectionUpdateAuthority, // payer will be the update authority
      });

      // Build & serialize the transaction
      const blockhash = await umi.rpc.getLatestBlockhash();
      const transaction = txnBuilder
        .setBlockhash(blockhash.blockhash)
        .build(umi);
      const web3JsTransaction = toWeb3JsLegacyTransaction(transaction);
      web3JsTransaction.partialSign(
        Keypair.fromSecretKey(collectionAddress.secretKey),
      );

      const serializedTransaction = web3JsTransaction
        .serialize({ requireAllSignatures: false })
        .toString('base64');

      // Create the BLINK JSON
      const blinkJson = {
        icon: 'https://pbs.twimg.com/profile_images/1472933274209107976/6u-LQfjG_400x400.jpg',
        label: `Create NFT Collection`,
        title: `Create Collection: ${name}`,
        description: `Create a new collection NFT named ${name} with URI ${uri}`,
        transaction: serializedTransaction,
      };

      console.log({
        blockhash,
        collectionAddress: collectionAddress.publicKey,
        blinkJson,
      });

      return getBlinkDirective(blinkJson);
    } catch (error) {
      throw new Error(`Failed to create collection NFT: ${error.message}`);
    }
  },
});
