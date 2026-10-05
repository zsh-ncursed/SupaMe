// Центральный стор редактора (zustand) с историей undo/redo
import { create } from 'zustand';
import type { CanvasState, EditorObject, ProjectRecord } from '../types';
import { HISTORY_LIMIT, MIN_CANVAS, MAX_CANVAS } from '../types';
import { uid, clamp } from '../lib/utils';

export type SaveStatus = 'saved' | 'dirty' | 'saving';
export type AlignMode =
  | 'left' | 'hcenter' | 'right'
  | 'top' | 'vcenter' | 'bottom';

export interface Toast {
  id: string;
  text: string;
  type: 'info' | 'error' | 'success';
}

interface EditorState {
  // Проект
  projectId: string | null;
  projectName: string;
  createdAt: number;
  updatedAt: number;
  saveStatus: SaveStatus;
  // Контент
  canvas: CanvasState;
  objects: EditorObject[];
  // Взаимодействие
  selectedIds: string[];
  zoom: number;
  exporting: boolean;
  // История
  past: string[];
  future: string[];
  transientSnapshot: string | null;
  // Уведомления
  toast: Toast | null;
  // Внутренний буфер обмена (копирование объектов)
  clipboard: EditorObject[];
  // Счётчик версий списка проектов (для обновления диалога)
  projectsVersion: number;

  // --- actions ---
  newProject: (canvas?: Partial<CanvasState>) => void;
  loadProjectRecord: (rec: ProjectRecord) => void;
  setProjectName: (name: string) => void;

  setCanvasSize: (width: number, height: number) => void;
  setBackground: (patch: Partial<CanvasState['background']>) => void;

  setZoom: (zoom: number) => void;
  setExporting: (v: boolean) => void;

  addObject: (obj: EditorObject) => void;
  addObjects: (objs: EditorObject[]) => void;
  updateObject: (id: string, patch: Partial<EditorObject>, opts?: { history?: boolean }) => void;
  updateObjects: (ids: string[], patch: Partial<EditorObject>, opts?: { history?: boolean }) => void;
  replaceObject: (next: EditorObject, opts?: { history?: boolean }) => void;
  deleteObjects: (ids: string[]) => void;
  duplicateObjects: (ids: string[]) => void;
  copySelected: () => void;
  pasteClipboard: () => void;

  beginTransient: () => void;
  endTransient: () => void;

  select: (ids: string[], additive?: boolean) => void;
  toggleSelect: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;

  moveLayer: (ids: string[], dir: 'up' | 'down' | 'front' | 'back') => void;
  alignSelected: (mode: AlignMode) => void;
  distributeSelected: (axis: 'h' | 'v') => void;

  undo: () => void;
  redo: () => void;

  setSaveStatus: (s: SaveStatus) => void;
  bumpProjectsVersion: () => void;
  notify: (text: string, type?: 'info' | 'error' | 'success') => void;
  closeToast: () => void;
}

function snap(canvas: CanvasState, objects: EditorObject[]): string {
  return JSON.stringify({ canvas, objects });
}

/** Подготовить запись в историю: снапшот текущего состояния в past, сброс future */
function withHistory(
  s: EditorState,
  next: Partial<EditorState>
): Partial<EditorState> {
  const cur = snap(s.canvas, s.objects);
  return {
    past: [...s.past, cur].slice(-HISTORY_LIMIT),
    future: [],
    ...next,
  };
}

