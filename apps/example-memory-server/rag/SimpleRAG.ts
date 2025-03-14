import {
  EXTRACT_ENTITY_AND_RELATIONSHIP_PROMPT,
  EXTRACT_ENTITY_ONLY_PROMPT,
  ZENTITY_EXTRACTED_TYPE,
  ZExtractedEntity,
  type AIConfig,
  type FalkorConfig,
  type GraphNode,
  type GraphRelation,
} from './types';
import { FalkorDB } from 'falkordb';
import { generateObject, generateText } from 'ai';
import { z } from 'zod';
import { createOpenAI, type OpenAIProvider } from '@ai-sdk/openai';
import { nanoid } from 'nanoid';

export class SimpleRAG {
  private dbConfig: FalkorConfig;
  private aiConfig: AIConfig;
  private falkor: FalkorDB | undefined;
  private openai: OpenAIProvider | undefined;

  constructor(aiConfig: AIConfig, dbConfig: FalkorConfig) {
    this.dbConfig = dbConfig;
    this.aiConfig = aiConfig;
    this.openai = createOpenAI({
      baseURL: aiConfig.baseUrl ?? 'https://api.openai.com/v1',
      apiKey: aiConfig.apiKey ?? process.env.OPENAI_API_KEY,
    });
  }

  async init(): Promise<void> {
    try {
      this.falkor = await FalkorDB.connect({
        username: this.dbConfig.username || 'default',
        password: this.dbConfig.password,
        socket: {
          host: this.dbConfig.socket.host || 'localhost',
          port: this.dbConfig.socket.port || 6379,
        },
      });

      const graph = this.falkor.selectGraph(
        this.dbConfig.graph || 'simple_rag',
      );
      // Create constraints for unique IDs
      const indexes = (await graph.query(`CALL db.indexes()`)).data;

      if (
        !indexes?.filter(
          (index) => ((index as any).label as string) === 'Entity',
        )
      ) {
        await graph.query(`CREATE INDEX ON :Entity(id)`);
        await graph.query(`CREATE INDEX FOR (n:Entity) ON (n.timestamp)`);
        await graph.query(`CREATE INDEX FOR (n:Entity) ON (n.type)`);
      }

      if (
        !indexes?.filter(
          (index) => ((index as any).label as string) === 'RELATES_TO',
        )
      ) {
        // Create indexes for timestamp and type fields for faster querying
        await graph.query(
          `CREATE INDEX FOR ()-[r:RELATES_TO]->() ON (r.timestamp)`,
        );
        await graph.query(`CREATE INDEX FOR ()-[r:RELATES_TO]->() ON (r.type)`);
      }
    } catch (error) {
      throw error;
    }
  }

  async close(): Promise<void> {
    if (!this.falkor) {
      return;
    }
    await this.falkor.close();
  }

