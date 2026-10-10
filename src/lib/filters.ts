// Фильтры изображений (ТЗ 5.4.6): отображение модели на фильтры Konva
import Konva from 'konva';
import type { Filter } from 'konva/lib/Node';
import type { ImageFilters } from '../types';

export const DEFAULT_FILTERS: ImageFilters = {
  brightness: 100,
  contrast: 0,
  saturation: 100,
  blur: 0,
  grayscale: false,
  sepia: false,
};

/**
 * Старые проекты могли сохраниться в усечённой модели
 * { brightness, contrast, saturation } — приводим к текущей.
 */
export function normalizeFilters(raw: Partial<ImageFilters> | undefined): ImageFilters {
  if (!raw) return { ...DEFAULT_FILTERS };
  const legacy = raw.blur === undefined && raw.grayscale === undefined && raw.sepia === undefined;
  return {
    brightness: raw.brightness ?? DEFAULT_FILTERS.brightness,
    // в старой модели контраст 100 означал «норма»
    contrast:
      legacy && raw.contrast === 100
        ? DEFAULT_FILTERS.contrast
        : (raw.contrast ?? DEFAULT_FILTERS.contrast),
    saturation: raw.saturation ?? DEFAULT_FILTERS.saturation,
    blur: raw.blur ?? 0,
    grayscale: raw.grayscale ?? false,
    sepia: raw.sepia ?? false,
  };
}

/** Все фильтры в нейтральном положении? */
export function isFiltersDefault(f: ImageFilters): boolean {
  return (
    f.brightness === DEFAULT_FILTERS.brightness &&
    f.contrast === DEFAULT_FILTERS.contrast &&
    f.saturation === DEFAULT_FILTERS.saturation &&
    f.blur === 0 &&
    !f.grayscale &&
    !f.sepia
  );
}

/** Список фильтров Konva в порядке применения (важен порядок!) */
export function filterPipeline(f: ImageFilters): Filter[] {
  const list: Filter[] = [];
  if (f.grayscale) list.push(Konva.Filters.Grayscale);
  if (f.sepia) list.push(Konva.Filters.Sepia);
  if (f.brightness !== DEFAULT_FILTERS.brightness) list.push(Konva.Filters.Brighten);
  if (f.contrast !== DEFAULT_FILTERS.contrast) list.push(Konva.Filters.Contrast);
  if (f.saturation !== DEFAULT_FILTERS.saturation) list.push(Konva.Filters.HSL);
  if (f.blur > 0) list.push(Konva.Filters.Blur);
  return list;
}

/** Атрибуты ноды, которые читают фильтры Konva */
export function filterAttrs(f: ImageFilters): {
  brightness: number;
  contrast: number;
  saturation: number;
  blurRadius: number;
} {
  return {
    brightness: (f.brightness - 100) / 100, // Konva Brighten: -1..1, 0 = норма
    contrast: f.contrast, // Konva Contrast: -100..100, 0 = норма
    saturation: f.saturation / 100, // Konva HSL: 1 = норма
    blurRadius: f.blur, // Konva Blur: px
  };
}
