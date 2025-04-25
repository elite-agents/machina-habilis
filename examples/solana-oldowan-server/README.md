# Solana Oldowan Server Example

This example demonstrates how to run an Oldowan-compatible tool server for Solana on Cloudflare Workers (via Wrangler) with Bun as the build tool.

## Features
- Cloudflare Worker server using Wrangler
- Solana RPC integration (via `RPC_URL`)
- Example of secure tool invocation using reserved `auth` field
- Environment variable and local development support

## Getting Started

### Prerequisites
- [Bun](https://bun.sh/) installed
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) installed
- Node.js v18+ (for some dependencies)

### Setup

1. **Install dependencies:**
   ```sh
   bun install
   ```

2. **Configure environment variables:**
   - Copy `.dev.vars.example` to `.dev.vars` and update `RPC_URL` with your Solana RPC endpoint.
   - Example:
     ```sh
     cp .dev.vars.example .dev.vars
     # Edit .dev.vars to set your RPC_URL
     ```

3. **Local Development:**
   ```sh
   bun dev
   ```
   This will start the worker locally with Miniflare and hot reloading.

4. **Production Build:**
   ```sh
   bun run build
   wrangler publish
   ```

## Environment Variables
- `RPC_URL`: Solana RPC endpoint (required)
- `BLINK_BASE_URL`: (optional) Used for integration with Blink UI

## File Structure
- `index.ts` - Main entry for the Worker
- `wrangler.toml` - Wrangler configuration
- `.dev.vars.example` - Example env vars file
- `.dev.vars` - Local env vars (not committed)

## Notes
- The `auth` field in tool schemas is reserved for system use and enforced at both runtime and compile time.
- See the main repo for more details on the Oldowan protocol and tool registration.

---

For more information, see the [Wrangler Docs](https://developers.cloudflare.com/workers/wrangler/) and [Bun Docs](https://bun.sh/).
