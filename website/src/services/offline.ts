/*
 * BillKit — minimal IndexedDB key/value store for offline copies of the
 * signed-in user's bill list and details. Cleared on sign-out.
 * © 2026 Shaik Gouse Kareem. All rights reserved.
 */
const DB_NAME = 'billkit-offline';
const STORE = 'kv';

function open(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  const db = await open();
  if (!db) return undefined;
  return new Promise((resolve) => {
    const t = db.transaction(STORE, mode);
    const r = fn(t.objectStore(STORE));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => resolve(undefined);
  });
}

let scope = 'anon';
export const offlineCache = {
  setScope(userId: string | null) {
    scope = userId ?? 'anon';
  },
  async get<T>(key: string): Promise<{ value: T; savedAt: string } | undefined> {
    return tx('readonly', (s) => s.get(`${scope}:${key}`)) as Promise<{ value: T; savedAt: string } | undefined>;
  },
  async set(key: string, value: unknown): Promise<void> {
    if (scope === 'anon') return;
    await tx('readwrite', (s) => s.put({ value, savedAt: new Date().toISOString() }, `${scope}:${key}`));
  },
  async clear(): Promise<void> {
    await tx('readwrite', (s) => s.clear());
  },
};
