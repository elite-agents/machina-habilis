import dts from 'bun-plugin-dts';
import { build } from '../../build-script';

await build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  plugins: [dts()],
});
