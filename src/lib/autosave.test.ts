import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEditor } from '../store/editorStore';
import { startAutosave, forceSave } from './autosave';
import { getProject, listProjectMeta } from '../db/idb';
import { AUTOSAVE_DEBOUNCE_MS } from './config';
import { renderThumbnail } from './stageCapture';
import type { ProjectRecord } from '../types';

// renderThumbnail рисует реальный Konva.Stage — в юнит-тестах подменяем на заглушку,
// чтобы проверить логику автосохранения (таймеры, flush, ошибки).
vi.mock('./stageCapture', () => ({ renderThumbnail: vi.fn(async () => null) }));
const mockRender = vi.mocked(renderThumbnail);

let stop: (() => void) | undefined;

const pidOf = () => useEditor.getState().projectId as string;

beforeEach(async () => {
  await clearDb();
  // ровно «нейтральные» поля, чтобы не зависеть от порядка исполнения в файле
  useEditor.setState({
    projectId: null,
    projectName: 'Без названия',
    createdAt: 0,
    updatedAt: 0,
    saveStatus: 'saved',
    canvas: {
      width: 1080,
      height: 1080,
      background: { type: 'color', color: '#fff', transparent: false },
    },
    objects: [],
    selectedIds: [],
    zoom: 1,
    exporting: false,
    past: [],
    future: [],
    transientSnapshot: null,
    toast: null,
    clipboard: [],
    projectsVersion: 0,
  } as never);
  mockRender.mockReset();
  mockRender.mockImplementation(async () => null);
});

afterEach(() => {
  stop?.();
  stop = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function boot() {
  stop = startAutosave();
}

async function currentProject(): Promise<ProjectRecord> {
  const r = await getProject(pidOf());
  if (!r) throw new Error('проект не найден');
  return r;
}

async function clearDb() {
  // внутри одного файла БД общая — очищаем хранилища перед каждым тестом
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

describe('autosave: debounce', () => {
  it('starts a project save after the debounce window when status becomes dirty', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    boot();
    useEditor.getState().newProject();
    // до истечения дебаунса ещё не сохранили
    expect(await listProjectMeta()).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS + 5);
    vi.useRealTimers();
    await vi.waitFor(async () => {
      expect(useEditor.getState().saveStatus).toBe('saved');
    });
    const rec = await currentProject();
    expect(rec.name).toBe('Новый проект');
    expect(rec.thumbnail).toBeNull();
  });

  it('does not save when there is no project', async () => {
    forceSave();
    expect(await listProjectMeta()).toHaveLength(0);
  });
});

describe('autosave: start/stop lifecycle', () => {
  it('startAutosave is idempotent: the second stop() is a no-op that does not stop the first', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const stopA = startAutosave();
    const stopB = startAutosave();
    stopB(); // no-op, keeps stopA alive
    useEditor.getState().newProject();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS + 5);
    vi.useRealTimers();
    await vi.waitFor(async () => {
      expect(useEditor.getState().saveStatus).toBe('saved');
    });
    stopA();
  });

  it('stop() clears the pending timer and unsubscribes', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    boot();
    useEditor.getState().newProject();
    stop?.();
    stop = undefined;
    useEditor.getState().setSaveStatus('dirty');
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS + 5);
    vi.useRealTimers();
    expect(useEditor.getState().saveStatus).toBe('dirty');
    expect(await listProjectMeta()).toHaveLength(0);
  });
});

describe('autosave: flush on page hide', () => {
  it('saves immediately on the pagehide event', async () => {
    boot();
    useEditor.getState().newProject();
    window.dispatchEvent(new Event('pagehide'));
    await vi.waitFor(async () => {
      expect(useEditor.getState().saveStatus).toBe('saved');
    });
  });

  it('saves immediately when visibility becomes hidden', async () => {
    boot();
    useEditor.getState().newProject();
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.waitFor(async () => {
      expect(useEditor.getState().saveStatus).toBe('saved');
    });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
  });

  it('saves immediately on beforeunload', async () => {
    boot();
    useEditor.getState().newProject();
    window.dispatchEvent(new Event('beforeunload'));
    await vi.waitFor(async () => {
      expect(useEditor.getState().saveStatus).toBe('saved');
    });
  });
});

describe('autosave: forceSave', () => {
  it('forces a save without waiting for the debounce', async () => {
    boot();
    useEditor.getState().newProject();
    forceSave();
    await vi.waitFor(async () => {
      const r = await getProject(pidOf());
      expect(r).toBeDefined();
      expect(r?.data.canvas.width).toBe(1080);
    });
    expect(useEditor.getState().saveStatus).toBe('saved');
  });

  it('reports an error and returns to dirty when saving fails', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockRender.mockRejectedValueOnce(new Error('no canvas'));
    boot();
    useEditor.getState().newProject();
    forceSave();
    await vi.waitFor(() => {
      expect(useEditor.getState().saveStatus).toBe('dirty');
    });
    expect(useEditor.getState().toast?.type).toBe('error');
    expect(useEditor.getState().toast?.text).toBe('Ошибка сохранения проекта');
    errSpy.mockRestore();
  });
});

describe('autosave: persistence payload', () => {
  it('writes the full record and a lightweight meta entry', async () => {
    boot();
    useEditor.getState().newProject();
    useEditor.getState().addObjects([{ id: 'o1', kind: 'text', text: 'x' } as never]);
    forceSave();
    await vi.waitFor(async () => {
      expect(useEditor.getState().saveStatus).toBe('saved');
    });
    const rec = await currentProject();
    expect(rec.data.objects).toHaveLength(1);
    expect(rec.data.canvas.background.color).toBe('#FFFFFF');
    const metas = await listProjectMeta();
    const meta = metas.find((m) => m.id === rec.id);
    expect(meta).toBeDefined();
    expect(meta?.objectCount).toBe(1);
    expect(meta?.width).toBe(1080);
  });
});
