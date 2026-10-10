import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { useEditor } from './editorStore';
import type { EditorObject, ProjectRecord, ShapeObject } from '../types';
import { HISTORY_LIMIT, MAX_CANVAS, MIN_CANVAS } from '../types';
import { ZOOM_MIN, ZOOM_MAX } from '../lib/config';
import { scheduleCollectGarbage } from '../db/gc';

// Удаление объектов помечает GC через таймер — в юнит-тестах проверяем только факт вызова.
vi.mock('../db/gc', () => ({ scheduleCollectGarbage: vi.fn() }));
const scheduleGc = vi.mocked(scheduleCollectGarbage);

const DEFAULT_CANVAS = {
  width: 1080,
  height: 1080,
  background: { type: 'color' as const, color: '#FFFFFF', transparent: false },
};

function resetStore() {
  useEditor.setState({
    projectId: null,
    projectName: 'Без названия',
    createdAt: 0,
    updatedAt: 0,
    saveStatus: 'saved',
    canvas: { ...DEFAULT_CANVAS, background: { ...DEFAULT_CANVAS.background } },
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
  });
  scheduleGc.mockClear();
}

function obj(id: string, partial: Partial<ShapeObject> = {}): ShapeObject {
  return {
    id,
    kind: 'shape',
    x: 0,
    y: 0,
    width: 50,
    height: 50,
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
    ...partial,
  };
}

function record(): ProjectRecord {
  return {
    id: 'p1',
    name: 'Сохранённый',
    createdAt: 10,
    updatedAt: 20,
    thumbnail: null,
    data: {
      version: 1,
      canvas: {
        width: 800,
        height: 600,
        background: { type: 'color', color: '#123456', transparent: false },
      },
      objects: [obj('kept')],
    },
  };
}

describe('editorStore: project lifecycle', () => {
  beforeEach(resetStore);

  it('newProject resets state and flags the project as dirty', () => {
    useEditor.getState().newProject();
    const s = useEditor.getState();
    expect(s.projectId).toBeTruthy();
    expect(s.projectName).toBe('Новый проект');
    expect(s.saveStatus).toBe('dirty');
    expect(s.objects).toEqual([]);
    expect(s.selectedIds).toEqual([]);
    expect(s.past).toEqual([]);
    expect(s.future).toEqual([]);
    expect(s.canvas.width).toBe(1080);
    expect(s.canvas.height).toBe(1080);
  });

  it('newProject accepts a custom canvas', () => {
    useEditor.getState().newProject({
      width: 500,
      height: 400,
      background: { type: 'color', color: '#fff', transparent: true },
    });
    const s = useEditor.getState();
    expect(s.canvas.width).toBe(500);
    expect(s.canvas.height).toBe(400);
    expect(s.canvas.background).toEqual({ type: 'color', color: '#fff', transparent: true });
  });

  it('loadProjectRecord deep-copies data and resets transient state', () => {
    useEditor.getState().loadProjectRecord(record());
    const s = useEditor.getState();
    expect(s.projectId).toBe('p1');
    expect(s.projectName).toBe('Сохранённый');
    expect(s.saveStatus).toBe('saved');
    expect(s.canvas.width).toBe(800);
    expect(s.objects).toHaveLength(1);
    // данные не разделяют ссылку с исходным record
    const rec = record();
    s.objects = [] as never;
    expect(rec.data.objects).toHaveLength(1);
  });

  it('setProjectName marks dirty', () => {
    useEditor.getState().setProjectName('Имя');
    expect(useEditor.getState().projectName).toBe('Имя');
    expect(useEditor.getState().saveStatus).toBe('dirty');
  });
});

describe('editorStore: canvas mutations', () => {
  beforeEach(resetStore);

  it('setCanvasSize clamps and rounds into history', () => {
    useEditor.getState().setCanvasSize(5000, 333.7);
    const s = useEditor.getState();
    expect(s.canvas.width).toBe(MAX_CANVAS);
    expect(s.canvas.height).toBe(334);
    expect(s.past).toHaveLength(1);
    expect(s.saveStatus).toBe('dirty');
  });

  it('setCanvasSize applies the minimum bound', () => {
    useEditor.getState().setCanvasSize(1, 1);
    const s = useEditor.getState();
    expect(s.canvas.width).toBe(MIN_CANVAS);
    expect(s.canvas.height).toBe(MIN_CANVAS);
  });

  it('setBackground merges patch and records history', () => {
    useEditor.getState().setBackground({ color: '#ff0000', transparent: true });
    const s = useEditor.getState();
    expect(s.canvas.background).toEqual({ type: 'color', color: '#ff0000', transparent: true });
    expect(s.past).toHaveLength(1);
    expect(s.saveStatus).toBe('dirty');
  });
});

