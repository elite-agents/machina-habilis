import dts from 'bun-plugin-dts';
import { build } from '../../build-script';

await build({
  entrypoints: ['./src/cli.ts'],
  outdir: './dist',
  target: 'node',
  plugins: [dts()],
});
