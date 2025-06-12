import { z } from 'zod';

export const schemes = [
  'exact',
  'token-gated',
  'subscription',
  'credit',
] as const;

const isInteger = (value: string) =>
  Number.isInteger(Number(value)) && Number(value) >= 0;

const AddressRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export const NetworkSchema = z.enum([
  'base-sepolia',
  'base',
  'avalanche-fuji',
  'avalanche',
  'iotex',
  'solana',
]);

// Base schema with common fields
const PaymentRequirementsBaseSchema = z.object({
  network: NetworkSchema,
  maxAmountRequired: z.string().refine(isInteger),
  resource: z.string().url(),
  description: z.string(),
  mimeType: z.string(),
  outputSchema: z.record(z.any()).optional(),
  payTo: z.string().regex(AddressRegex),
  maxTimeoutSeconds: z.number().int(),
  asset: z.string().regex(AddressRegex),
});

// Schema for 'exact' payment
const ExactPaymentRequirementsSchema = PaymentRequirementsBaseSchema.extend({
  scheme: z.literal('exact'),
  extra: z.record(z.any()).optional(),
});

// Schema for 'token-gated' payment
const TokenGatedPaymentRequirementsSchema =
  PaymentRequirementsBaseSchema.extend({
    scheme: z.literal('token-gated'),
    network: z.literal('solana'),
    extra: z.object({
      tokenAddress: z.string(),
      amountUi: z.number(),
    }),
  });

// Schema for 'subscription' payment
const SubscriptionPaymentRequirementsSchema =
  PaymentRequirementsBaseSchema.extend({
    scheme: z.literal('subscription'),
    extra: z.object({
      planId: z.string(),
    }),
  });

// Schema for 'credit' payment
const CreditPaymentRequirementsSchema = PaymentRequirementsBaseSchema.extend({
  scheme: z.literal('credit'),
  extra: z.object({
    amount: z.number(),
    creditId: z.string(),
  }),
});

// x402PaymentRequirements discriminated union
export const PaymentRequirementsSchema = z.discriminatedUnion('scheme', [
  ExactPaymentRequirementsSchema,
  TokenGatedPaymentRequirementsSchema,
  SubscriptionPaymentRequirementsSchema,
  CreditPaymentRequirementsSchema,
]);

export type PaymentRequirements = z.infer<typeof PaymentRequirementsSchema>;
