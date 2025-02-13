import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

interface AddToolOptions {
  description?: string;
}

export async function addTool(name: string = 'example', options: AddToolOptions) {
  const toolName = name.toLowerCase().replace(/\s+/g, '-');
  const fileName = `${toolName}.ts`;
  const description = options.description || `A ${toolName} tool`;

  const toolContent = `import { OldowanTool } from '@elite-agents/oldowan';
import { z } from 'zod';

export const oldowanTool = new OldowanTool({
  name: '${toolName}',
  description: '${description}',
  schema: {
    input: z.string().describe('Input to process'),
  },
  async execute({ input }) {
    // TODO: Implement your tool logic here
    return { result: input };
  },
});
`;

  try {
    const toolsDir = join(process.cwd(), 'src', 'tools');
    await writeFile(join(toolsDir, fileName), toolContent);

    console.log(`
✨ Tool created successfully!

Created: src/tools/${fileName}

Don't forget to:
1. Update the schema to match your tool's requirements
2. Implement your tool logic in the execute function
3. Import and add your tool to the server in src/server.ts:

import { oldowanTool } from './tools/${toolName}';

const server = new OldowanServer('Your Service', '1.0.0', {
  tools: [...existingTools, oldowanTool],
  proxyPort: 3000,
});
    `);
  } catch (error) {
    console.error('Error creating tool:', error);
    process.exit(1);
  }
} 