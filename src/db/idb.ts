// Raw IndexedDB: хранилища projects и assets (без внешних зависимостей)
import type { AssetRecord, ProjectRecord } from '../types';

const DB_NAME = 'supame-db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('projects')) {
        db.createObjectStore('projects', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('assets')) {
        db.createObjectStore('assets', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(
  store: 'projects' | 'assets',
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = run(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

// ---------- Projects ----------

export function putProject(record: ProjectRecord): Promise<IDBValidKey> {
  return tx('projects', 'readwrite', (s) => s.put(record));
}

export function getProject(id: string): Promise<ProjectRecord | undefined> {
  return tx('projects', 'readonly', (s) => s.get(id));
}

export function deleteProject(id: string): Promise<undefined> {
  return tx('projects', 'readwrite', (s) => s.delete(id));
}

export function listProjects(): Promise<ProjectRecord[]> {
  return tx('projects', 'readonly', (s) => s.getAll());
}

// ---------- Assets ----------

export function putAsset(record: AssetRecord): Promise<IDBValidKey> {
  return tx('assets', 'readwrite', (s) => s.put(record));
}

export function getAsset(id: string): Promise<AssetRecord | undefined> {
  return tx('assets', 'readonly', (s) => s.get(id));
}

/** Метаданные всех ассетов (без загрузки blob в UI — blob придёт, но используется только имя/id) */
export function listAssets(): Promise<AssetRecord[]> {
  return tx('assets', 'readonly', (s) => s.getAll());
}

export function deleteAsset(id: string): Promise<undefined> {
  return tx('assets', 'readwrite', (s) => s.delete(id));
}

/** Удалить много ассетов одной транзакцией (для сборщика мусора) */
export function deleteManyAssets(ids: string[]): Promise<undefined> {
  if (!ids.length) return Promise.resolve(undefined);
  return openDb().then(
    (db) =>
      new Promise<undefined>((resolve, reject) => {
        const t = db.transaction('assets', 'readwrite');
        const store = t.objectStore('assets');
        for (const id of ids) store.delete(id);
        t.oncomplete = () => resolve(undefined);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      })
  );
}
