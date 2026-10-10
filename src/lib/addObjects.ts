// Фабрики объектов: изображения из файлов, текст, подписи, бабблы
import { useEditor } from '../store/editorStore';
import { addAsset, getAssetEntry } from '../db/assets';
import { uid } from './utils';
import { emit } from './bus';
import { CAPTION_FONT, BUBBLE_FONT, DEFAULT_FONT } from './fonts';
import { DEFAULT_FILTERS } from './filters';
import type { BubbleShape, ImageObject, TextObject, BubbleObject, EditorObject } from '../types';

/** Добавить на холст объект существующего ассета (из панели «Картинки») */
export async function addAssetObject(assetId: string): Promise<void> {
  const entry = (await getAssetEntry(assetId)) ?? null;
  let w = entry?.width ?? 512;
  let h = entry?.height ?? 512;
  if (!w || !h) {
    w = 512;
    h = 512;
  }
  const st = useEditor.getState();
  const maxW = st.canvas.width * 0.7;
  const maxH = st.canvas.height * 0.7;
  const k = Math.min(1, maxW / w, maxH / h);
  const idx = st.objects.length;
  const obj: ImageObject = {
    id: uid(),
    kind: 'image',
    assetId,
    x: Math.round(st.canvas.width / 2 + idx * 24),
    y: Math.round(st.canvas.height / 2 + idx * 24),
    width: Math.round(w * k),
    height: Math.round(h * k),
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    flipX: false,
    flipY: false,
    crop: null,
    filters: { ...DEFAULT_FILTERS },
  };
  useEditor.getState().addObject(obj);
}

export async function addImageFiles(files: File[]): Promise<void> {
  const created: EditorObject[] = [];
  for (const file of files) {
    try {
      const assetId = await addAsset(file, file.name, file.type);
      emit('assets-changed');
      const entry = (await import('../db/assets')).peekAsset(assetId);
      let w = entry?.width ?? 512;
      let h = entry?.height ?? 512;
      if (!w || !h) {
        w = 512;
        h = 512;
      }
      // вписать в 70% холста с сохранением пропорций
      const st = useEditor.getState();
      const maxW = st.canvas.width * 0.7;
      const maxH = st.canvas.height * 0.7;
      const k = Math.min(1, maxW / w, maxH / h);
      const idx = created.length;
      const obj: ImageObject = {
        id: uid(),
        kind: 'image',
        assetId,
        x: Math.round(st.canvas.width / 2 + idx * 24),
        y: Math.round(st.canvas.height / 2 + idx * 24),
        width: Math.round(w * k),
        height: Math.round(h * k),
        rotation: 0,
        opacity: 1,
        locked: false,
        visible: true,
        flipX: false,
        flipY: false,
        crop: null,
        filters: { ...DEFAULT_FILTERS },
      };
      created.push(obj);
    } catch (err) {
      useEditor.getState().notify(`Не удалось загрузить ${file.name}`, 'error');
      console.error(err);
    }
  }
  if (created.length) useEditor.getState().addObjects(created);
}

function baseText(): TextObject {
  const st = useEditor.getState();
  return {
    id: uid(),
    kind: 'text',
    text: 'Текст',
    x: Math.round(st.canvas.width / 2),
    y: Math.round(st.canvas.height / 2),
    width: Math.round(st.canvas.width * 0.8),
    height: 90,
    boxWidth: Math.round(st.canvas.width * 0.8),
    fontSize: 64,
    fontFamily: DEFAULT_FONT,
    fontWeight: 'bold',
    fontStyle: 'normal',
    color: '#FFFFFF',
    strokeColor: '#000000',
    strokeWidth: 3,
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

export function addTextObject(): void {
  useEditor.getState().addObject(baseText());
}

/** Быстрая подпись сверху / снизу (по ТЗ 5.6.8) */
export function addCaption(position: 'top' | 'bottom'): void {
  const st = useEditor.getState();
  const t = baseText();
  t.text = position === 'top' ? 'ВЕРХНЯЯ ПОДПИСЬ' : 'НИЖНЯЯ ПОДПИСЬ';
  t.fontFamily = CAPTION_FONT;
  t.fontWeight = 'bold';
  t.color = '#FFFFFF';
  t.strokeColor = '#000000';
  t.strokeWidth = 4;
  t.boxWidth = Math.round(st.canvas.width * 0.92);
  t.width = t.boxWidth;
  t.x = Math.round(st.canvas.width / 2);
  t.y = Math.round(st.canvas.height * (position === 'top' ? 0.14 : 0.86));
  t.align = 'center';
  t.textTransform = 'uppercase';
  t.fontSize = Math.max(32, Math.round(st.canvas.width / 14));
  t.height = Math.round(t.fontSize * 1.2);
  useEditor.getState().addObject(t);
}

const BUBBLE_PRESETS: Record<BubbleShape, { label: string; fill: string; stroke: string }> = {
  'rounded-rect': { label: 'Пузырь', fill: '#FFFFFF', stroke: '#000000' },
  ellipse: { label: 'Овал', fill: '#FFFFFF', stroke: '#000000' },
  cloud: { label: 'Облачко', fill: '#FFFFFF', stroke: '#000000' },
  shout: { label: 'Крик', fill: '#FFF176', stroke: '#000000' },
  rect: { label: 'Прозрачный', fill: 'rgba(0,0,0,0)', stroke: '#000000' },
};

export function bubblePresetLabel(shape: BubbleShape): string {
  return BUBBLE_PRESETS[shape].label;
}

export function addBubbleObject(shape: BubbleShape): void {
  const st = useEditor.getState();
  const w = shape === 'cloud' || shape === 'shout' ? 360 : 320;
  const h = shape === 'shout' ? 220 : 180;
  const preset = BUBBLE_PRESETS[shape];
  const obj: BubbleObject = {
    id: uid(),
    kind: 'bubble',
    shape,
    x: Math.round(st.canvas.width / 2),
    y: Math.round(st.canvas.height * 0.35),
    width: w,
    height: h,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    fill: preset.fill,
    strokeColor: preset.stroke,
    strokeWidth: 4,
    cornerRadius: 16,
    padding: 18,
    tail: {
      enabled: true,
      tipX: -Math.round(w / 2) - 40,
      tipY: Math.round(h / 2) + 46,
      baseWidth: 26,
      curve: 0.25,
    },
    text: {
      value: 'Реплика',
      fontFamily: BUBBLE_FONT,
      fontSize: 28,
      bold: false,
      color: '#000000',
      align: 'center',
      autoFit: true,
    },
  };
  useEditor.getState().addObject(obj);
}
