import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { DatabaseAdapter, EntityWithId, StorageMutation, StoreName } from '../../repositories/repository.interfaces';

const TABLES: StoreName[] = [
  'people',
  'occasions',
  'occasion_reminders',
  'notification_schedule',
  'contact_sync_ignores',
  'app_settings',
];

export class SQLiteAdapter implements DatabaseAdapter {
  private readonly connection = new SQLiteConnection(CapacitorSQLite);
  private database?: SQLiteDBConnection;
  private writeQueue: Promise<void> = Promise.resolve();

  async initialize(): Promise<void> {
    if (this.database) return;
    this.database = await this.connection.createConnection('birthday_buddy', false, 'no-encryption', 1, false);
    await this.database.open();
    const statements = TABLES.map(
      table => `CREATE TABLE IF NOT EXISTS ${table} (id TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL);`,
    ).join('\n');
    await this.database.execute(`
      CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL);
      ${statements}
      CREATE INDEX IF NOT EXISTS idx_people_name ON people(json_extract(data, '$.name'));
      CREATE INDEX IF NOT EXISTS idx_people_favorite ON people(json_extract(data, '$.favorite'));
      CREATE INDEX IF NOT EXISTS idx_people_contact ON people(json_extract(data, '$.androidContactLookupKey'));
      CREATE INDEX IF NOT EXISTS idx_occasions_person ON occasions(json_extract(data, '$.personId'));
      CREATE INDEX IF NOT EXISTS idx_occasions_calendar ON occasions(json_extract(data, '$.month'), json_extract(data, '$.day'));
      CREATE INDEX IF NOT EXISTS idx_occasions_type ON occasions(json_extract(data, '$.type'));
      CREATE INDEX IF NOT EXISTS idx_occasions_contact_event ON occasions(json_extract(data, '$.androidEventReference'));
      CREATE INDEX IF NOT EXISTS idx_reminders_occasion ON occasion_reminders(json_extract(data, '$.occasionId'));
      CREATE INDEX IF NOT EXISTS idx_schedule_at ON notification_schedule(json_extract(data, '$.scheduledAt'));
      CREATE INDEX IF NOT EXISTS idx_ignores_contact ON contact_sync_ignores(json_extract(data, '$.androidContactLookupKey'));
      INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (1, '${new Date().toISOString()}');
    `);
  }

  async getAll<T extends EntityWithId>(store: StoreName): Promise<T[]> {
    await this.writeQueue;
    const database = await this.requireDatabase();
    const result = await database.query(`SELECT data FROM ${store}`);
    return ((result.values ?? []) as Array<{ data?: unknown }>).map(row => this.deserialize<T>(row.data));
  }

  async get<T extends EntityWithId>(store: StoreName, id: string): Promise<T | undefined> {
    await this.writeQueue;
    const database = await this.requireDatabase();
    const result = await database.query(`SELECT data FROM ${store} WHERE id = ? LIMIT 1`, [id]);
    const row = result.values?.[0] as { data?: unknown } | undefined;
    return row ? this.deserialize<T>(row.data) : undefined;
  }

  async put<T extends EntityWithId>(store: StoreName, value: T): Promise<void> {
    await this.enqueueWrite(async database => {
      await database.run(`INSERT OR REPLACE INTO ${store}(id, data) VALUES (?, ?)`, [value.id, JSON.stringify(value)]);
    });
  }

  async delete(store: StoreName, id: string): Promise<void> {
    await this.enqueueWrite(async database => {
      await database.run(`DELETE FROM ${store} WHERE id = ?`, [id]);
    });
  }

  async batch(mutations: StorageMutation[]): Promise<void> {
    if (mutations.length === 0) return;
    await this.enqueueWrite(async database => {
      await database.beginTransaction();
      try {
        for (const mutation of mutations) {
          if (mutation.operation === 'PUT' && mutation.value) {
            await database.run(
              `INSERT OR REPLACE INTO ${mutation.store}(id, data) VALUES (?, ?)`,
              [mutation.value.id, JSON.stringify(mutation.value)],
              false,
            );
          }
          if (mutation.operation === 'DELETE' && mutation.id) {
            await database.run(`DELETE FROM ${mutation.store} WHERE id = ?`, [mutation.id], false);
          }
        }
        await database.commitTransaction();
      } catch (error: unknown) {
        try {
          await database.rollbackTransaction();
        } catch {
          // Preserve the original write error if the native transaction already closed.
        }
        throw error;
      }
    });
  }

  async clear(stores: StoreName[]): Promise<void> {
    if (stores.length === 0) return;
    await this.enqueueWrite(async database => {
      await database.beginTransaction();
      try {
        for (const store of stores) await database.run(`DELETE FROM ${store}`, [], false);
        await database.commitTransaction();
      } catch (error: unknown) {
        try {
          await database.rollbackTransaction();
        } catch {
          // Preserve the original write error if the native transaction already closed.
        }
        throw error;
      }
    });
  }

  private async enqueueWrite(operation: (database: SQLiteDBConnection) => Promise<void>): Promise<void> {
    const queued = this.writeQueue.then(
      async () => operation(await this.requireDatabase()),
      async () => operation(await this.requireDatabase()),
    );
    this.writeQueue = queued.catch(() => undefined);
    return queued;
  }

  private async requireDatabase(): Promise<SQLiteDBConnection> {
    await this.initialize();
    if (!this.database) throw new Error('SQLite is not initialized.');
    return this.database;
  }

  private deserialize<T>(value: unknown): T {
    if (typeof value !== 'string') throw new Error('Stored SQLite value is invalid.');
    return JSON.parse(value) as T;
  }
}
