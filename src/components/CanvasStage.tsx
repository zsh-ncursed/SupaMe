import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Stage, Layer, Rect, Line, Ellipse, Image as KonvaImage, Transformer } from 'react-konva';
import type Konva from 'konva';
import { useEditor } from '../store/editorStore';
import { useAsset } from '../db/assets';
import { ImageNode } from './objects/ImageNode';
import type { TransformEndPayload } from './objects/ImageNode';
import { TextNode } from './objects/TextNode';
import { BubbleNode } from './objects/BubbleNode';
import { ContextMenu } from './ContextMenu';
import type { ContextMenuState } from './ContextMenu';
import { getNode } from './objects/registry';
import { setStage } from '../lib/stageHolder';
import { clamp, uid } from '../lib/utils';
import { snapLineAngle, snapEdge } from '../lib/geometry';
import { addImageFiles, addTextObject } from '../lib/addObjects';
import { MIN_FONT_SIZE } from '../types';
import type { ShapeObject, ShapeVariant } from '../types';
import { ShapeNode } from './objects/ShapeNode';
import { useUi } from '../store/uiStore';

import { SNAP_PX, ZOOM_MIN, ZOOM_MAX, ZOOM_STEP } from '../lib/config';

interface Props {
  onPickImages: () => void;
}

interface Guides {
  v: number[];
  h: number[];
}

/** Черновик рисуемого объекта (в координатах холста) */
interface DraftState {
  shape: ShapeVariant;
  points: number[];
}

/** Шаг 45° для инструмента «Линия» с Shift — вынесен в src/lib/geometry.ts */

