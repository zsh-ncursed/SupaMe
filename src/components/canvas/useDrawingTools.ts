// Хук рисования (Paint): состояние черновика, обработчики указателя, заливка.
import { useEffect, useState } from 'react';
import { useEditor } from '../../store/editorStore';
import { useUi } from '../../store/uiStore';
import type Konva from 'konva';
import { snapLineAngle } from '../../lib/geometry';
import type { ShapeVariant } from '../../types';
import type { DraftState } from './DraftShape';
import { draftToShapeObject } from './DraftShape';

type StageEvent = { target: { getStage: () => Konva.Stage | null } };
type ToolMoveEvent = StageEvent & { evt: MouseEvent };

export function useDrawingTools(zoom: number) {
  const [draft, setDraft] = useState<DraftState | null>(null);
  const tool = useUi((s) => s.tool);
  const drawing = tool !== 'select' && tool !== 'fill';

  // Esc отменяет недорисованный штрих
  useEffect(() => {
    if (!draft) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDraft(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [draft]);

  const pointerToCanvas = (e: StageEvent): { x: number; y: number } | null => {
    const stage = e.target.getStage();
    const p = stage?.getPointerPosition();
    if (!p) return null;
    return { x: p.x / zoom, y: p.y / zoom };
  };

  const handleToolDown = (e: StageEvent) => {
    const p = pointerToCanvas(e);
    if (!p) return;
    const shape: ShapeVariant =
      tool === 'pen'
        ? 'pen'
        : tool === 'line'
          ? 'line'
          : tool === 'rect'
            ? 'rect'
            : tool === 'ellipse'
              ? 'ellipse'
              : 'pencil';
    setDraft(
      shape === 'pencil' || shape === 'pen'
        ? { shape, points: [p.x, p.y] }
        : { shape, points: [p.x, p.y, p.x, p.y] }
    );
  };

  const handleToolMove = (e: ToolMoveEvent) => {
    if (!draft) return;
    const p = pointerToCanvas(e);
    if (!p) return;
    if (draft.shape === 'pencil' || draft.shape === 'pen') {
      const n = draft.points.length;
      const dx = p.x - draft.points[n - 2];
      const dy = p.y - draft.points[n - 1];
      if (dx * dx + dy * dy < 4) return; // точки реже 2px не нужны
      setDraft({ ...draft, points: [...draft.points, p.x, p.y] });
    } else {
      let [ex, ey] = [p.x, p.y];
      if (draft.shape === 'line' && e.evt.shiftKey) {
        [ex, ey] = snapLineAngle(draft.points[0], draft.points[1], p.x, p.y);
      }
      setDraft({ ...draft, points: [draft.points[0], draft.points[1], ex, ey] });
    }
  };

  const handleToolUp = () => {
    if (!draft) return;
    setDraft(null);
    const obj = draftToShapeObject(draft);
    if (obj) {
      const st = useEditor.getState();
      st.addObject(obj);
      st.select([obj.id]);
    }
  };

  /**
   * Заливка: баббл/фигура/штрих/текст красятся выбранным цветом,
   * клик по пустому месту — красит фон холста.
   */
  const handleFillClick = (targetId: string | null, targetName: string | undefined) => {
    const st = useEditor.getState();
    const ui = useUi.getState();
    if (targetId && targetName !== 'canvas-bg' && targetName !== 'tool-catcher') {
      const obj = st.objects.find((o) => o.id === targetId);
      if (obj) {
        if (obj.kind === 'bubble') {
          st.updateObject(obj.id, { fill: ui.fillColor });
          return;
        }
        if (obj.kind === 'shape') {
          if (obj.shape === 'rect' || obj.shape === 'ellipse' || obj.shape === 'triangle') {
            st.updateObject(obj.id, { fill: ui.fillColor });
          } else {
            st.updateObject(obj.id, { strokeColor: ui.fillColor }); // перекраска штриха
          }
          return;
        }
        if (obj.kind === 'text') {
          st.updateObject(obj.id, { color: ui.fillColor });
          return;
        }
        st.notify('Заливка применима к фигурам, бабблам, тексту и фону', 'info');
        return;
      }
    }
    // пустое место — красим фон
    st.setBackground({ type: 'color', color: ui.fillColor, transparent: false });
  };

  return { draft, drawing, handleToolDown, handleToolMove, handleToolUp, handleFillClick };
}
