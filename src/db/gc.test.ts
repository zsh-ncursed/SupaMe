import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { assetIdsOfProject, liveAssetIds, collectGarbage, scheduleCollectGarbage } from './gc';
import { putAsset, putProject, listAssets, deleteProject } from './idb';
import { GC_DEBOUNCE_MS } from '../lib/config';
import type { AssetRecord, EditorObject, ProjectRecord, ShapeObject } from '../types';

function mkAsset(id: string): AssetRecord {
  return {
    id,
    name: `a-${id}`,
    mime: 'image/png',
    blob: new Blob(['x'], { type: 'image/png' }),
    createdAt: 1,
  };
}

function mkImage(id: string, assetId: string): EditorObject {
  return {
    id,
    kind: 'image',
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    assetId,
    flipX: false,
    flipY: false,
    crop: null,
    filters: {
      brightness: 100,
      contrast: 0,
      saturation: 100,
      blur: 0,
      grayscale: false,
      sepia: false,
    },
  };
}

function mkShape(id: string): ShapeObject {
  return {
    id,
    kind: 'shape',
    x: 5,
    y: 5,
    width: 10,
    height: 10,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    shape: 'rect',
    fill: null,
    strokeColor: '#000',
    strokeWidth: 1,
    cornerRadius: 0,
    points: [],
    tension: 0,
  };
}

function mkProject(
  id: string,
  objects: EditorObject[],
  bg?: Partial<ProjectRecord['data']['canvas']['background']>
): ProjectRecord {
  return {
    id,
    name: id,
    createdAt: 1,
    updatedAt: 2,
    thumbnail: null,
    data: {
      version: 1,
      canvas: {
        width: 100,
        height: 100,
        background: { type: 'color', color: '#fff', transparent: false, ...bg },
      },
      objects,
    },
  };
}

describe('assetIdsOfProject', () => {
  it('collects ids from image objects and image background', () => {
    const proj = mkProject('p1', [mkImage('o1', 'a1'), mkShape('o2')], {
      type: 'image',
      assetId: 'bg1',
    });
    expect(assetIdsOfProject(proj.data).sort()).toEqual(['a1', 'bg1']);
  });

  it('ignores non-image objects and color backgrounds', () => {
    const proj = mkProject('p1', [mkShape('o1')]);
    expect(assetIdsOfProject(proj.data)).toEqual([]);
  });
});

describe('liveAssetIds', () => {
  it('unions asset ids across several projects', () => {
    const projects = [
      mkProject('p1', [mkImage('o1', 'a1')]),
      mkProject('p2', [mkImage('o2', 'a2')], { type: 'image', assetId: 'bg2' }),
      mkProject('p3', [mkShape('o3')]),
    ];
    expect([...liveAssetIds(projects)].sort()).toEqual(['a1', 'a2', 'bg2']);
  });

  it('returns an empty set for no projects', () => {
    expect([...liveAssetIds([])]).toEqual([]);
  });
});

describe('collectGarbage', () => {
  beforeEach(async () => {
    // чистая БД на каждый тест: fake-indexeddb свежий в этом файле, очищаем storage
    await clearEverything();
  });
  afterEach(() => vi.useRealTimers());

  it('deletes orphaned assets and keeps those referenced by a project', async () => {
    await putAsset(mkAsset('a1'));
    await putAsset(mkAsset('a2'));
    await putPropProject();
    const removed = await collectGarbage();
    expect(removed.sort()).toEqual(['a2']);
    const rest = (await listAssets()).map((a) => a.id).sort();
    expect(rest).toEqual(['a1']);
  });

  it('returns [] when nothing is stale', async () => {
    await putAsset(mkAsset('a1'));
    await putPropProject();
    expect(await collectGarbage()).toEqual([]);
  });

  it('protects unpersisted assets passed as extraLive', async () => {
    await putAsset(mkAsset('a1'));
    await putAsset(mkAsset('a2'));
    await putAsset(mkAsset('a3'));
    await putPropProject(); // ссылается только на a1
    const removed = await collectGarbage(['a2']);
    expect(removed).toEqual(['a3']);
    const rest = (await listAssets()).map((a) => a.id).sort();
    expect(rest.sort()).toEqual(['a1', 'a2']);
  });

  it('removes stale assets after projects are deleted too', async () => {
    await putAsset(mkAsset('a1'));
    await putPropProject();
    await deleteProject('p1'); // ссылка на a1 исчезает
    const removed = await collectGarbage();
    expect(removed).toEqual(['a1']);
    expect(await listAssets()).toHaveLength(0);
  });
});

describe('scheduleCollectGarbage', () => {
  beforeEach(async () => await clearEverything());
  afterEach(() => vi.useRealTimers());

  it('debounces and collects after the configured delay', async () => {
    await putAsset(mkAsset('a1'));
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    scheduleCollectGarbage();
    // до истечения дебаунса ничего не удалено
    expect(await listAssets()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(GC_DEBOUNCE_MS + 10);
    vi.useRealTimers();
    await vi.waitFor(async () => {
      expect(await listAssets()).toHaveLength(0);
    });
  });

  it('resets the timer on repeated calls within the window', async () => {
    await putAsset(mkAsset('a1'));
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    scheduleCollectGarbage();
    await vi.advanceTimersByTimeAsync(GC_DEBOUNCE_MS - 100);
    scheduleCollectGarbage(); // сброс таймера
    await vi.advanceTimersByTimeAsync(100);
    expect(await listAssets()).toHaveLength(1); // ещё рано
    await vi.advanceTimersByTimeAsync(GC_DEBOUNCE_MS + 10);
    vi.useRealTimers();
    await vi.waitFor(async () => {
      expect(await listAssets()).toHaveLength(0);
    });
  });
});

// вспомогательные утилиты для тестов
async function putPropProject() {
  await putProject(mkProject('p1', [mkImage('o1', 'a1')]));
}

async function clearEverything() {
  // fake-indexeddb раскрывает внутренние хранилища (_values) — чистим только свои.
  // Открываем на версии 2 и сами создаём хранилища, если БД ещё не инициализирована.
  const stores = ['projects', 'project-meta', 'assets'];
  const req = indexedDB.open('supame-db', 2);
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onupgradeneeded = () => {
      for (const name of stores) {
        if (!req.result.objectStoreNames.contains(name)) {
          req.result.createObjectStore(name, { keyPath: 'id' });
        }
      }
    };
  });
  for (const store of stores) {
    await new Promise<void>((resolve, reject) => {
      const t = db.transaction(store, 'readwrite');
      t.objectStore(store).clear();
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
    });
  }
  db.close();
}
