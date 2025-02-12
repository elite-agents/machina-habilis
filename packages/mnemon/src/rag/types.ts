import { z } from "zod";

export interface FalkorConfig {
    username?: string;  
    password?: string;
    socket: {
        host: string;
        port: number;
    }
    graph?: string;
}

export interface AIConfig {
    apiKey?: string;
    baseUrl?: string;
    entityExtractionModel?: string;
    vectorDimensions?: number;
    embeddingModel?: string;
}

export interface PostgresConfig {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
}

export interface GraphNode {
    id: string;
    name: string;
    type: z.infer<typeof ZDEFAULT_ENTITY_TYPES>;
    description: string;
    embedding: number[];
    channelId: string | null;
    daemonPubkey: string;
    timestamp: number;
}

export interface GraphRelation {
    sourceId: string;
    targetId: string;
    type: string;
    channelId?: string;
    daemonPubkey: string;
    timestamp: number;
}

export const ZDEFAULT_ENTITY_TYPES = z.enum([
    'Concept',
    'Actor',
    'Resource',
    'Event',
    'Location'
])

export const ZExtractedEntity = z.object({
    name: z.string(),
    description: z.string(),
    type: ZDEFAULT_ENTITY_TYPES,
})

export const ZExtractedRelationship = z.object({
    source: z.string(),
    target: z.string(),
    type: z.string(),
    description: z.string(),
    strength: z.number().optional(),
})

export const ZENTITY_EXTRACTED_TYPE = z.object({
    entities: z.array(ZExtractedEntity),
    relationships: z.array(ZExtractedRelationship),
})

export const EXTRACT_ENTITY_ONLY_PROMPT = `
Extract entities from the input text into JSON. Use these entity types:
- Concept: Ideas, terms, notions
- Actor: People, organizations, systems
- Resource: Documents, items, assets
- Event: Actions, occurrences
- Location: Physical/virtual places

For each entity, extract the following:
- name: The name of the entity. If there are multiple entities of the same type with the same name add a number to the end of each entity to refer to them seperately
- type: The type of the entity
- description: Comprehensive description of the entity's attributes and activities

Required JSON format: 
{
    entities: [
        {
            name: "entity name",
            type: "EntityType",
            description: "entity description"
        }
    ]
}
Process this text:
`

export const EXTRACT_ENTITY_AND_RELATIONSHIP_PROMPT = `
Extract entities and relationships from the input text into JSON. Use these entity types:
- Concept: Ideas, terms, notions
- Actor: People, organizations, systems
- Resource: Documents, items, assets
- Event: Actions, occurrences
- Location: Physical/virtual places

For each entity, extract the following:
- name: The name of the entity. If there are multiple entities of the same type with the same name add a number to the end of each entity to refer to them seperately
- type: The type of the entity
- description: Comprehensive description of the entity's attributes and activities

For each relationship, extract the following:
- source: The name of the source entity
- target: The name of the target entity
- type: The type of the relationship
- description: Explanation as to why you think the source entity and the target entity are related to each other
- relationship_strength: a numeric integer between 0 and 100 indicating strength of the relationship between the source entity and target entity

Required JSON format:
{
  "entities": [
    {
      "name": "entity name",
      "type": "EntityType",
      "description": "entity description"
    }
  ],
  "relationships": [
    {
      "source": "entity_name",
      "target": "entity_name",
      "type": "relationship_type",
      "description": "relationship description",
      "strength": 50,
    }
  ]
}

Process this text:
`