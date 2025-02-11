import * as z from 'zod';

export interface PersonaTypeSense {
  id: string;
  name: string;
  description: string;
  owner: string;
  imageUrl: string;
  usageCount: number;
  version: string;
}

export type Ability = {
  name: string;
  abilityServer: string;
};

export const createPersonaSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().min(1, 'Description is required'),
  adjectives: z.array(z.string()).min(1, 'At least one adjective is required'),
  topics: z.array(z.string()).min(1, 'At least one topic is required'),
  bio: z.array(z.string()).min(1, 'Bio is required'),
  lore: z.array(z.string()).optional(),
  knowledge: z.array(z.string()).optional(),
  style: z.object({
    all: z.array(z.string()),
    chat: z.array(z.string()),
    post: z.array(z.string()),
  }),
  postExamples: z.array(z.string()),
  messageExamples: z.array(
    z.object({
      messages: z.array(
        z.object({
          content: z.object({
            text: z.string(),
          }),
          user: z.string(),
        })
      ),
    })
  ),
  abilities: z.array(
    z.object({
      name: z.string(),
      abilityServer: z.string(),
    })
  ),
});

export const personaSchema = z.object({
  ...createPersonaSchema.shape,
  id: z.string(),
  imageUrl: z.string(),
  owner: z.string(),
  createdAt: z.string(),
  version: z.string(),
  usageCount: z.number(),
  abilities: z.array(
    z.object({
      name: z.string(),
      abilityServer: z.string(),
    })
  ),
});

export type Persona = z.infer<typeof personaSchema>;

export type SimplePersona = { name: string; bio: string[] };
