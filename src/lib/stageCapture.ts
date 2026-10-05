// Рендер канваса в изображение: клонирование нод в offscreen Stage
import Konva from 'konva';
import type { CanvasState, EditorObject } from '../types';
import { useEditor } from '../store/editorStore';
import { getNode } from '../components/objects/registry';
import { getAssetEntry } from '../db/assets';

export interface ExportOptions {
  format: 'png' | 'jpeg' | 'webp';
  scale: number; // 1, 2, кастомный
  quality: number; // 0..1 для jpeg/webp
  transparent: boolean;
}

const MIME: Record<ExportOptions['format'], string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

function nextFrames(n: number): Promise<void> {
  return new Promise((resolve) => {
    let left = n;
    const step = () => {
      left -= 1;
      if (left <= 0) resolve();
      else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

async function renderOffscreen(
  canvas: CanvasState,
  objects: EditorObject[],
  opts: ExportOptions
): Promise<string> {
  const off = document.createElement('div');
  off.style.position = 'fixed';
  off.style.left = '-10000px';
  off.style.top = '0';
  document.body.appendChild(off);

  const stage = new Konva.Stage({ container: off, width: canvas.width, height: canvas.height });
  const layer = new Konva.Layer();
  stage.add(layer);

  // Фон
  if (!opts.transparent) {
    layer.add(
      new Konva.Rect({
        x: 0,
        y: 0,
        width: canvas.width,
        height: canvas.height,
        fill: canvas.background.color,
        listening: false,
      })
    );
  }
  if (canvas.background.type === 'image' && canvas.background.assetId) {
    const entry = await getAssetEntry(canvas.background.assetId);
    if (entry) {
      layer.add(
        new Konva.Image({
          x: 0,
          y: 0,
          width: canvas.width,
          height: canvas.height,
          image: entry.el,
          listening: false,
        })
      );
    }
  }

  // Объекты: клонируем текущие ноды (с измеренными текстами и хвостиками)
  for (const obj of objects) {
    if (!obj.visible) continue;
    const node = getNode(obj.id);
    if (!node) continue;
    const clone = node.clone({ draggable: false, listening: false });
    layer.add(clone);
  }
  layer.draw();

  const dataUrl = stage.toDataURL({
    x: 0,
    y: 0,
    width: canvas.width,
    height: canvas.height,
    pixelRatio: opts.scale,
    mimeType: MIME[opts.format],
    quality: opts.format === 'png' ? 1 : opts.quality,
  });
  stage.destroy();
  off.remove();
  return dataUrl;
}

/** Экспорт основного канваса: скрывает хелперы, рендерит, восстанавливает */
export async function exportCanvas(opts: ExportOptions): Promise<string | null> {
  const st = useEditor.getState();
  st.setExporting(true);
  await nextFrames(3);
  try {
    return await renderOffscreen(st.canvas, st.objects, opts);
  } finally {
    st.setExporting(false);
  }
}

/** Миниатюра проекта (ширина ~480px) */
export async function renderThumbnail(): Promise<string | null> {
  const st = useEditor.getState();
  if (!st.objects.length) return null;
  st.setExporting(true);
  await nextFrames(3);
  try {
    const scale = Math.min(1, 480 / st.canvas.width);
    return await renderOffscreen(
      st.canvas,
      st.objects,
      { format: 'png', scale, quality: 1, transparent: st.canvas.background.transparent }
    );
  } finally {
    st.setExporting(false);
  }
}