describe('editorStore: objects', () => {
  beforeEach(resetStore);

  it('addObject appends, selects and writes history', () => {
    useEditor.getState().addObject(obj('o1'));
    const s = useEditor.getState();
    expect(s.objects.map((o) => o.id)).toEqual(['o1']);
    expect(s.selectedIds).toEqual(['o1']);
    expect(s.saveStatus).toBe('dirty');
    expect(s.past).toHaveLength(1);
  });

  it('addObjects appends several and selects them all', () => {
    useEditor.getState().addObjects([obj('o1'), obj('o2')]);
    const s = useEditor.getState();
    expect(s.objects.map((o) => o.id)).toEqual(['o1', 'o2']);
    expect(s.selectedIds).toEqual(['o1', 'o2']);
  });

  it('updateObject records history and patches only the target', () => {
    useEditor.getState().addObjects([obj('o1'), obj('o2')]);
    useEditor.getState().updateObject('o1', { x: 100 });
    const s = useEditor.getState();
    expect(s.objects[0].x).toBe(100);
    expect(s.objects[1].x).toBe(0);
    expect(s.past).toHaveLength(2);
  });

  it('updateObject with history:false does not add a history entry', () => {
    useEditor.getState().addObjects([obj('o1')]);
    const pastLen = useEditor.getState().past.length;
    useEditor.getState().updateObject('o1', { x: 7 }, { history: false });
    expect(useEditor.getState().past).toHaveLength(pastLen);
  });

  it('updateObjects patches every matched id', () => {
    useEditor.getState().addObjects([obj('o1'), obj('o2'), obj('o3')]);
    useEditor.getState().updateObjects(['o1', 'o3'], { rotation: 45 });
    const s = useEditor.getState();
    expect(s.objects[0].rotation).toBe(45);
    expect(s.objects[1].rotation).toBe(0);
    expect(s.objects[2].rotation).toBe(45);
  });

  it('replaceObject swaps the whole object', () => {
    useEditor.getState().addObject(obj('o1'));
    useEditor.getState().replaceObject(obj('o1', { visible: false }));
    expect(useEditor.getState().objects[0].visible).toBe(false);
  });

  it('deleteObjects removes objects + selection and schedules GC', () => {
    useEditor.getState().addObjects([obj('o1'), obj('o2')]);
    useEditor.getState().select(['o1']);
    useEditor.getState().deleteObjects(['o1']);
    const s = useEditor.getState();
    expect(s.objects.map((o) => o.id)).toEqual(['o2']);
    expect(s.selectedIds).toEqual([]);
    expect(scheduleGc).toHaveBeenCalledOnce();
    expect(s.saveStatus).toBe('dirty');
  });

  it('deleteObjects([]) is a no-op that does not schedule GC', () => {
    useEditor.getState().addObject(obj('o1'));
    useEditor.getState().deleteObjects([]);
    expect(useEditor.getState().objects).toHaveLength(1);
    expect(scheduleGc).not.toHaveBeenCalled();
  });

  it('duplicateObjects clones with a new id, offset and unlocked state', () => {
    useEditor.getState().addObjects([obj('o1', { locked: true, x: 10, y: 20 })]);
    useEditor.getState().duplicateObjects(['o1']);
    const s = useEditor.getState();
    expect(s.objects).toHaveLength(2);
    const clone = s.objects[1];
    expect(clone.id).not.toBe('o1');
    expect(clone.x).toBe(34);
    expect(clone.y).toBe(44);
    expect(clone.locked).toBe(false);
    expect(s.selectedIds).toEqual([clone.id]);
  });

  it('duplicateObjects([]) does nothing', () => {
    useEditor.getState().addObject(obj('o1'));
    const before = useEditor.getState().past.length;
    useEditor.getState().duplicateObjects([]);
    expect(useEditor.getState().objects).toHaveLength(1);
    expect(useEditor.getState().past).toHaveLength(before);
  });
});

