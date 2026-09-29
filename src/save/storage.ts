import { createStore, del, get, keys, set, type UseStore } from 'idb-keyval';

/** Key–value storage used for saves. IndexedDB in the browser, in-memory in tests. */
export interface SaveStorage {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

export function createIdbStorage(dbName = 'foil-and-fortune', storeName = 'saves'): SaveStorage {
  let store: UseStore | undefined;
  const handle = () => {
    store ??= createStore(dbName, storeName);
    return store;
  };
  return {
    get: (key) => get(key, handle()),
    set: (key, value) => set(key, value, handle()),
    del: (key) => del(key, handle()),
    keys: async () => (await keys(handle())).map(String),
  };
}

export function createMemoryStorage(): SaveStorage {
  const map = new Map<string, unknown>();
  return {
    get: async (key) => structuredClone(map.get(key)),
    set: async (key, value) => {
      map.set(key, structuredClone(value));
    },
    del: async (key) => {
      map.delete(key);
    },
    keys: async () => [...map.keys()],
  };
}

/** Asks the browser not to evict our saves (docs/06 §11). Best effort. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
