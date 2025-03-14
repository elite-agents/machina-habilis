FROM oven/bun:1.2.5-alpine

WORKDIR /app
COPY ./ .

# Install dependencies at root level first
RUN bun install
# Build packages in dependency order
RUN bun run --filter @elite-agents/oldowan build
RUN bun run --filter @elite-agents/machina-habilis build
RUN bun run --filter @elite-agents/mnemon build

# Setup for running
WORKDIR /app/apps/example-memory-server

ENV IS_DOCKER=true

EXPOSE 3002

CMD ["bun", "run", "start"]
