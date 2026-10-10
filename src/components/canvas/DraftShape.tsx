// Черновик рисуемого объекта (Paint): состояние + предпросмотр + сборка в ShapeObject.
import { Ellipse, Line, Rect } from 'react-konva';
import { uid } from '../../lib/utils';
import { useUi } from '../../store/uiStore';
import type { ShapeObject, ShapeVariant } from '../../types';

export interface DraftState {
  shape: ShapeVariant;
  /** Точки пути в координатах холста [x0,y0,x1,y1,…] */
  points: number[];
}

/**
 * Превратить черновик в ShapeObject: bbox → центр, точки — относительно центра.
 * Возвращает null, если объект слишком мал, чтобы его создавать.
 */
export function draftToShapeObject(d: DraftState): ShapeObject | null {
  const ui = useUi.getState();
  const pts = d.points;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (let i = 0; i < pts.length; i += 2) {
    minX = Math.min(minX, pts[i]);
    maxX = Math.max(maxX, pts[i]);
    minY = Math.min(minY, pts[i + 1]);
    maxY = Math.max(maxY, pts[i + 1]);
  }
  const w = maxX - minX;
  const h = maxY - minY;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const filledShape = d.shape === 'rect' || d.shape === 'ellipse' || d.shape === 'triangle';

  if (filledShape && (w < 3 || h < 3)) return null;
  if (d.shape === 'line' && Math.hypot(w, h) < 3) return null;

  let relPoints: number[] = [];
  if (d.shape === 'triangle') {
    relPoints = [-w / 2, h / 2, 0, -h / 2, w / 2, h / 2];
  } else if (pts.length >= 4) {
    for (let i = 0; i < pts.length; i += 2) {
      relPoints.push(Math.round(pts[i] - cx), Math.round(pts[i + 1] - cy));
    }
  }

  return {
    id: uid(),
    kind: 'shape',
    shape: d.shape,
    x: Math.round(cx),
    y: Math.round(cy),
    width: Math.max(2, Math.round(w)),
    height: Math.max(2, Math.round(h)),
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    fill: filledShape ? ui.fillColor : null,
    strokeColor: ui.strokeColor,
    strokeWidth: ui.strokeWidth,
    cornerRadius: 0,
    points: relPoints,
    tension: d.shape === 'pen' ? 0.5 : 0,
  };
}

/** Предпросмотр черновика поверх холста (в координатах холста) */
export function DraftShape({
  draft,
  stroke,
  fill,
  strokeWidth,
}: {
  draft: DraftState;
  stroke: string;
  fill: string;
  strokeWidth: number;
}) {
  const pts = draft.points;
  if (draft.shape === 'rect') {
    const w = Math.abs(pts[2] - pts[0]);
    const h = Math.abs(pts[3] - pts[1]);
    return (
      <Rect
        x={(pts[0] + pts[2]) / 2}
        y={(pts[1] + pts[3]) / 2}
        offsetX={w / 2}
        offsetY={h / 2}
        width={w}
        height={h}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        listening={false}
      />
    );
  }
  if (draft.shape === 'ellipse') {
    return (
      <Ellipse
        x={(pts[0] + pts[2]) / 2}
        y={(pts[1] + pts[3]) / 2}
        radiusX={Math.abs(pts[2] - pts[0]) / 2}
        radiusY={Math.abs(pts[3] - pts[1]) / 2}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        listening={false}
      />
    );
  }
  if (draft.shape === 'triangle') {
    const w = Math.abs(pts[2] - pts[0]);
    const h = Math.abs(pts[3] - pts[1]);
    return (
      <Line
        x={(pts[0] + pts[2]) / 2}
        y={(pts[1] + pts[3]) / 2}
        points={[-w / 2, h / 2, 0, -h / 2, w / 2, h / 2]}
        closed
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        listening={false}
      />
    );
  }
  return (
    <Line
      points={pts}
      stroke={stroke}
      strokeWidth={strokeWidth}
      tension={draft.shape === 'pen' ? 0.5 : 0}
      lineCap="round"
      lineJoin="round"
      listening={false}
    />
  );
}
