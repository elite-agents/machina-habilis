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
