import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Stage, Layer, Rect, Line, Image as KonvaImage, Transformer } from 'react-konva';
import type Konva from 'konva';
import { useEditor } from '../store/editorStore';
import { useAsset } from '../db/assets';
import { ImageNode } from './objects/ImageNode';
import { TextNode } from './objects/TextNode';
import { BubbleNode } from './objects/BubbleNode';
import { ShapeNode } from './objects/ShapeNode';
import { ContextMenu } from './ContextMenu';
import type { ContextMenuState } from './ContextMenu';
import { getNode } from './objects/registry';
import { setStage } from '../lib/stageHolder';
import { useUi } from '../store/uiStore';
import { addImageFiles, addTextObject } from '../lib/addObjects';
import { clamp } from '../lib/utils';
import { ZOOM_MIN, ZOOM_MAX } from '../lib/config';
import { useStageZoom, calcZoomFit } from './canvas/useStageZoom';
import { useDrawingTools } from './canvas/useDrawingTools';
import { useDragTransform } from './canvas/useDragTransform';
import { DraftShape } from './canvas/DraftShape';

interface Props {
  onPickImages: () => void;
}

export function CanvasStage({ onPickImages }: Props) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const trRef = useRef<Konva.Transformer | null>(null);
  const [box, setBox] = useState({ w: 900, h: 600 });
  const [dragOver, setDragOver] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null);

  const canvas = useEditor((s) => s.canvas);
  const objects = useEditor((s) => s.objects);
  const selectedIds = useEditor((s) => s.selectedIds);
  const zoom = useEditor((s) => s.zoom);
  const exporting = useEditor((s) => s.exporting);
  const tool = useUi((s) => s.tool);
  const bgEntry = useAsset(
    canvas.background.type === 'image' ? canvas.background.assetId : undefined
  );

  const { draft, drawing, handleToolDown, handleToolMove, handleToolUp, handleFillClick } =
    useDrawingTools(zoom);
  const {
    guides,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    handleTransformStart,
    handleTransformEnd,
  } = useDragTransform();
  useStageZoom(outerRef);

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

  const zoomFit = () => {
    const fit = calcZoomFit(box.w, box.h, canvas.width, canvas.height);
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
              <KonvaImage
                image={bgEntry.el}
                width={canvas.width}
                height={canvas.height}
                listening={false}
              />
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
            {!exporting &&
              guides.v.map((gx, i) => (
                <Line
                  key={`guide-v${i}`}
                  points={[gx, 0, gx, canvas.height]}
                  stroke="#42a5f5"
                  strokeWidth={1 / zoom}
                  dash={[6 / zoom, 4 / zoom]}
                  listening={false}
                />
              ))}
            {!exporting &&
              guides.h.map((gy, i) => (
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
                  : [
                      'top-left',
                      'top-center',
                      'top-right',
                      'middle-left',
                      'middle-right',
                      'bottom-left',
                      'bottom-center',
                      'bottom-right',
                    ]
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
          <button
            className="zoom-btn"
            title="Уменьшить (Ctrl+-)"
            onClick={() => useEditor.getState().setZoom(zoom / 1.2)}
          >
            −
          </button>
          <span className="zoom-label">{Math.round(zoom * 100)}%</span>
          <button
            className="zoom-btn"
            title="Увеличить (Ctrl+=)"
            onClick={() => useEditor.getState().setZoom(zoom * 1.2)}
          >
            +
          </button>
          <button
            className="zoom-btn zoom-btn--wide"
            title="Масштаб 100% (Ctrl+0)"
            onClick={() => useEditor.getState().setZoom(1)}
          >
            100%
          </button>
          <button className="zoom-btn zoom-btn--wide" onClick={zoomFit}>
            Вписать
          </button>
        </div>
      )}

      {!exporting && <ContextMenu menu={ctxMenu} onClose={() => setCtxMenu(null)} />}
    </div>
  );
}
