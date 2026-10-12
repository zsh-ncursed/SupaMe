import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { replacePlaceholderImage } from './addObjects';
import { useEditor } from '../store/editorStore';
import { clearAssetCache } from '../db/assets';
import type { ImageObject } from '../types';

// addObjects импортирует scheduleCollectGarbage (../db/gc) и emit (./bus) —
// подменяем, чтобы тестировать замену изолированно.
vi.mock('../db/gc', () => ({ scheduleCollectGarbage: vi.fn() }));
vi.mock('./bus', () => ({ emit: vi.fn() }));

class FakeImage {
  onload: (() => void) | null = null;
  onerror: ((e?: unknown) => void) | null = null;
  naturalWidth = 640;
  naturalHeight = 480;
  private _src = '';
  get src() {
    return this._src;
  }
  set src(v: string) {
    this._src = v;
    queueMicrotask(() => {
      if (v && v.startsWith('blob:')) this.onload?.();
      else this.onerror?.(new Error('load failed'));
    });
  }
}

beforeEach(() => {
  vi.stubGlobal('Image', FakeImage);
  const urlNs = URL as unknown as {
    createObjectURL?: (blob: Blob) => string;
    revokeObjectURL?: (url: string) => void;
  };
  urlNs.createObjectURL ??= () => 'blob:mock-url';
  urlNs.revokeObjectURL ??= () => undefined;
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => 'blob:mock-url');
  clearAssetCache();
  resetStore();
});

afterEach(() => vi.unstubAllGlobals());

function resetStore() {
  useEditor.setState({
    projectId: 'p1',
    projectName: 'Тест',
    createdAt: 0,
    updatedAt: 0,
    saveStatus: 'dirty',
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
}

function placeholderObj(id: string): ImageObject {
  return {
    id,
    kind: 'image',
    assetId: 'ph-asset',
    x: 540,
    y: 500,
    width: 500,
    height: 500,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
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
    placeholder: true,
  };
}

describe('replacePlaceholderImage', () => {
  it('replaces the placeholder asset with a cover-cropped image and clears the flag', async () => {
    useEditor.getState().addObject(placeholderObj('o1'));
    const file = new File(['x'], 'photo.png', { type: 'image/png' });
    const pastLen = useEditor.getState().past.length;

    const ok = await replacePlaceholderImage('o1', file);
    expect(ok).toBe(true);

    const s = useEditor.getState();
    const obj = s.objects[0];
    expect(obj.kind).toBe('image');
    const img = obj as ImageObject;
    expect(img.placeholder).toBe(false);
    expect(img.assetId).not.toBe('ph-asset'); // поменялся на новый
    // 640×480 → квадратная рамка 500×500 → обрезка центральных 480×480 с x=80
    expect(img.crop).toEqual({ x: 80, y: 0, width: 480, height: 480 });
    expect(s.past.length).toBe(pastLen + 1); // запись в историю
    // позиция/размер сохранились
    expect(img.x).toBe(540);
    expect(img.width).toBe(500);
  });

  it('is a no-op for a missing object id', async () => {
    const before = useEditor.getState().objects.length;
    const ok = await replacePlaceholderImage(
      'nope',
      new File(['x'], 'a.png', { type: 'image/png' })
    );
    expect(ok).toBe(false);
    expect(useEditor.getState().objects).toHaveLength(before);
  });

  it('is a no-op for a non-image object', async () => {
    const shape = {
      id: 's1',
      kind: 'shape' as const,
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      rotation: 0,
      opacity: 1,
      locked: false,
      visible: true,
      shape: 'rect' as const,
      fill: null,
      strokeColor: '#000',
      strokeWidth: 1,
      cornerRadius: 0,
      points: [],
      tension: 0,
    };
    useEditor.getState().addObject(shape);
    const ok = await replacePlaceholderImage('s1', new File(['x'], 'a.png', { type: 'image/png' }));
    expect(ok).toBe(false);
    expect(useEditor.getState().objects[0].kind).toBe('shape');
  });

  it('rejects non-image files with a notification and does not change the object', async () => {
    useEditor.getState().addObject(placeholderObj('o1'));
    const ok = await replacePlaceholderImage(
      'o1',
      new File(['x'], 'notes.txt', { type: 'text/plain' })
    );
    expect(ok).toBe(false);
    const obj = useEditor.getState().objects[0];
    expect(obj.kind).toBe('image');
    const img = obj as ImageObject;
    expect(img.placeholder).toBe(true);
    expect(img.assetId).toBe('ph-asset');
    expect(useEditor.getState().toast?.type).toBe('error');
  });
});
