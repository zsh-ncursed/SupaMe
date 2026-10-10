// Чистая геометрия: снапы перетаскивания и хвостики бабблов.
// Вынесена из CanvasStage/BubbleNode в отдельный модуль, чтобы её можно было
// покрыть юнит-тестами без Konva/DOM.

export type BubbleShape = 'rounded-rect' | 'ellipse' | 'cloud' | 'shout' | 'rect';

/** Линия под кратным 45° углом (для инструмента «Линия» при зажатом Shift) */
export function snapLineAngle(x0: number, y0: number, x1: number, y1: number): [number, number] {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
  const len = Math.hypot(dx, dy);
  return [x0 + Math.cos(ang) * len, y0 + Math.sin(ang) * len];
}

/**
 * Поиск ближайшей цели (край/центр холста), к которой притянуться одному из рёбер.
 * Возвращает дельту сдвига и позицию направляющей (или null, если ничего ближе порога).
 */
export function snapEdge(
  edges: number[],
  targets: number[],
  th: number
): { delta: number; guide: number } | null {
  let best: { delta: number; guide: number } | null = null;
  for (const o of edges) {
    for (const c of targets) {
      const d = c - o;
      if (Math.abs(d) <= th && (best === null || Math.abs(d) < Math.abs(best.delta))) {
        best = { delta: d, guide: c };
      }
    }
  }
  return best;
}

/**
 * Точка на границе фигуры баббла вдоль направления (dx, dy) — для хвостика.
 * rect/rounded-rect: пересечение лучом сторон; остальные — эллипс-приближение
 * (для cloud/shout это осознанное упрощение, хвостик рисуется от «впадины»).
 */
export function boundaryPoint(
  shape: BubbleShape,
  w: number,
  h: number,
  dx: number,
  dy: number
): { x: number; y: number } {
  const len = Math.hypot(dx, dy);
  if (len === 0) return { x: 0, y: 0 }; // нулевое направление — точка центра фигуры
  const ux = dx / len;
  const uy = dy / len;
  if (shape === 'rect' || shape === 'rounded-rect') {
    const sx = ux !== 0 ? w / 2 / Math.abs(ux) : Infinity;
    const sy = uy !== 0 ? h / 2 / Math.abs(uy) : Infinity;
    const s = Math.min(sx, sy);
    return { x: ux * s, y: uy * s };
  }
  const a = w / 2;
  const b = h / 2;
  const t = 1 / Math.sqrt((ux / a) ** 2 + (uy / b) ** 2);
  return { x: ux * t, y: uy * t };
}
