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
  const orderedArgs = Object.keys(args)
    .sort()
    .reduce(
      (acc, key) => {
        acc[key] = args[key];
        return acc;
      },
      {} as Record<string, unknown>,
    );

  return Buffer.from(JSON.stringify(orderedArgs), 'utf-8');
};
