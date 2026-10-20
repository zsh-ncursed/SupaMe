import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyTemplate, TEMPLATES } from './templates';
import { useEditor } from '../store/editorStore';
import { clearAssetCache, peekAsset } from '../db/assets';
import type { ImageObject } from '../types';

/**
 * jsdom не декодирует изображения и не умеет в canvas.toBlob — подменяем оба.
 * Иначе заглушка шаблона не создаётся и сценарий не проверяется.
 */
class FakeImage {
  onload: (() => void) | null = null;
  onerror: ((e?: unknown) => void) | null = null;
  naturalWidth = 800;
  naturalHeight = 600;
  private _src = '';
  get src() {
    return this._src;
  }
  set src(v: string) {
    this._src = v;
    queueMicrotask(() => {
      if (v && v.startsWith('blob:')) this.onload?.();
      else this.onerror?.(new Error(`load failed: ${v}`));
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
  // canvas.toBlob недоступен в jsdom — отдаём фиксированный PNG-подобный blob
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb) => {
    cb(new Blob(['png'], { type: 'image/png' }));
  });
  // jsdom не реализует 2D-контекст — нужен no-op ctx с нужными методами
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
    const noop = () => undefined;
    return {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      font: '',
      textAlign: '',
      textBaseline: '',
      fillRect: noop,
      strokeRect: noop,
      beginPath: noop,
      moveTo: noop,
      lineTo: noop,
      stroke: noop,
      fillText: noop,
    } as unknown as CanvasRenderingContext2D;
  });
  clearAssetCache();
  useEditor.getState().newProject();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('applyTemplate', () => {
  it('creates a project with the template canvas, background and name', async () => {
    const t = TEMPLATES.find((x) => x.id === 'classic')!;
    await applyTemplate(t);
    const st = useEditor.getState();
    expect(st.canvas.width).toBe(t.width);
    expect(st.canvas.height).toBe(t.height);
    expect(st.projectName).toBe(`Шаблон: ${t.name}`);
    expect(st.objects.length).toBeGreaterThan(0);
  });

  it('keeps the placeholder asset alive in the cache after the project is created', async () => {
    // Регрессия: newProject() чистит кэш ассетов. Если заглушка создаётся ДО него,
    // её objectURL отзывается, Konva получает image={undefined} и область шаблона
    // рендерится пустой (кликнуть по ней нельзя).
    const t = TEMPLATES.find((x) => x.needsPhoto)!;
    await applyTemplate(t);

    const img = useEditor.getState().objects.find((o) => o.kind === 'image') as ImageObject;
    expect(img).toBeDefined();
    expect(img.placeholder).toBe(true);

    // ассет заглушки обязан остаться в кэше с живым objectURL
    const entry = peekAsset(img.assetId);
    expect(entry).toBeDefined();
    expect(entry?.el).toBeDefined();
  });

  it('marks built image objects as placeholders and links them to the placeholder asset', async () => {
    const t = TEMPLATES.find((x) => x.needsPhoto)!;
    await applyTemplate(t);
    const images = useEditor.getState().objects.filter((o) => o.kind === 'image') as ImageObject[];
    expect(images.length).toBeGreaterThan(0);
    for (const img of images) {
      expect(img.placeholder).toBe(true);
      expect(peekAsset(img.assetId)).toBeDefined();
    }
  });

  it('applies every built-in template without errors', async () => {
    for (const t of TEMPLATES) {
      await applyTemplate(t);
      const st = useEditor.getState();
      expect(st.canvas.width).toBe(t.width);
      expect(st.objects.length).toBeGreaterThan(0);
    }
  });
});
