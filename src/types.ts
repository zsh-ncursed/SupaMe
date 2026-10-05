// Модель данных проекта SupaMe (по разделу 9 ТЗ)
// Позиция объектов — центр (x, y), порядок слоёв = порядок в массиве objects (последний — верхний).

export type ObjectKind = 'image' | 'text' | 'bubble';

export interface CanvasBackground {
  /** 'color' — сплошной цвет, 'image' — изображение-фон */
  type: 'color' | 'image';
  color: string;
  transparent: boolean;
  assetId?: string;
}

export interface CanvasState {
  width: number;
  height: number;
  background: CanvasBackground;
}

export interface BaseObject {
  id: string;
  kind: ObjectKind;
  /** центр объекта */
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  /** 0..1 */
  opacity: number;
  locked: boolean;
  visible: boolean;
}

export interface ImageFilters {
  /** Яркость: 0..200, 100 = норма */
  brightness: number;
  /** Контраст: -100..100, 0 = норма */
  contrast: number;
  /** Насыщенность: 0..200, 100 = норма */
  saturation: number;
  /** Радиус размытия в px, 0 = без размытия */
  blur: number;
  /** Чёрно-белый фильтр */
  grayscale: boolean;
  /** Сепия */
  sepia: boolean;
}

export interface ImageObject extends BaseObject {
  kind: 'image';
  assetId: string;
  flipX: boolean;
  flipY: boolean;
  /** Область обрезки в координатах исходного изображения */
  crop: { x: number; y: number; width: number; height: number } | null;
  filters: ImageFilters;
}

export type TextAlign = 'left' | 'center' | 'right';
export type TextTransform = 'none' | 'uppercase' | 'lowercase';

export interface TextShadow {
  color: string;
  offsetX: number;
  offsetY: number;
  blur: number;
  opacity: number; // 0..1
}

export interface TextObject extends BaseObject {
  kind: 'text';
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  color: string;
  strokeColor: string;
  strokeWidth: number;
  shadow: TextShadow | null;
  align: TextAlign;
  lineHeight: number;
  letterSpacing: number;
  textTransform: TextTransform;
  /** ширина блока; высота вычисляется по содержимому */
  boxWidth: number;
  /** автоуменьшение шрифта при переполнении блока */
  autoFit: boolean;
}

export type BubbleShape =
  | 'rounded-rect'
  | 'ellipse'
  | 'cloud'
  | 'shout'
  | 'rect';

export interface BubbleTail {
  enabled: boolean;
  /** смещение кончика хвостика от центра баббла */
  tipX: number;
  tipY: number;
  /** ширина основания хвостика */
  baseWidth: number;
  /** кривизна 0..1 (0 — прямой треугольник) */
  curve: number;
}

export interface BubbleText {
  value: string;
  fontFamily: string;
  fontSize: number;
  bold: boolean;
  color: string;
  align: TextAlign;
  /** автоуменьшение шрифта при переполнении */
  autoFit: boolean;
}

export interface BubbleObject extends BaseObject {
  kind: 'bubble';
  shape: BubbleShape;
  fill: string;
  strokeColor: string;
  strokeWidth: number;
  cornerRadius: number;
  padding: number;
  tail: BubbleTail;
  text: BubbleText;
}

export type EditorObject = ImageObject | TextObject | BubbleObject;

export interface ProjectData {
  version: number;
  canvas: CanvasState;
  objects: EditorObject[];
}

export interface ProjectRecord {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  /** превью в dataURL (PNG/WebP) */
  thumbnail: string | null;
  data: ProjectData;
}

export interface AssetRecord {
  id: string;
  name: string;
  mime: string;
  blob: Blob;
  createdAt: number;
}

export interface ExportedProjectFile {
  version: number;
  app: 'SupaMe';
  name: string;
  data: ProjectData;
  assets: { id: string; name: string; mime: string; dataUrl: string }[];
}

export const CANVAS_PRESETS = [
  { label: 'Квадрат', width: 1080, height: 1080 },
  { label: 'Портрет', width: 1080, height: 1350 },
  { label: 'Сторис', width: 1080, height: 1920 },
  { label: 'Ландшафт', width: 1200, height: 630 },
] as const;

export const MIN_CANVAS = 100;
export const MAX_CANVAS = 4096;
export const MIN_FONT_SIZE = 8;
export const HISTORY_LIMIT = 100;
