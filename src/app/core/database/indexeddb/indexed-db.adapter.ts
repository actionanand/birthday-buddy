import { DatabaseAdapter, EntityWithId, StorageMutation, StoreName } from '../../repositories/repository.interfaces';

const DATABASE_NAME = 'birthday-buddy';
const DATABASE_VERSION = 1;
const STORES: StoreName[] = [
  'people',
  'occasions',
  'occasion_reminders',
  'notification_schedule',
  'contact_sync_ignores',
  'app_settings',
];

export class IndexedDbAdapter implements DatabaseAdapter {
  private database?: IDBDatabase;

  initialize(): Promise<void> {
    if (this.database) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        for (const store of STORES) {
          if (!database.objectStoreNames.contains(store)) database.createObjectStore(store, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => {
        this.database = request.result;
        resolve();
      };
      request.onerror = () => reject(request.error ?? new Error('IndexedDB could not be opened.'));
    });
  }

  async getAll<T extends EntityWithId>(store: StoreName): Promise<T[]> {
    await this.initialize();
    return this.request<T[]>(store, 'readonly', objectStore => objectStore.getAll());
  }

  async get<T extends EntityWithId>(store: StoreName, id: string): Promise<T | undefined> {
    await this.initialize();
    return this.request<T | undefined>(store, 'readonly', objectStore => objectStore.get(id));
  }

  async put<T extends EntityWithId>(store: StoreName, value: T): Promise<void> {
    await this.initialize();
    await this.request(store, 'readwrite', objectStore => objectStore.put(value));
  }

  async delete(store: StoreName, id: string): Promise<void> {
    await this.initialize();
    await this.request(store, 'readwrite', objectStore => objectStore.delete(id));
  }

  async batch(mutations: StorageMutation[]): Promise<void> {
    await this.initialize();
    if (mutations.length === 0) return;
    const stores = [...new Set(mutations.map(mutation => mutation.store))];
    const database = this.requireDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(stores, 'readwrite');
      for (const mutation of mutations) {
        const store = transaction.objectStore(mutation.store);
        if (mutation.operation === 'PUT' && mutation.value) store.put(mutation.value);
        if (mutation.operation === 'DELETE' && mutation.id) store.delete(mutation.id);
      }
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction was aborted.'));
    });
  }

  async clear(stores: StoreName[]): Promise<void> {
    await this.initialize();
    const database = this.requireDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(stores, 'readwrite');
      for (const store of stores) transaction.objectStore(store).clear();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB clear failed.'));
    });
  }

  private request<T>(
    store: StoreName,
    mode: IDBTransactionMode,
    action: (objectStore: IDBObjectStore) => IDBRequest,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const request = action(this.requireDatabase().transaction(store, mode).objectStore(store));
      request.onsuccess = () => resolve(request.result as T);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
    });
  }

  private requireDatabase(): IDBDatabase {
    if (!this.database) throw new Error('IndexedDB is not initialized.');
    return this.database;
  }
}
