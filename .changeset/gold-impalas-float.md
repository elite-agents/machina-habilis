---
'@elite-agents/machina-habilis': minor
'@elite-agents/oldowan': minor
---

Updated deriveToolName to use a sha-256 hash for the server name suffix. Max length for tool name on the LLM side is 64 chars. This also truncates the tool name to 64 chars if it's over.
