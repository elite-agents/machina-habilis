import oldowan from './oldowan-server';

try {
  const oldowanServer = await oldowan.getProxy();
  Bun.serve({
    ...oldowanServer,
    idleTimeout: 255,
  });
} catch (e) {
  console.error(e);
}
