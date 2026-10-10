// Встроенные шаблоны мемов (ТЗ 5.8).
// Лицензионно чисто: только нейтральные программные заглушки, никаких чужих изображений.
import { addAsset, getAssetEntry } from '../db/assets';
import { useEditor } from '../store/editorStore';
import { uid } from './utils';
import { emit } from './bus';
import { CAPTION_FONT, BUBBLE_FONT } from './fonts';
import { DEFAULT_FILTERS } from './filters';
import type { BubbleObject, CanvasState, EditorObject, ImageObject, TextObject } from '../types';

/** Блок мини-превью в процентах от квадрата карточки */
export interface TemplateBlock {
  x: number; y: number; w: number; h: number; color: string;
}

export interface TemplateDef {
  id: string;
  name: string;
  hint: string;
  width: number;
  height: number;
  background: CanvasState['background'];
  /** Мини-превью раскладки (левая панель) */
  preview: TemplateBlock[];
  /** Нужна ли заглушка изображения (её id придёт первым аргументом build) */
  needsPhoto: boolean;
  /** Собрать объекты шаблона (photo — id заглушки или '') */
  build: (photo: string) => EditorObject[];
}

// ---------- фабрики объектов ----------

function tplImage(assetId: string, x: number, y: number, w: number, h: number): ImageObject {
  return {
    id: uid(),
    kind: 'image',
    assetId,
    x, y, width: w, height: h,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    flipX: false,
    flipY: false,
    crop: null,
    filters: { ...DEFAULT_FILTERS },
  };
}

type TextOpts = {
  x: number; y: number; text: string;
  fontSize?: number; color?: string; strokeColor?: string; strokeWidth?: number;
  boxWidth?: number; fontFamily?: string; stroke?: boolean;
};

function tplText(o: TextOpts): TextObject {
  const boxWidth = o.boxWidth ?? 1000;
  const fontSize = o.fontSize ?? 72;
  return {
    id: uid(),
    kind: 'text',
    text: o.text,
    x: o.x,
    y: o.y,
    width: boxWidth,
    height: Math.round(fontSize * 1.3),
    boxWidth,
    fontSize,
    fontFamily: o.fontFamily ?? CAPTION_FONT,
    fontWeight: 'bold',
    fontStyle: 'normal',
    color: o.color ?? '#FFFFFF',
    strokeColor: o.strokeColor ?? '#000000',
    strokeWidth: o.strokeWidth ?? 4,
    shadow: null,
    align: 'center',
    lineHeight: 1.15,
    letterSpacing: 0,
    textTransform: 'uppercase',
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    autoFit: false,
  };
}

type BubbleOpts = {
  x: number; y: number; w: number; h: number;
  value: string;
  fill?: string;
  strokeColor?: string;
  tail?: { tipX: number; tipY: number };
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  cornerRadius?: number;
};

function tplBubble(o: BubbleOpts): BubbleObject {
  return {
    id: uid(),
    kind: 'bubble',
    shape: 'rounded-rect',
    x: o.x,
    y: o.y,
    width: o.w,
    height: o.h,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    fill: o.fill ?? '#FFFFFF',
    strokeColor: o.strokeColor ?? '#000000',
    strokeWidth: o.strokeColor === null || o.strokeColor === 'none' ? 0 : 5,
    cornerRadius: o.cornerRadius ?? 24,
    padding: 18,
    tail: {
      enabled: !!o.tail,
      tipX: o.tail?.tipX ?? 0,
      tipY: o.tail?.tipY ?? 0,
      baseWidth: 30,
      curve: 0.25,
    },
    text: {
      value: o.value,
      fontFamily: o.fontFamily ?? BUBBLE_FONT,
      fontSize: o.fontSize ?? 44,
      bold: false,
      color: o.color ?? '#000000',
      align: 'center',
      autoFit: true,
    },
  };
}

// ---------- нейтральная заглушка изображения ----------

