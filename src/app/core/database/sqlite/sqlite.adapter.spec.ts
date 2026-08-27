import { vi } from 'vitest';

const native = vi.hoisted(() => {
  const state = { transactionActive: false };
  const database = {
    open: vi.fn().mockResolvedValue(undefined),
    execute: vi.fn().mockResolvedValue(undefined),
    query: vi.fn().mockResolvedValue({ values: [] }),
    run: vi.fn().mockImplementation(async () => {
      await Promise.resolve();
    }),
    beginTransaction: vi.fn().mockImplementation(async () => {
      if (state.transactionActive) throw new Error('Already in transaction');
      state.transactionActive = true;
    }),
    commitTransaction: vi.fn().mockImplementation(async () => {
      state.transactionActive = false;
    }),
    rollbackTransaction: vi.fn().mockImplementation(async () => {
      state.transactionActive = false;
    }),
  };
  return { state, database };
});

vi.mock('@capacitor-community/sqlite', () => ({
  CapacitorSQLite: {},
  SQLiteConnection: class {
    createConnection(): Promise<typeof native.database> {
      return Promise.resolve(native.database);
    }
  },
}));

import { SQLiteAdapter } from './sqlite.adapter';

describe('SQLiteAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    native.state.transactionActive = false;
  });

  it('does not start an implicit transaction for statements inside a batch', async () => {
    const adapter = new SQLiteAdapter();
    await adapter.batch([
      { store: 'people', operation: 'PUT', value: { id: 'person-1' } },
      { store: 'people', operation: 'DELETE', id: 'person-2' },
    ]);

    expect(native.database.run).toHaveBeenNthCalledWith(
      1,
      'INSERT OR REPLACE INTO people(id, data) VALUES (?, ?)',
      ['person-1', JSON.stringify({ id: 'person-1' })],
      false,
    );
    expect(native.database.run).toHaveBeenNthCalledWith(2, 'DELETE FROM people WHERE id = ?', ['person-2'], false);
  });

  it('serializes concurrent batches on the shared native connection', async () => {
    const adapter = new SQLiteAdapter();
    await Promise.all([
      adapter.batch([{ store: 'people', operation: 'PUT', value: { id: 'person-1' } }]),
      adapter.batch([{ store: 'people', operation: 'PUT', value: { id: 'person-2' } }]),
    ]);

    expect(native.database.beginTransaction).toHaveBeenCalledTimes(2);
    expect(native.database.commitTransaction).toHaveBeenCalledTimes(2);
    expect(native.state.transactionActive).toBe(false);
  });
});
