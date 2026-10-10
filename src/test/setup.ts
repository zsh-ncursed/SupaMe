// Тестовое окружение: подменяем IndexedDB на fake-indexeddb, чтобы юнит-тесты
// могли работать с idb-модулями (idb.ts, gc.ts, projectIO, editorStore) без браузера.
import 'fake-indexeddb/auto';

// jsdom в этой версии не создаёт IDBKeyRange поверх fake-indexeddb
import { IDBKeyRange } from 'fake-indexeddb';
if (typeof globalThis.IDBKeyRange === 'undefined') {
  globalThis.IDBKeyRange = IDBKeyRange;
}
