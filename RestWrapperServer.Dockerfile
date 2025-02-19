FROM oven/bun:latest

WORKDIR /app
COPY ./ .

# Install dependencies at root level first
RUN bun install

# Build packages in dependency order
RUN bun run --filter @elite-agents/oldowan build
RUN bun run --filter @elite-agents/machina-habilis build

# Setup for running
WORKDIR /app/apps/example-wrapped-api-oldowan-server

ENV IS_DOCKER=true

EXPOSE 3004

CMD ["bun", "run", "start"]
