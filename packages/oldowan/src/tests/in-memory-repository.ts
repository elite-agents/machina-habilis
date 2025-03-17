import type { IRepository } from '../types';

/**
 * A simple in-memory repository implementation for testing
 */
export class InMemoryRepository<T extends { id: string }> implements IRepository<T> {
  private entities: Map<string, T> = new Map();

  async create(entity: T): Promise<T> {
    this.entities.set(entity.id, entity);
    return entity;
  }

  async find(): Promise<T[]> {
    return Array.from(this.entities.values());
  }

  async findOne(id: string): Promise<T | null> {
    return this.entities.get(id) || null;
  }

  async update(id: string, entity: T): Promise<T> {
    const existingEntity = this.entities.get(id);
    
    // If entity doesn't exist, just add it
    if (!existingEntity) {
      this.entities.set(id, entity);
      return entity;
    }

    // Merge the existing entity with the updates
    const updatedEntity = { ...existingEntity, ...entity };
    this.entities.set(id, updatedEntity as T);
    return updatedEntity as T;
  }

  async remove(id: string): Promise<T> {
    const entity = this.entities.get(id);
    if (!entity) {
      throw new Error(`Entity with id ${id} not found`);
    }
    
    this.entities.delete(id);
    return entity;
  }
}
