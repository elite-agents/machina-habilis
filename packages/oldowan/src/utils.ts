import type { PaymentDetails } from './types';

/**
 * Derives a unique name for a tool based on the server name and tool name.
 * This is the name passed to the LLM during prompts.
 *
 * The name is truncated to 64 characters to ensure compatibility with LLM prompt length limits.
 *
 * @param serverName - The name of the server
 * @param toolName - The name of the tool
 * @returns The unique name for the tool
 */
export const deriveToolUniqueName = async (
  serverName: string,
  toolName: string,
) => {
  // Hash the server name and use the first 4 bytes as the prefix
  // This ensures the server name can be safely used as part of tool identifiers
  const serverHashArrayBuffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(serverName),
  );
  const serverHashArray = Array.from(
    new Uint8Array(serverHashArrayBuffer.slice(0, 4)),
  );
  const serverHash = serverHashArray
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // make the hash a suffix so the tool name is clear
  const toolUniqueName = `${normalizeToolName(toolName)}_${serverHash}`;

  // Ensure the name doesn't exceed 64 characters
  // Truncate if necessary
  return toolUniqueName.length > 64
    ? toolUniqueName.substring(63, toolUniqueName.length)
    : toolUniqueName;
};

/**
 * Normalizes a tool name by replacing any non-alphanumeric/underscore/hyphen characters with underscores.
 *
 * @param toolName - The name of the tool
 * @returns The normalized tool name
 */
export const normalizeToolName = (toolName: string) => {
  return `${toolName.replace(/[^a-zA-Z0-9_-]+/g, '_')}`;
};

/**
 * Generates a deterministic payload for signing tool arguments.
 *
 * @param argsWithoutNonce - The arguments without the nonce
 * @param nonce - The nonce to be added to the arguments
 * @returns The deterministic payload
 */
export const generateDeterministicPayloadForSigning = (
  argsWithoutNonce: Record<string, unknown>,
  nonce: number,
) => {
  // first add the nonce to the args
  const args = Object.assign({}, argsWithoutNonce, { nonce });

  // then order the args so the signature is deterministic
  // ignore nullish values
  const orderedArgs = Object.keys(args)
    .sort()
    .reduce(
      (acc, key) => {
        if (args[key] != null) {
          acc[key] = args[key];
        }
        return acc;
      },
      {} as Record<string, unknown>,
    );

  return Buffer.from(JSON.stringify(orderedArgs), 'utf-8');
};

/**
 * Generates a human-readable description for PaymentDetails.
 * A description is generated based on the payment type and its details.
 * If an additional description is provided, it is appended to the generated description.
 *
 * @param details - The PaymentDetails object.
 * @returns A string describing the payment requirement.
 */
export function generatePaymentDescription(details: PaymentDetails): string {
  // Generate description based on type
  let baseDescription = '';

  switch (details.type) {
    case 'token-gated':
      baseDescription = `Requires holding <Amount>${details.amountUi}</Amount> of the token with mint address <Mint>${details.tokenAddress}</Mint>.`;
      break;
    case 'subscription':
      baseDescription = `Requires an active subscription to the <PlanId>${details.planId}</PlanId> plan.`;
      break;
    case 'credit':
      baseDescription = `Costs <Amount>${details.amount}</Amount> credits of type <CreditId>${details.creditId}</CreditId>.`;
      break;
  }

  if (details.description) {
    return `<PaymentDetails>${baseDescription}\n\n<Additional Description>${details.description}</Additional Description></PaymentDetails>`;
  } else {
    return `<PaymentDetails>${baseDescription}</PaymentDetails>`;
  }
}

// Helper function to extract value from a simple tag
function extractValue(text: string, tagName: string): string | null {
  const startTag = `<${tagName}>`;
  const endTag = `</${tagName}>`;
  const startIndex = text.indexOf(startTag);
  const endIndex = text.indexOf(endTag);

  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    return text.substring(startIndex + startTag.length, endIndex).trim();
  }
  return null;
}

/**
 * Extracts payment details from a description with PaymentDetails tags.
 *
 * @param description - The description string to extract payment details from.
 * @returns The extracted payment details, or undefined if no payment details are found.
 */
export function extractPaymentDetailsFromDescription(
  description: string,
): PaymentDetails | undefined {
  const fullDescTrimmed = description.trim();

  // 1. Extract content within <PaymentDetails>
  const paymentDetailsContent = extractValue(fullDescTrimmed, 'PaymentDetails');
  if (!paymentDetailsContent) {
    return undefined; // No PaymentDetails wrapper found
  }

  // 2. Extract optional description from <Additional Description> tag within the content
  const optionalDesc =
    extractValue(paymentDetailsContent, 'Additional Description') || undefined;

  // 3. Parse core details from the paymentDetailsContent
  let paymentDetails: PaymentDetails | undefined = undefined;

  // --- Try Token-gated ---
  const amountUiStr_tg = extractValue(paymentDetailsContent, 'Amount');
  const mint_tg = extractValue(paymentDetailsContent, 'Mint');
  if (amountUiStr_tg && mint_tg) {
    if (
      paymentDetailsContent.includes('Requires holding') &&
      paymentDetailsContent.includes('token with mint address')
    ) {
      const amountUi = parseFloat(amountUiStr_tg);
      if (!isNaN(amountUi)) {
        paymentDetails = {
          type: 'token-gated',
          chain: 'solana',
          amountUi,
          tokenAddress: mint_tg,
          description: optionalDesc,
        };
      }
    }
  }

  // --- Try Subscription ---
  if (!paymentDetails) {
    const planId_sub = extractValue(paymentDetailsContent, 'PlanId');
    if (planId_sub) {
      if (paymentDetailsContent.includes('Requires an active subscription')) {
        paymentDetails = {
          type: 'subscription',
          planId: planId_sub,
          description: optionalDesc,
        };
      }
    }
  }

  // --- Try Credit ---
  if (!paymentDetails) {
    const amountStr_cr = extractValue(paymentDetailsContent, 'Amount');
    const creditId_cr = extractValue(paymentDetailsContent, 'CreditId');
    if (amountStr_cr && creditId_cr) {
      if (
        paymentDetailsContent.includes('Costs') &&
        paymentDetailsContent.includes('credits of type')
      ) {
        const amount = parseInt(amountStr_cr, 10);
        if (!isNaN(amount)) {
          paymentDetails = {
            type: 'credit',
            amount,
            creditId: creditId_cr,
            description: optionalDesc,
          };
        }
      }
    }
  }

  return paymentDetails;
}
