FROM oven/bun:latest

WORKDIR /app
COPY ./ .

# Install dependencies at root level first
RUN bun install

RUN bun run build


# Setup for running
WORKDIR /app/apps/memory-server

EXPOSE 3002

CMD ["bun", "run", "start"]