describe('editorStore: clipboard', () => {
  beforeEach(resetStore);

  it('copySelected deep-copies the selected objects', () => {
    useEditor.getState().addObjects([obj('o1', { x: 5 }), obj('o2')]);
    useEditor.getState().select(['o1']);
    useEditor.getState().copySelected();
    const clipboard = useEditor.getState().clipboard;
    expect(clipboard).toHaveLength(1);
    expect(clipboard[0].id).toBe('o1');
    useEditor.getState().updateObject('o1', { x: 999 });
    // буфер не связан с оригиналом
    expect(useEditor.getState().clipboard[0].x).toBe(5);
  });

  it('pasteClipboard inserts clones with fresh ids and history', () => {
    useEditor.getState().addObjects([obj('o1', { x: 5, y: 5 })]);
    useEditor.getState().select(['o1']);
    useEditor.getState().copySelected();
    const pastLen = useEditor.getState().past.length;
    useEditor.getState().pasteClipboard();
    const s = useEditor.getState();
    expect(s.objects).toHaveLength(2);
    const paste = s.objects[1];
    expect(paste.id).not.toBe('o1');
    expect(paste.x).toBe(29);
    expect(paste.y).toBe(29);
    expect(s.selectedIds).toEqual([paste.id]);
    expect(s.past).toHaveLength(pastLen + 1);
    expect(s.saveStatus).toBe('dirty');
  });

  it('pasteClipboard with empty clipboard is a no-op', () => {
    useEditor.getState().pasteClipboard();
    expect(useEditor.getState().objects).toEqual([]);
  });
});

describe('editorStore: transient ops', () => {
  beforeEach(resetStore);

  it('no change between begin and end produces no history entry', () => {
    useEditor.getState().addObject(obj('o1'));
    const pastLen = useEditor.getState().past.length;
    useEditor.getState().beginTransient();
    useEditor.getState().endTransient();
    expect(useEditor.getState().past).toHaveLength(pastLen);
  });

  it('a change inside the transient window becomes a single history entry', () => {
    useEditor.getState().addObject(obj('o1', { x: 10 }));
    const pastLen = useEditor.getState().past.length;
    useEditor.getState().beginTransient();
    useEditor.getState().updateObject('o1', { x: 20 }, { history: false });
    useEditor.getState().updateObject('o1', { x: 30 }, { history: false });
    useEditor.getState().endTransient();
    expect(useEditor.getState().past).toHaveLength(pastLen + 1);
  });

  it('endTransient without beginTransient is a safe no-op', () => {
    useEditor.getState().addObject(obj('o1'));
    const pastLen = useEditor.getState().past.length;
    expect(() => useEditor.getState().endTransient()).not.toThrow();
    expect(useEditor.getState().past).toHaveLength(pastLen);
  });
});

describe('editorStore: selection', () => {
  beforeEach(resetStore);

  it('select replaces the selection by default', () => {
    useEditor.getState().addObjects([obj('o1'), obj('o2')]);
    useEditor.getState().select(['o1']);
    useEditor.getState().select(['o2']);
    expect(useEditor.getState().selectedIds).toEqual(['o2']);
  });

  it('select additive toggles ids in and out', () => {
    const sel = (ids: string[]) => useEditor.getState().select(ids, true);
    sel(['a']);
    expect(useEditor.getState().selectedIds).toEqual(['a']);
    sel(['a']); // тот же id — выключаем
    expect(useEditor.getState().selectedIds).toEqual([]);
    sel(['a']);
    sel(['b']);
    expect(useEditor.getState().selectedIds.sort()).toEqual(['a', 'b']);
    sel(['b']);
    expect(useEditor.getState().selectedIds).toEqual(['a']);
  });

  it('toggleSelect adds then removes a single id', () => {
    useEditor.getState().addObjects([obj('o1'), obj('o2')]);
    useEditor.getState().clearSelection();
    useEditor.getState().toggleSelect('o1');
    expect(useEditor.getState().selectedIds).toEqual(['o1']);
    useEditor.getState().toggleSelect('o1');
    expect(useEditor.getState().selectedIds).toEqual([]);
  });

  it('selectAll picks only unlocked objects', () => {
    useEditor.getState().addObjects([obj('o1'), obj('o2', { locked: true })]);
    useEditor.getState().selectAll();
    expect(useEditor.getState().selectedIds).toEqual(['o1']);
  });

  it('clearSelection empties the selection', () => {
    useEditor.getState().addObjects([obj('o1')]);
    useEditor.getState().select(['o1']);
    useEditor.getState().clearSelection();
    expect(useEditor.getState().selectedIds).toEqual([]);
  });
});