export function CanvasStage({ onPickImages }: Props) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const trRef = useRef<Konva.Transformer | null>(null);
  const [box, setBox] = useState({ w: 900, h: 600 });
  const [dragOver, setDragOver] = useState(false);
  const [guides, setGuides] = useState<Guides>({ v: [], h: [] });
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const tool = useUi((s) => s.tool);
  const drawing = tool !== 'select' && tool !== 'fill';

  const canvas = useEditor((s) => s.canvas);
  const objects = useEditor((s) => s.objects);
  const selectedIds = useEditor((s) => s.selectedIds);
  const zoom = useEditor((s) => s.zoom);
  const exporting = useEditor((s) => s.exporting);
  const bgEntry = useAsset(canvas.background.type === 'image' ? canvas.background.assetId : undefined);

  // Размер контейнера (для «вписать»)
  useLayoutEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const update = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Колесо: зум к курсору
  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const st = useEditor.getState();
      const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      const nz = clamp(st.zoom * factor, ZOOM_MIN, ZOOM_MAX);
      const ratio = nz / st.zoom;
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const sl = el.scrollLeft;
      const stp = el.scrollTop;
      st.setZoom(nz);
      requestAnimationFrame(() => {
        el.scrollLeft = (sl + cx) * ratio - cx;
        el.scrollTop = (stp + cy) * ratio - cy;
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Подключение трансформера к выделенным нодам (при активном инструменте — глушим)
  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    if (useUi.getState().tool !== 'select') {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
      return;
    }
    const sel = new Set(selectedIds);
    const nodes = objects
      .filter((o) => sel.has(o.id) && !o.locked && o.visible)
      .map((o) => getNode(o.id))
      .filter((n): n is Konva.Node => !!n && !!n.getLayer());
    tr.nodes(nodes);
    tr.getLayer()?.batchDraw();
  }, [selectedIds, objects, zoom, tool]);

  const single = selectedIds.length === 1 ? objects.find((o) => o.id === selectedIds[0]) : null;

  // --- Привязка к краям/центру холста с направляющими (ТЗ 5.5.7) ---
  // Чистая функция вынесена в src/lib/geometry.ts (покрыта юнит-тестами).

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

  const clearGuides = () => setGuides({ v: [], h: [] });

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
    const base = { x: Math.round(p.x), y: Math.round(p.y), rotation: Math.round(p.rotation * 10) / 10 };
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
          const pts = obj.points.map((v, i) => Math.round(i % 2 === 0 ? v * p.scaleX : v * p.scaleY));
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

  // --- Инструменты рисования (Paint) ---

  // Esc отменяет недорисованный штрих
  useEffect(() => {
    if (!draft) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDraft(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [draft]);

  const pointerToCanvas = (e: { target: { getStage: () => Konva.Stage | null } }): { x: number; y: number } | null => {
    const stage = e.target.getStage();
    const p = stage?.getPointerPosition();
    if (!p) return null;
    return { x: p.x / zoom, y: p.y / zoom };
  };

  const handleToolDown = (e: { target: { getStage: () => Konva.Stage | null } }) => {
    const p = pointerToCanvas(e);
    if (!p) return;
    const shape: ShapeVariant = tool === 'pen' ? 'pen' : tool === 'line' ? 'line' : tool === 'rect' ? 'rect' : tool === 'ellipse' ? 'ellipse' : 'pencil';
    setDraft(
      shape === 'pencil' || shape === 'pen'
        ? { shape, points: [p.x, p.y] }
        : { shape, points: [p.x, p.y, p.x, p.y] }
    );
  };

  const handleToolMove = (e: { target: { getStage: () => Konva.Stage | null }; evt: MouseEvent }) => {
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

  /** Создать ShapeObject из черновика: bbox → центр, точки — относительно центра */
  const commitDraft = (d: DraftState) => {
    const ui = useUi.getState();
    const pts = d.points;
    const bbox = (() => {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let i = 0; i < pts.length; i += 2) {
        minX = Math.min(minX, pts[i]);
        maxX = Math.max(maxX, pts[i]);
        minY = Math.min(minY, pts[i + 1]);
        maxY = Math.max(maxY, pts[i + 1]);
      }
      return { minX, minY, maxX, maxY };
    })();
    const w = bbox.maxX - bbox.minX;
    const h = bbox.maxY - bbox.minY;
    const cx = (bbox.minX + bbox.maxX) / 2;
    const cy = (bbox.minY + bbox.maxY) / 2;
    const filledShape = d.shape === 'rect' || d.shape === 'ellipse' || d.shape === 'triangle';

    if (filledShape && (w < 3 || h < 3)) return;
    if (d.shape === 'line' && Math.hypot(w, h) < 3) return;

    let relPoints: number[] = [];
    if (d.shape === 'triangle') {
      relPoints = [-w / 2, h / 2, 0, -h / 2, w / 2, h / 2];
    } else if (pts.length >= 4) {
      for (let i = 0; i < pts.length; i += 2) {
        relPoints.push(Math.round(pts[i] - cx), Math.round(pts[i + 1] - cy));
      }
    }

    const obj: ShapeObject = {
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
    useEditor.getState().addObject(obj);
    useEditor.getState().select([obj.id]);
  };

  const handleToolUp = () => {
    if (!draft) return;
    setDraft(null);
    commitDraft(draft);
  };

  /** Заливка: баббл/фигура/штрих/текст красятся, пустое место — фон холста */
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

  // --- Контекстное меню (ТЗ 5.13) ---
  const clampMenu = (clientX: number, clientY: number) => ({
    x: Math.min(clientX, window.innerWidth - 230),
    y: Math.min(clientY, window.innerHeight - 330),
  });

  const handleObjContextMenu = (id: string, clientX: number, clientY: number) => {
    const st = useEditor.getState();
    if (!st.selectedIds.includes(id)) st.select([id]);
    setCtxMenu({
      ...clampMenu(clientX, clientY),
      targetId: id,
      pasteable: st.clipboard.length > 0,
    });
  };

  const handleCanvasContextMenu = (clientX: number, clientY: number) => {
    setCtxMenu({
      ...clampMenu(clientX, clientY),
      targetId: null,
      pasteable: useEditor.getState().clipboard.length > 0,
    });
  };

  const handleSelect = (id: string, additive: boolean) => {
    if (additive) useEditor.getState().toggleSelect(id);
    else useEditor.getState().select([id]);
  };

  const handleTailStart = () => useEditor.getState().beginTransient();
  const handleTailMove = (id: string, tipX: number, tipY: number) => {
    const st = useEditor.getState();
    const obj = st.objects.find((o) => o.id === id);
    if (!obj || obj.kind !== 'bubble') return;
    st.replaceObject(
      { ...obj, tail: { ...obj.tail, tipX: Math.round(tipX), tipY: Math.round(tipY) } },
      { history: false }
    );
  };
  const handleTailEnd = () => useEditor.getState().endTransient();

  // --- Зум ---
  const zoomFit = () => {
    const fit = Math.min((box.w - 48) / canvas.width, (box.h - 48) / canvas.height);
    useEditor.getState().setZoom(clamp(fit, ZOOM_MIN, ZOOM_MAX));
  };

  return (
    <div
      ref={outerRef}
      className={`canvas-outer${dragOver ? ' canvas-outer--drag' : ''}${drawing ? ' canvas-outer--draw' : ''}`}
      onContextMenu={(e) => e.preventDefault()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
        if (files.length) {
          void addImageFiles(files);
        }
      }}
    >
      <div
        className={`canvas-scroll${canvas.background.transparent ? ' checker' : ''}`}
        style={{ width: canvas.width * zoom, height: canvas.height * zoom }}
      >
        <Stage
          width={canvas.width * zoom}
          height={canvas.height * zoom}
          scaleX={zoom}
          scaleY={zoom}
          ref={(s) => setStage(s)}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget || e.target.name() === 'canvas-bg') {
              useEditor.getState().clearSelection();
            }
            if (useUi.getState().tool === 'fill') {
              handleFillClick(e.target.id() || null, e.target.name());
            }
          }}
          onContextMenu={(e) => {
            e.evt.preventDefault();
            if (e.target === e.currentTarget || e.target.name() === 'canvas-bg') {
              handleCanvasContextMenu(e.evt.clientX, e.evt.clientY);
            }
          }}
        >
          <Layer>
            <Rect
              name="canvas-bg"
              x={0}
              y={0}
              width={canvas.width}
              height={canvas.height}
              fill={canvas.background.transparent ? 'rgba(0,0,0,0)' : canvas.background.color}
              onMouseDown={() => useEditor.getState().clearSelection()}
            />
            {canvas.background.type === 'image' && bgEntry && (
              <KonvaImage image={bgEntry.el} width={canvas.width} height={canvas.height} listening={false} />
            )}
            {objects.map((obj) => {
              if (!obj.visible) return null;
              if (obj.kind === 'image') {
                return (
                  <ImageNode
                    key={obj.id}
                    obj={obj}
                    draggable={!exporting}
                    onDragStart={handleDragStart}
                    onDragMove={handleDragMove}
                    onDragEnd={handleDragEnd}
                    onSelect={handleSelect}
                    onTransformEnd={handleTransformEnd}
                    onContextMenu={handleObjContextMenu}
                  />
                );
              }
              if (obj.kind === 'text') {
                return (
                  <TextNode
                    key={obj.id}
                    obj={obj}
                    draggable={!exporting}
                    onDragStart={handleDragStart}
                    onDragMove={handleDragMove}
                    onDragEnd={handleDragEnd}
                    onSelect={handleSelect}
                    onTransformEnd={handleTransformEnd}
                    onContextMenu={handleObjContextMenu}
                  />
                );
              }
              if (obj.kind === 'shape') {
                return (
                  <ShapeNode
                    key={obj.id}
                    obj={obj}
                    draggable={!exporting}
                    onDragStart={handleDragStart}
                    onDragMove={handleDragMove}
                    onDragEnd={handleDragEnd}
                    onSelect={handleSelect}
                    onTransformEnd={handleTransformEnd}
                    onContextMenu={handleObjContextMenu}
                  />
                );
              }
              return (
                <BubbleNode
                  key={obj.id}
                  obj={obj}
                  draggable={!exporting}
                  selected={selectedIds.includes(obj.id)}
                  showHelpers={!exporting}
                  onDragStart={handleDragStart}
                  onDragMove={handleDragMove}
                  onDragEnd={handleDragEnd}
                  onSelect={handleSelect}
                  onTransformEnd={handleTransformEnd}
                  onTailStart={handleTailStart}
                  onTailMove={handleTailMove}
                  onTailEnd={handleTailEnd}
                  onContextMenu={handleObjContextMenu}
                />
              );
            })}
            {!exporting && guides.v.map((gx, i) => (
              <Line
                key={`guide-v${i}`}
                points={[gx, 0, gx, canvas.height]}
                stroke="#42a5f5"
                strokeWidth={1 / zoom}
                dash={[6 / zoom, 4 / zoom]}
                listening={false}
              />
            ))}
            {!exporting && guides.h.map((gy, i) => (
              <Line
                key={`guide-h${i}`}
                points={[0, gy, canvas.width, gy]}
                stroke="#42a5f5"
                strokeWidth={1 / zoom}
                dash={[6 / zoom, 4 / zoom]}
                listening={false}
              />
            ))}
            <Transformer
              ref={trRef}
              rotateEnabled
              rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
              anchorSize={9}
              anchorCornerRadius={2}
              borderStroke="#1E88E5"
              anchorStroke="#1E88E5"
              anchorFill="#FFFFFF"
              rotateAnchorOffset={26}
              padding={2}
              keepRatio={single?.kind === 'image'}
              enabledAnchors={
                single?.kind === 'text'
                  ? ['top-left', 'top-right', 'bottom-left', 'bottom-right']
                  : ['top-left', 'top-center', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right']
              }
              onTransformStart={handleTransformStart}
              boundBoxFunc={(oldBox, newBox) =>
                Math.abs(newBox.width) < 8 || Math.abs(newBox.height) < 8 ? oldBox : newBox
              }
            />
            {/* Черновик рисуемого объекта */}
            {draft && (
              <DraftShape
                draft={draft}
                stroke={useUi.getState().strokeColor}
                fill={useUi.getState().fillColor}
                strokeWidth={useUi.getState().strokeWidth}
              />
            )}
            {/* Ловец событий рисования — поверх всего при активном инструменте */}
            {drawing && !exporting && (
              <Rect
                name="tool-catcher"
                x={0}
                y={0}
                width={canvas.width}
                height={canvas.height}
                fill="rgba(0,0,0,0)"
                onMouseDown={handleToolDown}
                onMouseMove={handleToolMove}
                onMouseUp={handleToolUp}
              />
            )}
          </Layer>
        </Stage>
      </div>

      {!exporting && objects.length === 0 && (
        <div className="canvas-empty">
          <div className="canvas-empty__title">Перетащите изображение сюда</div>
          <div className="canvas-empty__actions">
            <button className="btn btn--primary" onClick={onPickImages}>
              Загрузить изображение
            </button>
            <button className="btn" onClick={() => addTextObject()}>
              Добавить текст
            </button>
          </div>
          <div className="canvas-empty__hint">Бабблы и подписи — на левой панели</div>
        </div>
      )}

      {!exporting && (
        <div className="zoom-controls">
          <button className="zoom-btn" title="Уменьшить (Ctrl+-)" onClick={() => useEditor.getState().setZoom(zoom / 1.2)}>−</button>
          <span className="zoom-label">{Math.round(zoom * 100)}%</span>
          <button className="zoom-btn" title="Увеличить (Ctrl+=)" onClick={() => useEditor.getState().setZoom(zoom * 1.2)}>+</button>
          <button className="zoom-btn zoom-btn--wide" title="Масштаб 100% (Ctrl+0)" onClick={() => useEditor.getState().setZoom(1)}>100%</button>
          <button className="zoom-btn zoom-btn--wide" onClick={zoomFit}>Вписать</button>
        </div>
      )}

      {!exporting && <ContextMenu menu={ctxMenu} onClose={() => setCtxMenu(null)} />}
    </div>
  );
}

/** Черновик: предпросмотр рисуемого объекта поверх холста (в координатах холста) */
function DraftShape({
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
