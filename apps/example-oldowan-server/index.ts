import oldowanServer from './oldowan-server';

try {
  Bun.serve({
    ...oldowanServer,
    idleTimeout: 255,
  });
} catch (e) {
  console.error(e);
}
