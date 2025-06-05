import dts from 'bun-plugin-dts';
import { build } from '../../build-script';

await build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  external: ['@solana/kit', 'openai', 'hono', 'zod'],
  plugins: [dts()],
});
