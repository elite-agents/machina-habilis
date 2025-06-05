import dts from 'bun-plugin-dts';
import { build } from '../../build-script';

await build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  external: [
    '@modelcontextprotocol/sdk',
    '@readme/openapi-schemas',
    '@solana/kit',
    'commander',
    'hono',
    'jsonschema',
    'zod',
  ],
  plugins: [dts()],
});
