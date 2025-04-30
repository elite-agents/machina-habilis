# @elite-agents/machina-habilis

## 0.4.0

### Minor Changes

- 19fb41a: Updated deriveToolName to use a sha-256 hash for the server name suffix. Max length for tool name on the LLM side is 64 chars. This also truncates the tool name to 64 chars if it's over.
