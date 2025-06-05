import type { BuildConfig } from 'bun';

export async function build(config: BuildConfig) {
  const startTime = Date.now();

  const buildResult = await Bun.build(config);

  if (buildResult.success) {
    console.log(`Build completed in ${Date.now() - startTime}ms`);
    buildResult.outputs.forEach(async (output) => {
      const { size } = await Bun.file(output.path).stat();
      console.log(
        `Wrote ${output.path.replace(process.cwd() + '/', '')} (${(size / 1024).toFixed(2)} kb)`,
      );
    });
  } else {
    console.error(`Build failed in ${Date.now() - startTime}ms`);
  }
}
