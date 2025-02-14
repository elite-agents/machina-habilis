FROM oven/bun:latest

WORKDIR /app
COPY ./ .

# Install dependencies at root level first
RUN bun install

RUN bun run build


# Setup for running
WORKDIR /app/apps/example-oldowan-server

ENV IS_DOCKER=true

EXPOSE 3003

CMD ["bun", "run", "start"]