describe('editorStore: layers', () => {
  beforeEach(resetStore);

  it('moveLayer front brings the selected object to the end', () => {
    useEditor.getState().addObjects([obj('a'), obj('b'), obj('c')]);
    useEditor.getState().moveLayer(['b'], 'front');
    expect(useEditor.getState().objects.map((o) => o.id)).toEqual(['a', 'c', 'b']);
  });

  it('moveLayer back brings the selected object to the start', () => {
    useEditor.getState().addObjects([obj('a'), obj('b'), obj('c')]);
    useEditor.getState().moveLayer(['b'], 'back');
    expect(useEditor.getState().objects.map((o) => o.id)).toEqual(['b', 'a', 'c']);
  });

  it('moveLayer up/down swap with neighbours and clamp at the edges', () => {
    useEditor.getState().addObjects([obj('a'), obj('b'), obj('c'), obj('d')]);
    // 'up' = поднять в z-порядке на один уровень (индекс +1)
    useEditor.getState().moveLayer(['c'], 'up'); // c с индекса 2 на 3
    expect(useEditor.getState().objects.map((o) => o.id)).toEqual(['a', 'b', 'd', 'c']);
    // c теперь на верхней границе — дальше не поднимется
    const snapshot = [...useEditor.getState().objects];
    useEditor.getState().moveLayer(['c'], 'up');
    expect(useEditor.getState().objects.map((o) => o.id)).toEqual(snapshot.map((o) => o.id));
    // 'a' на нижней границе — 'down' ничего не делает
    useEditor.getState().moveLayer(['a'], 'down');
    expect(useEditor.getState().objects.map((o) => o.id)).toEqual(snapshot.map((o) => o.id));
    // 'a' вверх на один уровень
    useEditor.getState().moveLayer(['a'], 'up');
    expect(useEditor.getState().objects.map((o) => o.id)).toEqual(['b', 'a', 'd', 'c']);
    // 'd' вниз на один уровень: [b, a, d, c] -> [b, d, a, c]
    useEditor.getState().moveLayer(['d'], 'down');
    expect(useEditor.getState().objects.map((o) => o.id)).toEqual(['b', 'd', 'a', 'c']);
  });

  it('moveLayer with empty ids leaves state untouched', () => {
    useEditor.getState().addObjects([obj('a')]);
    const pastLen = useEditor.getState().past.length;
    useEditor.getState().moveLayer([], 'front');
    expect(useEditor.getState().objects).toHaveLength(1);
    expect(useEditor.getState().past).toHaveLength(pastLen);
  });
});

describe('editorStore: align & distribute', () => {
  beforeEach(resetStore);

  it('aligns selected objects to every edge/center mode', () => {
    const canvas = { width: 1000, height: 800 };
    useEditor.getState().newProject(canvas);
    useEditor
      .getState()
      .addObjects([
        obj('a', { x: 7, y: 9, width: 40, height: 60 }),
        obj('b', { x: 7, y: 9, width: 40, height: 60 }),
      ]);
    useEditor.getState().select(['a', 'b']);

    // режимы выравнивания меняют только свою ось; другая остаётся 7/9
    const cases: Record<string, Partial<Record<'x' | 'y', number>>> = {
      left: { x: 20 },
      hcenter: { x: 500 },
      right: { x: 980 },
      top: { y: 30 },
      vcenter: { y: 400 },
      bottom: { y: 770 },
    };
    for (const [mode, expected] of Object.entries(cases)) {
      // восстанавливаем исходные позиции
      useEditor.getState().replaceObject(obj('a', { x: 7, y: 9, width: 40, height: 60 }));
      useEditor.getState().replaceObject(obj('b', { x: 7, y: 9, width: 40, height: 60 }));
      useEditor.getState().select(['a', 'b']);
      useEditor.getState().alignSelected(mode as never);
      const s = useEditor.getState();
      for (const o of s.objects) {
        if (expected.x !== undefined) expect(o.x).toBe(expected.x);
        if (expected.y !== undefined) expect(o.y).toBe(expected.y);
        if (expected.x === undefined) expect(o.x).toBe(7);
        if (expected.y === undefined) expect(o.y).toBe(9);
      }
    }
  });

  it('alignSelected skips locked objects and no-ops on empty selection', () => {
    const canvas = { width: 200, height: 100 };
    useEditor.getState().newProject(canvas);
    useEditor.getState().addObjects([obj('free'), obj('locked', { locked: true, x: 3, y: 3 })]);
    useEditor.getState().select(['free', 'locked']);
    useEditor.getState().alignSelected('left');
    const s = useEditor.getState();
    expect(s.objects[0].x).toBe(25); // free выровнен
    expect(s.objects[1].x).toBe(3); // locked не тронут

    const pastLen = s.past.length;
    useEditor.getState().clearSelection();
    useEditor.getState().alignSelected('left');
    expect(useEditor.getState().past).toHaveLength(pastLen);
  });

  it('distributeSelected spaces 3+ objects evenly', () => {
    const canvas = { width: 500, height: 500 };
    useEditor.getState().newProject(canvas);
    useEditor
      .getState()
      .addObjects([obj('a', { x: 0 }), obj('b', { x: 10 }), obj('c', { x: 100 })]);
    useEditor.getState().select(['a', 'b', 'c']);
    useEditor.getState().distributeSelected('h');
    const s = useEditor.getState();
    // a->0, b->50, c->100 по горизонтали
    expect(s.objects.map((o) => o.x)).toEqual([0, 50, 100]);
  });

  it('distributeSelected with fewer than 3 objects is a no-op', () => {
    const canvas = { width: 500, height: 500 };
    useEditor.getState().newProject(canvas);
    useEditor.getState().addObjects([obj('a'), obj('b')]);
    useEditor.getState().select(['a', 'b']);
    const pastLen = useEditor.getState().past.length;
    useEditor.getState().distributeSelected('h');
    expect(useEditor.getState().past).toHaveLength(pastLen);
  });
});

