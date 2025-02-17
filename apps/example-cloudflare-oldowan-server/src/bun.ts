import oldowanServer from './oldowan-server';

// to be run inside of docker for dev purposes
Bun.serve(oldowanServer.sseServer);

console.log(`Server running on port ${oldowanServer.sseServer.port}`);
