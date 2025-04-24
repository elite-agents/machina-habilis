// src/tools/solana-transfer.ts
import { OldowanTool } from '@elite-agents/oldowan';
import { z } from 'zod';
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  TransactionInstruction,
} from '@solana/web3.js';
import { RPC_URL, getBlinkDirective } from '../utils/utils';

export const solanaTransferTool = new OldowanTool({
  name: 'transfer_sol',
  description: `Create an unsigned SOL transfer instruction as a Solana BLINK.
  
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
    fromAddress: z.string().describe('Source wallet address'),
    toAddress: z.string().describe('Destination wallet address'),
    amount: z.number().describe('Amount in SOL to transfer'),
    message: z.string().optional().describe('Optional memo to include'),
  },
  async execute({ fromAddress, toAddress, amount, message }) {
    try {
      // Validate addresses
      const fromPubkey = new PublicKey(fromAddress);
      const toPubkey = new PublicKey(toAddress);

      // Create connection
      const connection = new Connection(RPC_URL);

      // Create transfer transaction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey,
          toPubkey,
          lamports: amount * LAMPORTS_PER_SOL,
        }),
      );

      // Add memo if provided
      if (message) {
        transaction.add(
          new TransactionInstruction({
            keys: [],
            programId: new PublicKey(
              'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr',
            ),
            data: Buffer.from(message),
          }),
        );
      }

      // Get latest blockhash
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromPubkey;

      const blinkJson = {
        icon: 'https://pbs.twimg.com/profile_images/1472933274209107976/6u-LQfjG_400x400.jpg',
        label: `Transfer SOL`,
        title: `Transfer ${amount} SOL`,
        description: `Transfer ${amount} SOL from ${fromAddress} to ${toAddress}`,
        transaction: transaction
          .serialize({ requireAllSignatures: false })
          .toString('base64'),
      };

      return getBlinkDirective(blinkJson);
    } catch (error) {
      throw new Error(
        `Failed to create transfer transaction: ${error.message}`,
      );
    }
  },
});
