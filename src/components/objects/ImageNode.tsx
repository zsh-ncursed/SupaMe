import { Image as KonvaImage } from 'react-konva';
import type { ImageObject } from '../../types';
import { useAsset } from '../../db/assets';
import { registerNode } from './registry';

export interface TransformEndPayload {
  scaleX: number;
  scaleY: number;
  x: number;
  y: number;
  rotation: number;
}

interface NodeProps {
  obj: ImageObject;
  draggable: boolean;
  onDragStart: (id: string) => void;
  onDragMove: (id: string, x: number, y: number) => void;
  onDragEnd: (id: string) => void;
  onSelect: (id: string, additive: boolean) => void;
  onTransformEnd: (id: string, payload: TransformEndPayload) => void;
  onContextMenu: (id: string, clientX: number, clientY: number) => void;
}

export function ImageNode({ obj, draggable, onDragStart, onDragMove, onDragEnd, onSelect, onTransformEnd, onContextMenu }: NodeProps) {
  const entry = useAsset(obj.assetId);

  const crop = obj.crop
    ? { x: obj.crop.x, y: obj.crop.y, width: obj.crop.width, height: obj.crop.height }
    : undefined;

  return (
    <KonvaImage
      id={obj.id}
      ref={(node) => registerNode(obj.id, node)}
      image={entry?.el}
      x={obj.x}
      y={obj.y}
      offsetX={obj.width / 2}
      offsetY={obj.height / 2}
      width={obj.width}
      height={obj.height}
      rotation={obj.rotation}
      opacity={obj.opacity}
      scaleX={obj.flipX ? -1 : 1}
      scaleY={obj.flipY ? -1 : 1}
      crop={crop}
      draggable={draggable && !obj.locked}
      onDragStart={() => onDragStart(obj.id)}
      onDragMove={(e) => onDragMove(obj.id, e.target.x(), e.target.y())}
      onDragEnd={() => onDragEnd(obj.id)}
      onMouseDown={(e) => onSelect(obj.id, e.evt.shiftKey)}
      onContextMenu={(e) => {
        e.evt.preventDefault();
        onContextMenu(obj.id, e.evt.clientX, e.evt.clientY);
      }}
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