const PH_W = 800;
const PH_H = 600;
let placeholderId: string | null = null;

async function ensurePlaceholder(): Promise<string> {
  if (placeholderId) {
    const cached = await getAssetEntry(placeholderId).catch(() => null);
    if (cached) return placeholderId;
    placeholderId = null;
  }
  const cv = document.createElement('canvas');
  cv.width = PH_W;
  cv.height = PH_H;
  const ctx = cv.getContext('2d');
  if (!ctx) throw new Error('Нет 2D-контекста');
  // нейтральная серая заглушка со штриховкой и подписью
  ctx.fillStyle = '#2a2e36';
  ctx.fillRect(0, 0, PH_W, PH_H);
  ctx.strokeStyle = '#333845';
  ctx.lineWidth = 3;
  for (let x = -PH_H; x < PH_W; x += 28) {
    ctx.beginPath();
    ctx.moveTo(x, PH_H);
    ctx.lineTo(x + PH_H, 0);
    ctx.stroke();
  }
  ctx.strokeStyle = '#4a5264';
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, PH_W - 8, PH_H - 8);
  ctx.fillStyle = '#9aa3b2';
  ctx.font = '600 34px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Замените изображение', PH_W / 2, PH_H / 2);

  const blob = await new Promise<Blob | null>((resolve) => cv.toBlob((b) => resolve(b), 'image/png'));
  if (!blob) throw new Error('Не удалось создать заглушку');
  const id = await addAsset(blob, 'Заглушка шаблона', 'image/png');
  emit('assets-changed');
  placeholderId = id;
  return id;
}

// ---------- определения шаблонов ----------

const CAPTION_FS = 84; // размер подписей для холста 1080×1080

