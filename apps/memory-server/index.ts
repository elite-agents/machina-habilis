import mnemon from './memory-server';

const proxyServer = await mnemon.getProxy();

Bun.serve({
  ...proxyServer,
  idleTimeout: 255,
});