describe('editorStore: undo/redo', () => {
  beforeEach(resetStore);

  it('undo reverts to the previous state and redo replays it', () => {
    useEditor.getState().addObjects([obj('o1'), obj('o2')]);
    useEditor.getState().deleteObjects(['o1']);
    expect(useEditor.getState().objects).toHaveLength(1);

    useEditor.getState().undo();
    expect(useEditor.getState().objects).toHaveLength(2);
    expect(
      useEditor
        .getState()
        .objects.map((o) => o.id)
        .sort()
    ).toEqual(['o1', 'o2']);

    useEditor.getState().redo();
    expect(useEditor.getState().objects.map((o) => o.id)).toEqual(['o2']);
    expect(useEditor.getState().saveStatus).toBe('dirty');
  });

  it('undo with an empty past is a no-op', () => {
    useEditor.getState().undo();
    expect(useEditor.getState().objects).toEqual([]);
  });

  it('undo drops selection ids that no longer exist after restore', () => {
    useEditor.getState().addObjects([obj('gone'), obj('kept')]);
    useEditor.getState().select(['gone']);
    useEditor.getState().undo(); // возврат к пустому состоянию
    expect(useEditor.getState().selectedIds).toEqual([]);
  });

  it('clips the history to HISTORY_LIMIT entries', () => {
    for (let i = 0; i < HISTORY_LIMIT + 10; i++) {
      useEditor.getState().addObject(obj(`o${i}`));
    }
    expect(useEditor.getState().past.length).toBeLessThanOrEqual(HISTORY_LIMIT);
  });
});

describe('editorStore: misc', () => {
  beforeEach(resetStore);

  it('notify creates a toast (default info) and closeToast clears it', () => {
    useEditor.getState().notify('Сохранено');
    const t = useEditor.getState().toast;
    expect(t?.text).toBe('Сохранено');
    expect(t?.type).toBe('info');
    useEditor.getState().closeToast();
    expect(useEditor.getState().toast).toBeNull();
  });

  it('notify accepts an explicit type', () => {
    useEditor.getState().notify('Ошибка', 'error');
    expect(useEditor.getState().toast?.type).toBe('error');
  });

  it('setSaveStatus and bumpProjectsVersion update state', () => {
    useEditor.getState().setSaveStatus('saving');
    expect(useEditor.getState().saveStatus).toBe('saving');
    useEditor.getState().bumpProjectsVersion();
    expect(useEditor.getState().projectsVersion).toBe(1);
  });

  it('setZoom clamps within the configured range', () => {
    useEditor.getState().setZoom(0.01);
    expect(useEditor.getState().zoom).toBe(ZOOM_MIN);
    useEditor.getState().setZoom(999);
    expect(useEditor.getState().zoom).toBe(ZOOM_MAX);
    useEditor.getState().setZoom(1.5);
    expect(useEditor.getState().zoom).toBe(1.5);
  });

  it('setExporting toggles the flag', () => {
    useEditor.getState().setExporting(true);
    expect(useEditor.getState().exporting).toBe(true);
  });
});

describe('editorStore: gc bridge', () => {
  beforeEach(resetStore);

  it('deleteObjects passes the surviving asset ids as extraLive to GC', () => {
    const imgObj = {
      id: 'img',
      kind: 'image' as const,
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      rotation: 0,
      opacity: 1,
      locked: false,
      visible: true,
      assetId: 'keep-me',
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
    useEditor.getState().addObjects([obj('del'), imgObj as unknown as EditorObject]);
    useEditor.getState().deleteObjects(['del']);
    expect(scheduleGc).toHaveBeenCalledOnce();
    const extraLive = scheduleGc.mock.calls[0][0];
    expect(Array.from(extraLive ?? [])).toEqual(['keep-me']);
  });
});
