import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Stage, Layer, Rect, Image as KonvaImage, Transformer } from 'react-konva';
import type Konva from 'konva';
import { useEditor } from '../store/editorStore';
import { useAsset } from '../db/assets';
import { ImageNode } from './objects/ImageNode';
import type { TransformEndPayload } from './objects/ImageNode';
import { TextNode } from './objects/TextNode';
import { BubbleNode } from './objects/BubbleNode';
import { getNode } from './objects/registry';
import { setStage } from '../lib/stageHolder';
import { clamp } from '../lib/utils';
import { addImageFiles, addTextObject } from '../lib/addObjects';
import { MIN_FONT_SIZE } from '../types';

interface Props {
  onPickImages: () => void;
}

export function CanvasStage({ onPickImages }: Props) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const trRef = useRef<Konva.Transformer | null>(null);
  const [box, setBox] = useState({ w: 900, h: 600 });
  const [dragOver, setDragOver] = useState(false);

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
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const nz = clamp(st.zoom * factor, 0.25, 4);
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

  // Подключение трансформера к выделенным нодам
  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const sel = new Set(selectedIds);
    const nodes = objects
      .filter((o) => sel.has(o.id) && !o.locked && o.visible)
      .map((o) => getNode(o.id))
      .filter((n): n is Konva.Node => !!n && !!n.getLayer());
    tr.nodes(nodes);
    tr.getLayer()?.batchDraw();
  }, [selectedIds, objects, zoom]);

  const single = selectedIds.length === 1 ? objects.find((o) => o.id === selectedIds[0]) : null;

  const handleDragStart = () => useEditor.getState().beginTransient();

  const handleDragMove = (id: string, x: number, y: number) => {
    useEditor.getState().updateObject(id, { x: Math.round(x), y: Math.round(y) }, { history: false });
  };

  const handleDragEnd = () => {
    const st = useEditor.getState();
    for (const id of st.selectedIds) {
      const node = getNode(id);
      const obj = st.objects.find((o) => o.id === id);
      if (!node || !obj || obj.locked) continue;
      st.updateObject(id, { x: Math.round(node.x()), y: Math.round(node.y()) }, { history: false });
    }
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
    }
    node.scaleX(1);
    node.scaleY(1);
    st.updateObject(id, patch, { history: false });
    useEditor.getState().endTransient();
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
    useEditor.getState().setZoom(clamp(fit, 0.25, 4));
  };

  return (
    <div
      ref={outerRef}
      className={`canvas-outer${dragOver ? ' canvas-outer--drag' : ''}`}
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
                />
              );
            })}
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
    </div>
  );
}
