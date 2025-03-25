import proxyServer from './memory-server';

const port = process.env.PORT || 3002;

Bun.serve({
  ...proxyServer,
  port,
  idleTimeout: 255,
});
