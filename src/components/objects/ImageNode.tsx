import { useEffect, useRef } from 'react';
import { Image as KonvaImage } from 'react-konva';
import type Konva from 'konva';
import type { ImageObject } from '../../types';
import { useAsset } from '../../db/assets';
import { registerNode } from './registry';
import { normalizeFilters, isFiltersDefault, filterPipeline, filterAttrs } from '../../lib/filters';

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
  const nodeRef = useRef<Konva.Image | null>(null);

  const f = normalizeFilters(obj.filters);
  const active = !isFiltersDefault(f);
  const pipe = active ? filterPipeline(f) : [];
  const attrs = filterAttrs(f);

  // Фильтры Konva применяются к кэшу ноды — пересобираем его при изменениях
  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;
    if (active && entry) {
      node.cache({ pixelRatio: 2 });
    } else {
      node.clearCache();
    }
    node.getLayer()?.batchDraw();
  }, [active, entry, obj.width, obj.height, obj.crop, f.brightness, f.contrast, f.saturation, f.blur, f.grayscale, f.sepia]);

  const crop = obj.crop
    ? { x: obj.crop.x, y: obj.crop.y, width: obj.crop.width, height: obj.crop.height }
    : undefined;

  return (
    <KonvaImage
      id={obj.id}
      ref={(node) => {
        nodeRef.current = node;
        registerNode(obj.id, node);
      }}
      image={entry?.el}
      filters={pipe}
      brightness={attrs.brightness}
      contrast={attrs.contrast}
      saturation={attrs.saturation}
      blurRadius={attrs.blurRadius}
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
