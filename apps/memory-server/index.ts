import mnemon from './memory-server';

const proxyServer = await mnemon.getProxy();

Bun.serve({
  ...proxyServer,
  idleTimeout: 255,
  fetch(req, server) {
    // Add CORS headers to all responses
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }
    
    // Add CORS headers to regular responses
    const response = proxyServer.fetch(req, server);
    return new Response(response.body, {
      ...response,
      headers: {
        ...response.headers,
        'Access-Control-Allow-Origin': '*',
      },
    });
  },
});
