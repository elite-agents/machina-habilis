import proxyServer from './memory-server';

Bun.serve({
  ...proxyServer,
  idleTimeout: 255,
});
