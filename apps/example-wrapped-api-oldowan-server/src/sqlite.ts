import type {
  IEndpointDefinition,
  IRestApiWrappedOldowanToolRepository,
  IRestApiWrappedOldowanTool,
} from '@elite-agents/oldowan';
import { Database } from 'bun:sqlite';

class SqliteDb implements IRestApiWrappedOldowanToolRepository {
  private db: Database;

  constructor() {
    this.db = new Database('sqlite.db', { create: true });
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tools (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL
      )
    `);
  }

  async create(
    entity: IRestApiWrappedOldowanTool,
  ): Promise<IRestApiWrappedOldowanTool> {
    const stmt = this.db.prepare('INSERT INTO tools (id, data) VALUES (?, ?)');
    stmt.run(entity.id, JSON.stringify(entity));
    return entity;
  }

  async upsert(
    entity: IRestApiWrappedOldowanTool,
  ): Promise<IRestApiWrappedOldowanTool> {
    const stmt = this.db.prepare(
      'INSERT INTO tools (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = ?',
    );
    stmt.run(entity.id, JSON.stringify(entity), JSON.stringify(entity));
    return entity;
  }

  async find(): Promise<IRestApiWrappedOldowanTool[]> {
    const stmt = this.db.prepare('SELECT id, data FROM tools');
    const rows = stmt.all() as { id: string; data: string }[];
    return rows.map((row) =>
      Object.assign(JSON.parse(row.data), { name: row.id }),
    );
  }

  async findOne(id: string): Promise<IRestApiWrappedOldowanTool | null> {
    const stmt = this.db.prepare('SELECT data FROM tools WHERE id = ?');
    const row = stmt.get(id) as { data: string } | undefined;
    return row ? JSON.parse(row.data) : null;
  }

  async update(
    id: string,
    entity: IRestApiWrappedOldowanTool,
  ): Promise<IRestApiWrappedOldowanTool> {
    const stmt = this.db.prepare('UPDATE tools SET data = ? WHERE id = ?');
    const result = stmt.run(JSON.stringify(entity), id);
    if (result.changes === 0) {
      throw new Error(`Tool with id ${id} not found`);
    }
    return entity;
  }

  async remove(id: string): Promise<IRestApiWrappedOldowanTool> {
    const tool = await this.findOne(id);
    if (!tool) {
      throw new Error(`Tool with id ${id} not found`);
    }
    const stmt = this.db.prepare('DELETE FROM tools WHERE id = ?');
    stmt.run(id);
    return tool;
  }
}

export const sqliteDb = new SqliteDb();
