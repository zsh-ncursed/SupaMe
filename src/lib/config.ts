// Единый источник операционных констант приложения (код-ревью: без магических чисел).
// Модельные константы (пресеты холста, лимиты размеров) остаются в src/types.ts.

/** Порог привязки снапов в экранных пикселях */
export const SNAP_PX = 6;
/** Диапазон зума холста (25–400 %) */
export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 4;
/** Множитель зума за одно колесо / Ctrl+«-»+«+» */
export const ZOOM_STEP = 1.1;

/** Дебаунс автосохранения после изменения (мс) */
export const AUTOSAVE_DEBOUNCE_MS = 1200;
/** Серия правок слайдером/цветом = одна запись истории (мс) */
export const TRANSIENT_DEBOUNCE_MS = 700;
/** Время показа тост-уведомления (мс) */
export const TOAST_DURATION_MS = 3500;
/** Пауза перед закрытием transient-серии при перемещении стрелками (мс) */
export const ARROW_REPEAT_DEBOUNCE_MS = 500;
/** Дебаунс сборщика мусора ассетов (мс) */
export const GC_DEBOUNCE_MS = 1500;

/** Инструменты Paint: цвета и толщина по умолчанию, диапазон толщины */
export const DEFAULT_STROKE_COLOR = '#000000';
export const DEFAULT_FILL_COLOR = '#FFFFFF';
export const DEFAULT_STROKE_WIDTH = 6;
export const STROKE_WIDTH_MIN = 1;
export const STROKE_WIDTH_MAX = 40;