  async insert(
    text: string,
    agentPubkey: string,
    channelId?: string,
  ): Promise<void> {
    try {
      if (!this.falkor) {
        throw new Error('FalkorDB is not initialized');
      }

      // Extract Entities from Text
      const entitiesAndRelationships = (
        await generateObject({
          prompt: `${EXTRACT_ENTITY_AND_RELATIONSHIP_PROMPT}\nInput Text: ${text}`,
          model: this.openai!.languageModel(
            this.aiConfig.entityExtractionModel ?? 'gpt-4o',
          ),
          schema: ZENTITY_EXTRACTED_TYPE,
        })
      ).object;

      console.log('Entities and Relationships: ', entitiesAndRelationships);

      const graph = this.falkor.selectGraph(
        this.dbConfig.graph || 'simple_rag',
      );

      // Process entities and find/merge with existing ones
      const entitiesWithIds = await Promise.all(
        entitiesAndRelationships.entities.map(async (entity) => {
          // Search for existing entities with case-insensitive name match
          const existingEntities =
            (
              await graph.query(
                `
                    MATCH (e:Entity)
                    WHERE toLower(e.name) = toLower($name)
                    AND e.type = $type
                    AND e.agentPubkey = $agentPubkey
                    ${channelId ? 'AND e.channelId = $channelId' : ''}
                    RETURN e
                `,
                {
                  params: {
                    name: entity.name,
                    type: entity.type,
                    agentPubkey: agentPubkey,
                    ...(channelId ? { channelId } : {}),
                  },
                },
              )
            ).data?.map((row: any) => row.e.properties as GraphNode) || [];

          // If no matching entity found, create new one
          if (existingEntities.length === 0) {
            return {
              ...entity,
              id: nanoid(),
              channelId: channelId == undefined ? null : channelId,
              agentPubkey,
              timestamp: Date.now(),
            };
          }

          // Use the first matching entity and merge descriptions
          const existingEntity = existingEntities[0];
          let combinedDescription = `${existingEntity.description}. ${entity.description}`;

          // If combined description is too long, summarize it
          if (combinedDescription.length > 1024) {
            combinedDescription = (
              await generateText({
                prompt: `Summarize the following text into fewer than 512 characters: ${combinedDescription}`,
                model: this.openai!.languageModel(
                  this.aiConfig.entityExtractionModel ?? 'gpt-4o',
                ),
              })
            ).text;
          }

          return {
            id: existingEntity.id,
            name: entity.name,
            type: entity.type,
            description: combinedDescription,
            channelId: channelId == undefined ? null : channelId,
            agentPubkey,
            timestamp: Date.now(),
          };
        }),
      );

      // Process relationships
      const relationshipsWithIds = entitiesAndRelationships.relationships.map(
        (relationship) => {
          const sourceId = entitiesWithIds.find(
            (entity) =>
              entity.name.toLowerCase() === relationship.source.toLowerCase(),
          )!.id;
          const targetId = entitiesWithIds.find(
            (entity) =>
              entity.name.toLowerCase() === relationship.target.toLowerCase(),
          )!.id;
          return {
            id: nanoid(),
            sourceId,
            targetId,
            type: relationship.type,
            description: relationship.description,
            channelId: channelId == undefined ? null : channelId,
            agentPubkey,
            timestamp: Date.now(),
          };
        },
      );

      // Insert entities and relationships in parallel
      await Promise.all([
        // Insert/update entities
        Promise.all(
          entitiesWithIds.map((entity) =>
            graph.query(
              `
                        MERGE (e:Entity {id: $id})
                        SET 
                            e.name = $name,
                            e.type = $type,
                            e.description = $description,
                            e.channelId = $channelId,
                            e.agentPubkey = $agentPubkey,
                            e.timestamp = $timestamp
                    `,
              {
                params: {
                  id: entity.id,
                  name: entity.name,
                  type: entity.type,
                  description: entity.description,
                  channelId: entity.channelId,
                  agentPubkey: entity.agentPubkey,
                  timestamp: entity.timestamp,
                },
              },
            ),
          ),
        ),
        // Insert relationships
        Promise.all(
          relationshipsWithIds.map((relationship) =>
            graph.query(
              `
                        MATCH (source:Entity {id: $sourceId})
                        MATCH (target:Entity {id: $targetId})
                        MERGE (source)-[r:RELATES_TO {id: $id}]->(target)
                        SET 
                            r.type = $type,
                            r.description = $description,
                            r.channelId = $channelId,
                            r.agentPubkey = $agentPubkey,
                            r.timestamp = $timestamp
                    `,
              {
                params: {
                  id: relationship.id,
                  sourceId: relationship.sourceId,
                  targetId: relationship.targetId,
                  type: relationship.type,
                  description: relationship.description,
                  channelId: relationship.channelId,
                  agentPubkey: relationship.agentPubkey,
                  timestamp: relationship.timestamp,
                },
              },
            ),
          ),
        ),
      ]);
    } catch (error) {
      console.log('SimpleRAG ERROR: ', error);
      throw error;
    }
  }

  async query(
    text: string,
    agentPubkey: string,
    channelId?: string,
  ): Promise<string[]> {
    try {
      if (!this.falkor) {
        throw new Error('FalkorDB is not initialized');
      }

      // Extract entities from Text
      const extractedEntities = (
        await generateObject({
          prompt: `${EXTRACT_ENTITY_ONLY_PROMPT}\nInput Text: ${text}`,
          model: this.openai!.languageModel(
            this.aiConfig.entityExtractionModel ?? 'gpt-4o',
          ),
          schema: z.object({
            entities: z.array(ZExtractedEntity),
          }),
        })
      ).object.entities;

      const graph = this.falkor.selectGraph(
        this.dbConfig.graph || 'simple_rag',
      );

      // Find similar entities and their relationships
      // First find entities with similar names (and types)
      const entitiesWithSimilarNames = (
        await Promise.all(
          extractedEntities.map((entity) => {
            return graph.query(
              `
                    MATCH (e:Entity {name: $name, type: $type, agentPubkey: $agentPubkey, channelId: $channelId})
                    RETURN e
                    `,
              {
                params: {
                  name: entity.name,
                  type: entity.type,
                  agentPubkey: agentPubkey,
                  channelId: channelId == undefined ? null : channelId,
                },
              },
            );
          }),
        )
      )
        .map((graphReply) => {
          return (
            graphReply.data?.map(
              (node: any) => node.e.properties as GraphNode,
            ) || []
          );
        })
        .flat();

      console.log('Entities with similar names: ', entitiesWithSimilarNames);
      console.log('Extracted entities: ', extractedEntities);

      const entityContext: string[] = extractedEntities.map((entity, i) => {
        if (entitiesWithSimilarNames[i]) {
          return `Entity ${entitiesWithSimilarNames[i].name} (${entitiesWithSimilarNames[i].type}): ${entitiesWithSimilarNames[i].description}`;
        } else {
          return `Entity ${entity.name} (${entity.type}): ${entity.description}`;
        }
      });
      return entityContext;
    } catch (error) {
      console.log('SimpleRAG ERROR: ', error);
      throw error;
    }
  }
}
