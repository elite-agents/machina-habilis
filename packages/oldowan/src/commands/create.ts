import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

interface CreateOptions {
  template: string;
}

const TEMPLATES = {
  'package.json': (name: string) => `{
  "name": "${name}",
  "version": "0.0.1",
  "module": "src/index.ts",
  "type": "module",
  "scripts": {
    "dev": "bun run src/server.ts",
    "build": "bun build ./src/server.ts --outdir ./dist",
    "start": "bun run dist/server.js",
    "docker:build": "docker build -t ${name} .",
    "docker:run": "docker run -p 3000:3000 ${name}",
    "docker:dev": "docker-compose up",
    "inspect-mcp-server": "SERVER_PORT=9000 npx @modelcontextprotocol/inspector"
  },
  "dependencies": {
    "@elite-agents/oldowan": "latest",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "bun-types": "latest",
    "typescript": "^5.0.0"
  }
}`,

  'tsconfig.json': () => `{
  "compilerOptions": {
    "lib": ["ESNext"],
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "types": ["bun-types"],
    "strict": true,
    "skipLibCheck": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "outDir": "dist"
  }
}`,

  'src/tools/example.ts': () => `import { OldowanTool } from '@elite-agents/oldowan';
import { z } from 'zod';

export const exampleTool = new OldowanTool({
  name: 'example',
  description: 'An example tool that echoes input',
  schema: {
    message: z.string().describe('Message to echo'),
  },
  async execute({ message }) {
    return { message };
  },
});`,

  'src/server.ts': () => `import { OldowanServer } from '@elite-agents/oldowan';
import { exampleTool } from './tools/example';

const server = new OldowanServer('Example Service', '1.0.0', {
  tools: [exampleTool],
  proxyPort: 3000,
});

console.log('Starting server...');
Bun.serve(await server.getProxy());`,

  '.gitignore': () => `node_modules/
dist/
.env
.DS_Store`,

  'Dockerfile': () => `FROM oven/bun:1 as builder
WORKDIR /app
COPY package.json .
COPY bun.lockb .
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM oven/bun:1-slim
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json .
COPY --from=builder /app/bun.lockb .
RUN bun install --frozen-lockfile --production
ENV NODE_ENV=production
EXPOSE 3000
CMD ["bun", "run", "start"]`,

  'docker-compose.yml': () => `version: '3.8'
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
    volumes:
      - .:/app
      - /app/node_modules
    command: ["bun", "run", "dev"]
`
};

export async function createProject(projectName: string, options: CreateOptions) {
  const projectDir = join(process.cwd(), projectName);

  try {
    // Create project directory
    await mkdir(projectDir);
    await mkdir(join(projectDir, 'src'));
    await mkdir(join(projectDir, 'src/tools'));

    // Create files from templates
    for (const [file, template] of Object.entries(TEMPLATES)) {
      const content = template(projectName);
      await writeFile(join(projectDir, file), content);
    }

    console.log(`
✨ Project created successfully!

To get started:
  cd ${projectName}
  bun install
  bun run dev

Your server will be running at http://localhost:3000
    `);
  } catch (error) {
    console.error('Error creating project:', error);
    process.exit(1);
  }
} 