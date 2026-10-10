// Перетаскивание с привязкой к краям/центру холста (направляющие) и
// обработчики трансформера: начало/конец transient-серии, финальная геометрия.
import { useState } from 'react';
import { useEditor } from '../../store/editorStore';
import { getNode } from '../objects/registry';
import { snapEdge } from '../../lib/geometry';
import { SNAP_PX } from '../../lib/config';
import { MIN_FONT_SIZE } from '../../types';
import type { TransformEndPayload } from '../objects/ImageNode';

export interface Guides {
  v: number[];
  h: number[];
}

export function useDragTransform() {
  const [guides, setGuides] = useState<Guides>({ v: [], h: [] });
  const clearGuides = () => setGuides({ v: [], h: [] });

  const handleDragStart = () => useEditor.getState().beginTransient();

  const handleDragMove = (id: string, x: number, y: number) => {
    const st = useEditor.getState();
    const obj = st.objects.find((o) => o.id === id);
    let nx = Math.round(x);
    let ny = Math.round(y);
    const gv: number[] = [];
    const gh: number[] = [];
    if (obj) {
      const th = SNAP_PX / st.zoom;
      const W = st.canvas.width;
      const H = st.canvas.height;
      const bx = snapEdge([nx - obj.width / 2, nx + obj.width / 2], [0, W / 2, W], th);
      if (bx) {
        nx = Math.round(nx + bx.delta);
        gv.push(bx.guide);
      }
      const by = snapEdge([ny - obj.height / 2, ny + obj.height / 2], [0, H / 2, H], th);
      if (by) {
        ny = Math.round(ny + by.delta);
        gh.push(by.guide);
      }
    }
    st.updateObject(id, { x: nx, y: ny }, { history: false });
    setGuides({ v: gv, h: gh });
  };

  const handleDragEnd = () => {
    const st = useEditor.getState();
    for (const id of st.selectedIds) {
      const node = getNode(id);
      const obj = st.objects.find((o) => o.id === id);
      if (!node || !obj || obj.locked) continue;
      st.updateObject(id, { x: Math.round(node.x()), y: Math.round(node.y()) }, { history: false });
    }
    clearGuides();
    useEditor.getState().endTransient();
  };

  const handleTransformStart = () => useEditor.getState().beginTransient();

  const handleTransformEnd = (id: string, p: TransformEndPayload) => {
    const st = useEditor.getState();
    const obj = st.objects.find((o) => o.id === id);
    const node = getNode(id);
    if (!obj || !node) return;
    const base = {
      x: Math.round(p.x),
      y: Math.round(p.y),
      rotation: Math.round(p.rotation * 10) / 10,
    };
    let patch: Partial<typeof obj>;
    switch (obj.kind) {
      case 'image':
        patch = {
          ...base,
          width: Math.max(8, obj.width * p.scaleX),
          height: Math.max(8, obj.height * p.scaleY),
        };
        break;
      case 'text':
        patch = {
          ...base,
          width: Math.max(20, obj.boxWidth * p.scaleX),
          boxWidth: Math.max(20, obj.boxWidth * p.scaleX),
          height: Math.max(10, obj.height * p.scaleY),
          fontSize: Math.max(MIN_FONT_SIZE, Math.round(obj.fontSize * p.scaleY * 2) / 2),
        };
        break;
      case 'bubble':
        patch = {
          ...base,
          width: Math.max(16, obj.width * p.scaleX),
          height: Math.max(16, obj.height * p.scaleY),
          tail: { ...obj.tail, tipX: obj.tail.tipX * p.scaleX, tipY: obj.tail.tipY * p.scaleY },
        };
        break;
      case 'shape': {
        if (obj.points.length) {
          // путь (line/pencil/pen/triangle): масштабируем точки
          const pts = obj.points.map((v, i) =>
            Math.round(i % 2 === 0 ? v * p.scaleX : v * p.scaleY)
          );
          patch = { ...base, points: pts };
        } else {
          patch = {
            ...base,
            width: Math.max(4, Math.round(obj.width * p.scaleX)),
            height: Math.max(4, Math.round(obj.height * p.scaleY)),
          };
        }
        break;
      }
    }
    node.scaleX(1);
    node.scaleY(1);
    st.updateObject(id, patch, { history: false });
    clearGuides();
    useEditor.getState().endTransient();
  };

  return {
    guides,
    clearGuides,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    handleTransformStart,
    handleTransformEnd,
  };
}
