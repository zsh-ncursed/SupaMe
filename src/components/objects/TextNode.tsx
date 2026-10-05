import { useEffect, useState } from 'react';
import { Text as KonvaText } from 'react-konva';
import type Konva from 'konva';
import type { TextObject } from '../../types';
import { registerNode } from './registry';

interface NodeProps {
  obj: TextObject;
  draggable: boolean;
  onDragStart: (id: string) => void;
  onDragMove: (id: string, x: number, y: number) => void;
  onDragEnd: (id: string) => void;
  onSelect: (id: string, additive: boolean) => void;
  onTransformEnd: (id: string, node: { scaleX: number; scaleY: number; x: number; y: number; rotation: number }) => void;
}

function applyTransform(value: string, mode: TextObject['textTransform']): string {
  if (mode === 'uppercase') return value.toUpperCase();
  if (mode === 'lowercase') return value.toLowerCase();
  return value;
}

export function TextNode({ obj, draggable, onDragStart, onDragMove, onDragEnd, onSelect, onTransformEnd }: NodeProps) {
  const [measuredH, setMeasuredH] = useState(obj.fontSize);
  const [ref, setRef] = useState<Konva.Text | null>(null);

  useEffect(() => {
    if (ref) {
      const h = ref.height();
      if (Math.abs(h - measuredH) > 0.5) setMeasuredH(h);
    }
  }, [ref, measuredH, obj]);

  const fontStyleStr =
    [obj.fontStyle === 'italic' ? 'italic' : '', obj.fontWeight === 'bold' ? 'bold' : '']
      .filter(Boolean)
      .join(' ') || 'normal';

  return (
    <KonvaText
      id={obj.id}
      ref={(node) => {
        setRef(node);
        registerNode(obj.id, node);
      }}
      text={applyTransform(obj.text, obj.textTransform)}
      x={obj.x}
      y={obj.y}
      offsetX={obj.boxWidth / 2}
      offsetY={measuredH / 2}
      width={obj.boxWidth}
      rotation={obj.rotation}
      opacity={obj.opacity}
      fontFamily={obj.fontFamily}
      fontSize={obj.fontSize}
      fontStyle={fontStyleStr}
      fill={obj.color}
      stroke={obj.strokeWidth > 0 ? obj.strokeColor : undefined}
      strokeWidth={obj.strokeWidth}
      strokeScaleEnabled={false}
      fillAfterStrokeEnabled={obj.strokeWidth > 0}
      shadowColor={obj.shadow?.color}
      shadowOffsetX={obj.shadow?.offsetX ?? 0}
      shadowOffsetY={obj.shadow?.offsetY ?? 0}
      shadowBlur={obj.shadow?.blur ?? 0}
      shadowOpacity={obj.shadow?.opacity ?? 1}
      align={obj.align}
      lineHeight={obj.lineHeight}
      letterSpacing={obj.letterSpacing}
      wrap="word"
      draggable={draggable && !obj.locked}
      onDragStart={() => onDragStart(obj.id)}
      onDragMove={(e) => onDragMove(obj.id, e.target.x(), e.target.y())}
      onDragEnd={() => onDragEnd(obj.id)}
      onMouseDown={(e) => onSelect(obj.id, e.evt.shiftKey)}
      onTap={(e) => onSelect(obj.id, Boolean((e.evt as unknown as { shiftKey?: boolean }).shiftKey))}
      onTransformEnd={(e) =>
        onTransformEnd(obj.id, {
          scaleX: e.target.scaleX(),
          scaleY: e.target.scaleY(),
          x: e.target.x(),
          y: e.target.y(),
          rotation: e.target.rotation(),
        })
      }
    />
  );
}
