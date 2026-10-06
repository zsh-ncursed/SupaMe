import { Ellipse, Line, Rect } from 'react-konva';
import type { ShapeObject } from '../../types';
import { registerNode } from './registry';
import type { TransformEndPayload } from './ImageNode';

interface NodeProps {
  obj: ShapeObject;
  draggable: boolean;
  onDragStart: (id: string) => void;
  onDragMove: (id: string, x: number, y: number) => void;
  onDragEnd: (id: string) => void;
  onSelect: (id: string, additive: boolean) => void;
  onTransformEnd: (id: string, payload: TransformEndPayload) => void;
  onContextMenu: (id: string, clientX: number, clientY: number) => void;
}

/** У фигур с точками масштабирование применяется к точкам, а не к width/height */
export function isPointsBasedShape(obj: ShapeObject): boolean {
  return obj.shape === 'line' || obj.shape === 'pencil' || obj.shape === 'pen' || obj.shape === 'triangle';
}

export function ShapeNode({ obj, draggable, onDragStart, onDragMove, onDragEnd, onSelect, onTransformEnd, onContextMenu }: NodeProps) {
  const handlers = {
    draggable: draggable && !obj.locked,
    onDragStart: () => onDragStart(obj.id),
    onDragMove: (e: { target: { x: () => number; y: () => number } }) => onDragMove(obj.id, e.target.x(), e.target.y()),
    onDragEnd: () => onDragEnd(obj.id),
    onMouseDown: (e: { evt: MouseEvent }) => onSelect(obj.id, e.evt.shiftKey),
    onContextMenu: (e: { evt: MouseEvent }) => {
      e.evt.preventDefault();
      onContextMenu(obj.id, e.evt.clientX, e.evt.clientY);
    },
    onTap: (e: { evt: unknown }) => onSelect(obj.id, Boolean((e.evt as unknown as { shiftKey?: boolean }).shiftKey)),
    onTransformEnd: (e: { target: { scaleX: () => number; scaleY: () => number; x: () => number; y: () => number; rotation: () => number } }) =>
      onTransformEnd(obj.id, {
        scaleX: e.target.scaleX(),
        scaleY: e.target.scaleY(),
        x: e.target.x(),
        y: e.target.y(),
        rotation: e.target.rotation(),
      }),
  };

  if (obj.shape === 'rect') {
    return (
      <Rect
        id={obj.id}
        ref={(node) => registerNode(obj.id, node)}
        x={obj.x}
        y={obj.y}
        offsetX={obj.width / 2}
        offsetY={obj.height / 2}
        width={obj.width}
        height={obj.height}
        cornerRadius={obj.cornerRadius}
        fill={obj.fill ?? undefined}
        stroke={obj.strokeWidth > 0 ? obj.strokeColor : undefined}
        strokeWidth={obj.strokeWidth}
        rotation={obj.rotation}
        opacity={obj.opacity}
        {...handlers}
      />
    );
  }

  if (obj.shape === 'ellipse') {
    return (
      <Ellipse
        id={obj.id}
        ref={(node) => registerNode(obj.id, node)}
        x={obj.x}
        y={obj.y}
        radiusX={obj.width / 2}
        radiusY={obj.height / 2}
        fill={obj.fill ?? undefined}
        stroke={obj.strokeWidth > 0 ? obj.strokeColor : undefined}
        strokeWidth={obj.strokeWidth}
        rotation={obj.rotation}
        opacity={obj.opacity}
        {...handlers}
      />
    );
  }

  // line / pencil / pen / triangle — путь из точек
  return (
    <Line
      id={obj.id}
      ref={(node) => registerNode(obj.id, node)}
      x={obj.x}
      y={obj.y}
      points={obj.points}
      closed={obj.shape === 'triangle'}
      tension={obj.tension}
      fill={obj.shape === 'triangle' ? (obj.fill ?? undefined) : undefined}
      stroke={obj.strokeWidth > 0 ? obj.strokeColor : undefined}
      strokeWidth={obj.strokeWidth}
      lineCap="round"
      lineJoin="round"
      rotation={obj.rotation}
      opacity={obj.opacity}
      {...handlers}
    />
  );
}