export const useEditor = create<EditorState>()((set, get) => ({
  projectId: null,
  projectName: 'Без названия',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  saveStatus: 'saved',
  canvas: {
    width: 1080,
    height: 1080,
    background: { type: 'color', color: '#FFFFFF', transparent: false },
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

  newProject: (canvas) =>
    set(() => ({
      projectId: uid(),
      projectName: 'Новый проект',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      saveStatus: 'dirty',
      canvas: {
        width: canvas?.width ?? 1080,
        height: canvas?.height ?? 1080,
        background: canvas?.background ?? {
          type: 'color',
          color: '#FFFFFF',
          transparent: false,
        },
      },
      objects: [],
      selectedIds: [],
      past: [],
      future: [],
      transientSnapshot: null,
    })),

  loadProjectRecord: (rec) =>
    set({
      projectId: rec.id,
      projectName: rec.name,
      createdAt: rec.createdAt,
      updatedAt: rec.updatedAt,
      canvas: JSON.parse(JSON.stringify(rec.data.canvas)) as CanvasState,
      objects: JSON.parse(JSON.stringify(rec.data.objects)) as EditorObject[],
      selectedIds: [],
      past: [],
      future: [],
      transientSnapshot: null,
      saveStatus: 'saved',
    }),

  setProjectName: (name) =>
    set({ projectName: name, saveStatus: 'dirty' }),

  setCanvasSize: (width, height) => {
    const w = clamp(Math.round(width), MIN_CANVAS, MAX_CANVAS);
    const h = clamp(Math.round(height), MIN_CANVAS, MAX_CANVAS);
    set((s) =>
      withHistory(s, {
        canvas: { ...s.canvas, width: w, height: h },
        saveStatus: 'dirty',
      })
    );
  },

  setBackground: (patch) =>
    set((s) =>
      withHistory(s, {
        canvas: { ...s.canvas, background: { ...s.canvas.background, ...patch } },
        saveStatus: 'dirty',
      })
    ),

  setZoom: (zoom) => set({ zoom: clamp(zoom, 0.25, 4) }),
  setExporting: (exporting) => set({ exporting }),

  addObject: (obj) =>
    set((s) =>
      withHistory(s, {
        objects: [...s.objects, obj],
        selectedIds: [obj.id],
        saveStatus: 'dirty',
      })
    ),

  addObjects: (objs) =>
    set((s) =>
      withHistory(s, {
        objects: [...s.objects, ...objs],
        selectedIds: objs.map((o) => o.id),
        saveStatus: 'dirty',
      })
    ),

  updateObject: (id, patch, opts) =>
    set((s) => ({
      ...(opts?.history === false ? {} : withHistory(s, {})),
      saveStatus: 'dirty' as SaveStatus,
      objects: s.objects.map((o) =>
        o.id === id ? ({ ...o, ...patch } as EditorObject) : o
      ),
    })),

  updateObjects: (ids, patch, opts) =>
    set((s) => ({
      ...(opts?.history === false ? {} : withHistory(s, {})),
      saveStatus: 'dirty' as SaveStatus,
      objects: s.objects.map((o) =>
        ids.includes(o.id) ? ({ ...o, ...patch } as EditorObject) : o
      ),
    })),

  replaceObject: (next, opts) =>
    set((s) => ({
      ...(opts?.history === false ? {} : withHistory(s, {})),
      saveStatus: 'dirty' as SaveStatus,
      objects: s.objects.map((o) => (o.id === next.id ? next : o)),
    })),

  deleteObjects: (ids) => {
    if (!ids.length) return;
    set((s) =>
      withHistory(s, {
        objects: s.objects.filter((o) => !ids.includes(o.id)),
        selectedIds: s.selectedIds.filter((id) => !ids.includes(id)),
        saveStatus: 'dirty',
      })
    );
  },

  duplicateObjects: (ids) => {
    const s = get();
    const clones: EditorObject[] = [];
    for (const o of s.objects) {
      if (!ids.includes(o.id)) continue;
      const copy = JSON.parse(JSON.stringify(o)) as EditorObject;
      copy.id = uid();
      copy.x += 24;
      copy.y += 24;
      copy.locked = false;
      clones.push(copy);
    }
    if (!clones.length) return;
    set((st) =>
      withHistory(st, {
        objects: [...s.objects, ...clones],
        selectedIds: clones.map((c) => c.id),
        saveStatus: 'dirty',
      })
    );
  },

  copySelected: () => {
    const s = get();
    const copies = s.objects
      .filter((o) => s.selectedIds.includes(o.id))
      .map((o) => JSON.parse(JSON.stringify(o)) as EditorObject);
    if (copies.length) set({ clipboard: copies });
  },

  pasteClipboard: () => {
    const s = get();
    if (!s.clipboard.length) return;
    const clones = s.clipboard.map((o) => {
      const copy = JSON.parse(JSON.stringify(o)) as EditorObject;
      copy.id = uid();
      copy.x += 24;
      copy.y += 24;
      copy.locked = false;
      return copy;
    });
    set(
      withHistory(s, {
        objects: [...s.objects, ...clones],
        selectedIds: clones.map((c) => c.id),
        saveStatus: 'dirty',
      })
    );
  },

  beginTransient: () => {
    const s = get();
    set({ transientSnapshot: snap(s.canvas, s.objects) });
  },

  endTransient: () => {
    const s = get();
    const before = s.transientSnapshot;
    set({ transientSnapshot: null });
    if (!before) return;
    const after = snap(s.canvas, s.objects);
    if (before !== after) {
      set((st) => ({
        past: [...st.past, before].slice(-HISTORY_LIMIT),
        future: [],
      }));
    }
  },

  select: (ids, additive) =>
    set((s) => {
      if (!additive) return { selectedIds: ids };
      const setIds = new Set(s.selectedIds);
      for (const id of ids) {
        if (setIds.has(id)) setIds.delete(id);
        else setIds.add(id);
      }
      return { selectedIds: Array.from(setIds) };
    }),

  toggleSelect: (id) => {
    const s = get();
    if (s.selectedIds.includes(id)) {
      set({ selectedIds: s.selectedIds.filter((x) => x !== id) });
    } else {
      set({ selectedIds: [...s.selectedIds, id] });
    }
  },

  selectAll: () =>
    set((s) => ({ selectedIds: s.objects.filter((o) => !o.locked).map((o) => o.id) })),

  clearSelection: () => set({ selectedIds: [] }),

  moveLayer: (ids, dir) => {
    set((s) => {
      if (!ids.length) return {};
      let objects: EditorObject[];
      if (dir === 'front') {
        const picked = s.objects.filter((o) => ids.includes(o.id));
        const rest = objectsExcept(s.objects, ids);
        objects = [...rest, ...picked];
      } else if (dir === 'back') {
        const picked = s.objects.filter((o) => ids.includes(o.id));
        const rest = s.objects.filter((o) => !ids.includes(o.id));
        objects = [...picked, ...rest];
      } else {
        const arr = [...s.objects];
        const idxs = arr
          .map((o, i) => ({ o, i }))
          .filter(({ o }) => ids.includes(o.id))
          .map(({ i }) => i);
        const step = dir === 'up' ? 1 : -1;
        const order = dir === 'up' ? [...idxs].reverse() : idxs;
        for (const i of order) {
          const j = i + step;
          if (j < 0 || j >= arr.length) continue;
          const t = arr[i];
          arr[i] = arr[j];
          arr[j] = t;
        }
        return { objects: arr, ...withHistory(s, {}) };
      }
      return { objects, ...withHistory(s, {}) };
    });
  },

  alignSelected: (mode) => {
    const s = get();
    const selIds = new Set(s.selectedIds);
    const sel = s.objects.filter((o) => selIds.has(o.id) && !o.locked);
    if (!sel.length) return;
    const { width, height } = s.canvas;
    const objects = s.objects.map((o) => {
      if (!selIdsHas(sel, o.id)) return o;
      let { x, y } = o;
      switch (mode) {
        case 'left': x = o.width / 2; break;
        case 'hcenter': x = width / 2; break;
        case 'right': x = width - o.width / 2; break;
        case 'top': y = o.height / 2; break;
        case 'vcenter': y = height / 2; break;
        case 'bottom': y = height - o.height / 2; break;
      }
      return { ...o, x, y };
    });
    set(withHistory(s, { objects, saveStatus: 'dirty' }));
  },

  distributeSelected: (axis) => {
    const s = get();
    const sel = s.objects.filter((o) => s.selectedIds.includes(o.id) && !o.locked);
    if (sel.length < 3) return;
    const sorted = [...sel].sort((a, b) => (axis === 'h' ? a.x - b.x : a.y - b.y));
    const from = axis === 'h' ? sorted[0].x : sorted[0].y;
    const lastPos = axis === 'h' ? sorted[sorted.length - 1].x : sorted[sorted.length - 1].y;
    const gap = (lastPos - from) / (sorted.length - 1);
    const posById = new Map<string, number>();
    sorted.forEach((o, i) => posById.set(o.id, from + gap * i));
    const objects = s.objects.map((o) => {
      if (!posById.has(o.id)) return o;
      const pos = posById.get(o.id) as number;
      return axis === 'h' ? { ...o, x: pos } : { ...o, y: pos };
    });
    set(withHistory(s, { objects, saveStatus: 'dirty' }));
  },

  undo: () => {
    const s = get();
    if (!s.past.length) return;
    const prev = s.past[s.past.length - 1];
    const cur = snap(s.canvas, s.objects);
    const parsed = JSON.parse(prev) as { canvas: CanvasState; objects: EditorObject[] };
    set({
      past: s.past.slice(0, -1),
      future: [...s.future, cur].slice(-HISTORY_LIMIT),
      canvas: parsed.canvas,
      objects: parsed.objects,
      selectedIds: s.selectedIds.filter((id) => parsed.objects.some((o) => o.id === id)),
      saveStatus: 'dirty',
    });
  },

  redo: () => {
    const s = get();
    if (!s.future.length) return;
    const next = s.future[s.future.length - 1];
    const cur = snap(s.canvas, s.objects);
    const parsed = JSON.parse(next) as { canvas: CanvasState; objects: EditorObject[] };
    set({
      future: s.future.slice(0, -1),
      past: [...s.past, cur].slice(-HISTORY_LIMIT),
      canvas: parsed.canvas,
      objects: parsed.objects,
      selectedIds: s.selectedIds.filter((id) => parsed.objects.some((o) => o.id === id)),
      saveStatus: 'dirty',
    });
  },

  notify: (text, type = 'info') => {
    set({ toast: { id: uid(), text, type } });
  },
  closeToast: () => set({ toast: null }),

  setSaveStatus: (s) => set({ saveStatus: s }),
  bumpProjectsVersion: () => set((st) => ({ projectsVersion: st.projectsVersion + 1 })),
}));

function selIdsHas(list: { id: string }[], id: string): boolean {
  return list.some((o) => o.id === id);
}

function objectsExcept(list: EditorObject[], ids: string[]): EditorObject[] {
  const idSet = new Set(ids);
  return list.filter((o) => !idSet.has(o.id));
}

function selIds(list: { id: string }[]): string[] {
  return list.map((o) => o.id);
}
