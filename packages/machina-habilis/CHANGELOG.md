# @elite-agents/machina-habilis

## 0.5.0

### Minor Changes

- 34b32f8: update system prompt to include blink instructions and also provide a way to pass in additional system prompt

## 0.4.0

### Minor Changes

- 19fb41a: Updated deriveToolName to use a sha-256 hash for the server name suffix. Max length for tool name on the LLM side is 64 chars. This also truncates the tool name to 64 chars if it's over.
