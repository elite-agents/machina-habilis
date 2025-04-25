import type { PaymentDetails } from './types';

/**
 * Derives a unique name for a tool based on the server name and tool name.
 *
 * @param serverName - The name of the server
 * @param toolName - The name of the tool
 * @returns The unique name for the tool
 */
export const deriveToolUniqueName = (serverName: string, toolName: string) => {
  // Normalize server name by replacing any non-alphanumeric/hyphen characters with hyphens
  // This ensures the server name can be safely used as part of tool identifiers
  const normalizedServerName = `${serverName.replace(/[^a-zA-Z0-9-]+/g, '-')}`;
  const toolUniqueName = `${normalizedServerName}_${normalizeToolName(toolName)}`;

  return toolUniqueName;
};

export const normalizeToolName = (toolName: string) => {
  // Normalize tool name by replacing any non-alphanumeric/underscore characters with underscores
  return `${toolName.replace(/[^a-zA-Z0-9_]+/g, '_')}`;
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
 * If an explicit description exists, it's returned.
 * Otherwise, a description is generated based on the payment type and its details.
 *
 * @param details - The PaymentDetails object.
 * @returns A string describing the payment requirement.
 */
export function generatePaymentDescription(details: PaymentDetails): string {
  // Return existing description if provided
  if (details.description) {
    return details.description;
  }

  // Generate description based on type if none exists
  switch (details.type) {
    case 'token-gated':
      // Note: Assumes 'amount' doesn't need special formatting (e.g., for decimals, which the type comment says aren't present)
      return `Requires holding ${details.amountUi} of the token with mint address ${details.mint}.`;
    case 'subscription':
      return `Requires an active subscription to the '${details.planId}' plan.`;
    case 'credit':
      return `Costs ${details.amount} credits of type '${details.creditId}'.`;
    default:
      // This ensures that if new types are added to PaymentDetails,
      // the compiler will warn us if they aren't handled here.
      const exhaustiveCheck: never = details;
      console.warn(
        `Unhandled payment type in generatePaymentDescription: ${JSON.stringify(exhaustiveCheck)}`,
      );
      return 'Unknown payment requirement.';
  }
}
