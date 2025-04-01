import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

interface CreateOptions {
  template: string;
}

const TEMPLATES = {
  'package.json': (name: string) => `{
  "name": "${name}",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "wrangler dev",
    "start": "wrangler dev",
    "deploy": "wrangler deploy",
    "inspect-mcp-server": "SERVER_PORT=9000 npx @modelcontextprotocol/inspector"
  },
  "dependencies": {
    "@elite-agents/oldowan": "latest",
    "wrangler": "^4.6.0",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20250327.0",
    "typescript": "^5.0.0"
  }
}`,

  'tsconfig.json': () => `{
	"compilerOptions": {
		"allowJs": true,
		"allowSyntheticDefaultImports": true,
		"baseUrl": "src",
		"declaration": true,
		"sourceMap": true,
		"esModuleInterop": true,
		"inlineSourceMap": false,
		"lib": ["esnext"],
		"listEmittedFiles": false,
		"listFiles": false,
		"moduleResolution": "node",
		"noFallthroughCasesInSwitch": true,
		"pretty": true,
		"resolveJsonModule": true,
		"rootDir": ".",
		"skipLibCheck": true,
		"strict": false,
		"traceResolution": false,
		"outDir": "",
		"target": "esnext",
		"module": "esnext",
		"types": [
			"@types/node",
			"@cloudflare/workers-types/2023-07-01"
		]
	},
	"exclude": ["node_modules", "dist", "tests"],
	"include": ["src", "scripts"]
}
`,

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
  port: 3000,
});

export default server.honoServer;`,

'wrangler.jsonc': (name: string) => `
/**
 * For more details on how to configure Wrangler, refer to:
 * https://developers.cloudflare.com/workers/wrangler/configuration/
 */
{
  "name": "${name}",
  "main": "src/server.ts",
  "compatibility_date": "2025-03-27",
  "compatibility_flags": ["nodejs_compat"],
  "observability": {
    "enabled": true
  }
  /**
	 * Smart Placement
	 * Docs: https://developers.cloudflare.com/workers/configuration/smart-placement/#smart-placement
	 */
	// "placement": { "mode": "smart" },

	/**
	 * Bindings
	 * Bindings allow your Worker to interact with resources on the Cloudflare Developer Platform, including
	 * databases, object storage, AI inference, real-time communication and more.
	 * https://developers.cloudflare.com/workers/runtime-apis/bindings/
	 */

	/**
	 * Environment Variables
	 * https://developers.cloudflare.com/workers/wrangler/configuration/#environment-variables
	 */
	// "vars": { "MY_VARIABLE": "production_value" },
	/**
	 * Note: Use secrets to store sensitive data.
	 * https://developers.cloudflare.com/workers/configuration/secrets/
	 */

	/**
	 * Static Assets
	 * https://developers.cloudflare.com/workers/static-assets/binding/
	 */
	// "assets": { "directory": "./public/", "binding": "ASSETS" },

	/**
	 * Service Bindings (communicate between multiple Workers)
	 * https://developers.cloudflare.com/workers/wrangler/configuration/#service-bindings
	 */
	// "services": [{ "binding": "MY_SERVICE", "service": "my-service" }]
}`,

  '.gitignore': () => `node_modules/
dist/
.env
.DS_Store
.wrangler`,

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
  npm install
  npm run dev

To deploy to Cloudflare Workers (requires Cloudflare account https://www.cloudflare.com/plans/developer-platform/):
  npm run deploy
    `);
  } catch (error) {
    console.error('Error creating project:', error);
    process.exit(1);
  }
} 