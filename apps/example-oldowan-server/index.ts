import oldowanServer from './oldowan-server';

try {
  Bun.serve({
    ...oldowanServer,
    idleTimeout: 255,
  });
  console.log(`Oldowan Server started on port ${oldowanServer.port}`);
} catch (e) {
  console.error(e);
}