export const TEMPLATES: TemplateDef[] = [
  {
    id: 'classic',
    name: 'Классика',
    hint: 'Фото и подписи сверху/снизу',
    width: 1080,
    height: 1080,
    background: { type: 'color', color: '#FFFFFF', transparent: false },
    needsPhoto: true,
    preview: [
      { x: 10, y: 6, w: 80, h: 6, color: '#e8eaf0' },
      { x: 5, y: 33, w: 90, h: 60, color: '#3a4150' },
      { x: 10, y: 90, w: 80, h: 6, color: '#e8eaf0' },
    ],
    build: (photo) => [
      tplImage(photo, 540, 500, 1000, 640),
      tplText({ x: 540, y: 84, text: 'Верхняя подпись', fontSize: CAPTION_FS }),
      tplText({ x: 540, y: 986, text: 'Нижняя подпись', fontSize: CAPTION_FS }),
    ],
  },
  {
    id: 'bubble',
    name: 'Пузырь',
    hint: 'Фото с облачком реплики',
    width: 1080,
    height: 1080,
    background: { type: 'color', color: '#FFFFFF', transparent: false },
    needsPhoto: true,
    preview: [
      { x: 25, y: 6, w: 50, h: 26, color: '#e8eaf0' },
      { x: 8, y: 46, w: 84, h: 66, color: '#3a4150' },
    ],
    build: (photo) => [
      tplImage(photo, 540, 600, 940, 760),
      tplBubble({
        x: 540, y: 200, w: 640, h: 280,
        value: 'Ваша реплика',
        tail: { tipX: -180, tipY: 260 },
      }),
    ],
  },
  {
    id: 'dialog',
    name: 'Диалог',
    hint: 'Две реплики в бабблах',
    width: 1080,
    height: 1080,
    background: { type: 'color', color: '#FFFFFF', transparent: false },
    needsPhoto: true,
    preview: [
      { x: 7, y: 12, w: 86, h: 70, color: '#3a4150' },
      { x: 10, y: 20, w: 32, h: 14, color: '#e8eaf0' },
      { x: 58, y: 64, w: 32, h: 16, color: '#e8eaf0' },
    ],
    build: (photo) => [
      tplImage(photo, 540, 540, 1000, 800),
      tplBubble({
        x: 320, y: 230, w: 420, h: 190,
        value: 'Привет!',
        tail: { tipX: -260, tipY: 160 },
      }),
      tplBubble({
        x: 770, y: 860, w: 420, h: 200,
        value: 'И тебе привет!',
        tail: { tipX: 260, tipY: -150 },
      }),
    ],
  },
  {
    id: 'comic4',
    name: 'Комикс 2×2',
    hint: 'Четыре кадра с репликами',
    width: 1080,
    height: 1080,
    background: { type: 'color', color: '#FFFFFF', transparent: false },
    needsPhoto: true,
    preview: [
      { x: 4, y: 4, w: 45, h: 45, color: '#3a4150' },
      { x: 51, y: 4, w: 45, h: 45, color: '#3a4150' },
      { x: 4, y: 51, w: 45, h: 45, color: '#3a4150' },
      { x: 51, y: 51, w: 45, h: 45, color: '#3a4150' },
    ],
    build: (photo) => [
      tplImage(photo, 285, 275, 520, 500),
      tplImage(photo, 795, 275, 520, 500),
      tplImage(photo, 285, 805, 520, 500),
      tplImage(photo, 795, 805, 520, 500),
      tplBubble({ x: 285, y: 420, w: 460, h: 130, value: 'Кадр 1', fontSize: 30 }),
      tplBubble({ x: 795, y: 420, w: 460, h: 130, value: 'Кадр 2', fontSize: 30 }),
      tplBubble({ x: 285, y: 950, w: 460, h: 130, value: 'Кадр 3', fontSize: 30 }),
      tplBubble({ x: 795, y: 950, w: 460, h: 130, value: 'Кадр 4', fontSize: 30 }),
    ],
  },
  {
    id: 'choice',
    name: 'За и против',
    hint: 'Два ряда: отвергаем и одобряем',
    width: 1080,
    height: 1080,
    background: { type: 'color', color: '#FFFFFF', transparent: false },
    needsPhoto: true,
    preview: [
      { x: 4, y: 8, w: 40, h: 38, color: '#3a4150' },
      { x: 4, y: 54, w: 40, h: 38, color: '#3a4150' },
      { x: 48, y: 8, w: 48, h: 38, color: '#e53935' },
      { x: 48, y: 54, w: 48, h: 38, color: '#43a047' },
    ],
    build: (photo) => [
      tplImage(photo, 255, 290, 470, 520),
      tplImage(photo, 255, 790, 470, 520),
      tplBubble({
        x: 800, y: 290, w: 500, h: 520,
        value: '✕',
        fill: '#e53935',
        strokeColor: 'none',
        cornerRadius: 28,
        fontSize: 180,
        fontFamily: 'Inter',
        color: '#FFFFFF',
      }),
      tplBubble({
        x: 800, y: 790, w: 500, h: 520,
        value: '✓',
        fill: '#43a047',
        strokeColor: 'none',
        cornerRadius: 28,
        fontSize: 180,
        fontFamily: 'Inter',
        color: '#FFFFFF',
      }),
    ],
  },
];

// ---------- применение шаблона ----------

/** Создать новый проект из шаблона: холст + фон + объекты-заготовки */
export async function applyTemplate(t: TemplateDef): Promise<void> {
  const st = useEditor.getState();
  let photo = '';
  if (t.needsPhoto) {
    try {
      photo = await ensurePlaceholder();
    } catch (err) {
      console.error(err);
      st.notify('Не удалось создать заглушку изображения', 'error');
      return;
    }
  }
  st.newProject({ width: t.width, height: t.height, background: { ...t.background } });
  st.setProjectName(`Шаблон: ${t.name}`);
  const objects = t.build(photo);
  if (objects.length) useEditor.getState().addObjects(objects);
  useEditor.getState().clearSelection();
}
