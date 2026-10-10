import { useEffect, useRef, useState } from 'react';
import { Group, Shape, Text as KonvaText, Circle } from 'react-konva';
import type Konva from 'konva';
import type { BubbleObject } from '../../types';
import { MIN_FONT_SIZE } from '../../types';
import { registerNode } from './registry';
import { boundaryPoint } from '../../lib/geometry';
import type { TransformEndPayload } from './ImageNode';

export interface BubbleNodeProps {
  obj: BubbleObject;
  draggable: boolean;
  selected: boolean;
  showHelpers: boolean;
  onDragStart: (id: string) => void;
  onDragMove: (id: string, x: number, y: number) => void;
  onDragEnd: (id: string) => void;
  onSelect: (id: string, additive: boolean) => void;
  onTransformEnd: (id: string, payload: TransformEndPayload) => void;
  onTailStart: (id: string) => void;
  onTailMove: (id: string, tipX: number, tipY: number) => void;
  onTailEnd: (id: string) => void;
  onContextMenu: (id: string, clientX: number, clientY: number) => void;
}

type SceneCtx = {
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;
  arc(x: number, y: number, r: number, a0: number, a1: number, ccw?: boolean): void;
  arcTo(x1: number, y1: number, x2: number, y2: number, r: number): void;
  ellipse(
    x: number,
    y: number,
    rx: number,
    ry: number,
    rot: number,
    a0: number,
    a1: number,
    ccw?: boolean
  ): void;
  closePath(): void;
  fill(): void;
  stroke(): void;
};

function pathRoundedRect(ctx: SceneCtx, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  const x0 = -w / 2;
  const y0 = -h / 2;
  ctx.beginPath();
  ctx.moveTo(x0 + rr, y0);
  ctx.lineTo(x0 + w - rr, y0);
  ctx.arcTo(x0 + w, y0, x0 + w, y0 + rr, rr);
  ctx.lineTo(x0 + w, y0 + h - rr);
  ctx.arcTo(x0 + w, y0 + h, x0 + w - rr, y0 + h, rr);
  ctx.lineTo(x0 + rr, y0 + h);
  ctx.arcTo(x0, y0 + h, x0, y0 + h - rr, rr);
  ctx.lineTo(x0, y0 + rr);
  ctx.arcTo(x0, y0, x0 + rr, y0, rr);
  ctx.closePath();
}

function pathEllipse(ctx: SceneCtx, w: number, h: number) {
  ctx.beginPath();
  ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.closePath();
}

/** Облачко: «бугры» по эллипсу */
function pathCloud(ctx: SceneCtx, w: number, h: number) {
  const a = w / 2;
  const b = h / 2;
  const n = Math.max(10, Math.round((w + h) / 90));
  const pt = (t: number, k = 1) => ({ x: Math.cos(t) * a * k, y: Math.sin(t) * b * k });
  ctx.beginPath();
  const p0 = pt(0);
  ctx.moveTo(p0.x, p0.y);
  for (let i = 0; i < n; i++) {
    const t0 = (i / n) * Math.PI * 2;
    const t1 = ((i + 1) / n) * Math.PI * 2;
    const tm = (t0 + t1) / 2;
    const pm = pt(tm, 1.22);
    const p1 = pt(t1);
    ctx.quadraticCurveTo(pm.x, pm.y, p1.x, p1.y);
  }
  ctx.closePath();
}

/** Кричащий пузырь: «звезда» по эллипсу */
function pathShout(ctx: SceneCtx, w: number, h: number) {
  const a = w / 2;
  const b = h / 2;
  const n = 14;
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2 - Math.PI / 2;
    const k = i % 2 === 0 ? 1.28 : 1;
    const x = Math.cos(t) * a * k;
    const y = Math.sin(t) * b * k;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawBody(ctx: SceneCtx, shape: BubbleObject['shape'], w: number, h: number, r: number) {
  switch (shape) {
    case 'rounded-rect':
      pathRoundedRect(ctx, w, h, r);
      break;
    case 'rect':
      pathRoundedRect(ctx, w, h, 0);
      break;
    case 'ellipse':
      pathEllipse(ctx, w, h);
      break;
    case 'cloud':
      pathCloud(ctx, w, h);
      break;
    case 'shout':
      pathShout(ctx, w, h);
      break;
  }
}

/** Точка на границе фигуры вдоль направления (dx, dy) — вынесена в src/lib/geometry.ts */

function tailPath(ctx: SceneCtx, obj: BubbleObject) {
  const { tail } = obj;
  const dx = tail.tipX;
  const dy = tail.tipY;
  const len = Math.hypot(dx, dy);
  if (len < 4) return;
  const base = boundaryPoint(obj.shape, obj.width, obj.height, dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;
  const hw = Math.max(4, tail.baseWidth) / 2;
  const b1 = { x: base.x + px * hw, y: base.y + py * hw };
  const b2 = { x: base.x - px * hw, y: base.y - py * hw };
  const mid = { x: (base.x + dx) / 2, y: (base.y + dy) / 2 };
  const c1 = { x: mid.x + px * tail.curve * hw * 2, y: mid.y + py * tail.curve * hw * 2 };
  const c2 = { x: mid.x - px * tail.curve * hw * 2, y: mid.y - py * tail.curve * hw * 2 };

  ctx.beginPath();
  ctx.moveTo(b1.x, b1.y);
  ctx.quadraticCurveTo(c1.x, c1.y, dx, dy);
  ctx.quadraticCurveTo(c2.x, c2.y, b2.x, b2.y);
  ctx.closePath();
}

export function BubbleNode(props: BubbleNodeProps) {
  const { obj, draggable, selected, showHelpers } = props;
  const groupRef = useRef<Konva.Group | null>(null);
  const textRef = useRef<Konva.Text | null>(null);
  const [textH, setTextH] = useState(0);

  useEffect(() => {
    if (textRef.current) setTextH(textRef.current.height());
  }, [
    obj.text.value,
    obj.text.fontSize,
    obj.text.fontFamily,
    obj.text.bold,
    obj.width,
    obj.height,
    obj.padding,
    obj.text.align,
  ]);

  // Автоподбор шрифта: во сколько раз уменьшить, чтобы влез в баббл
  const innerW = Math.max(10, obj.width - obj.padding * 2);
  const innerH = Math.max(10, obj.height - obj.padding * 2);
  let fitScale = 1;
  if (obj.text.autoFit && textH > innerH && textH > 0) {
    fitScale = Math.max(MIN_FONT_SIZE / obj.text.fontSize, innerH / textH);
  }
  const overflow = textH > innerH + 1 && fitScale * obj.text.fontSize <= MIN_FONT_SIZE + 0.01;

  const fillStyle = obj.fill && obj.fill !== 'none' ? obj.fill : 'rgba(0,0,0,0)';
  const tailEnabled = obj.tail.enabled && Math.hypot(obj.tail.tipX, obj.tail.tipY) >= 4;

  return (
    <Group
      id={obj.id}
      ref={(node) => {
        groupRef.current = node;
        registerNode(obj.id, node);
      }}
      x={obj.x}
      y={obj.y}
      width={obj.width}
      height={obj.height}
      offsetX={obj.width / 2}
      offsetY={obj.height / 2}
      rotation={obj.rotation}
      opacity={obj.opacity}
      draggable={draggable && !obj.locked}
      onDragStart={() => props.onDragStart(obj.id)}
      onDragMove={(e) => props.onDragMove(obj.id, e.target.x(), e.target.y())}
      onDragEnd={() => props.onDragEnd(obj.id)}
      onMouseDown={(e) => props.onSelect(obj.id, e.evt.shiftKey)}
      onContextMenu={(e) => {
        e.evt.preventDefault();
        props.onContextMenu(obj.id, e.evt.clientX, e.evt.clientY);
      }}
      onTap={(e) =>
        props.onSelect(obj.id, Boolean((e.evt as unknown as { shiftKey?: boolean }).shiftKey))
      }
      onTransformEnd={(e) =>
        props.onTransformEnd(obj.id, {
          scaleX: e.target.scaleX(),
          scaleY: e.target.scaleY(),
          x: e.target.x(),
          y: e.target.y(),
          rotation: e.target.rotation(),
        })
      }
    >
      {/* Хвостик (под телом) */}
      {tailEnabled && (
        <Shape
          sceneFunc={(ctx, shape) => {
            const c = ctx as unknown as SceneCtx;
            tailPath(c, obj);
            ctx.fillStrokeShape(shape);
          }}
          fill={fillStyle}
          stroke={obj.strokeWidth > 0 ? obj.strokeColor : undefined}
          strokeWidth={obj.strokeWidth}
          strokeScaleEnabled={false}
          lineJoin="round"
          listening={false}
        />
      )}
      {/* Тело баббла */}
      <Shape
        sceneFunc={(ctx, shape) => {
          const c = ctx as unknown as SceneCtx;
          drawBody(c, obj.shape, obj.width, obj.height, obj.cornerRadius);
          ctx.fillStrokeShape(shape);
        }}
        fill={fillStyle}
        stroke={obj.strokeWidth > 0 ? obj.strokeColor : undefined}
        strokeWidth={obj.strokeWidth}
        strokeScaleEnabled={false}
        lineJoin="round"
      />
      {/* Текст внутри */}
      <KonvaText
        ref={textRef}
        text={obj.text.value}
        x={-innerW / 2}
        y={-(textH * fitScale) / 2}
        width={innerW}
        height={textH || undefined}
        scaleX={fitScale}
        fontFamily={obj.text.fontFamily}
        fontSize={obj.text.fontSize}
        fontStyle={obj.text.bold ? 'bold' : 'normal'}
        fill={obj.text.color}
        align={obj.text.align}
        verticalAlign="top"
        wrap="word"
        padding={0}
        listening={false}
      />
      {/* Индикатор переполнения */}
      {overflow && showHelpers && (
        <Shape
          sceneFunc={(ctx) => {
            const c = ctx as unknown as SceneCtx;
            c.beginPath();
            c.moveTo(innerW / 2, -innerH / 2);
            c.lineTo(innerW / 2 + 14, -innerH / 2);
            c.lineTo(innerW / 2, -innerH / 2 + 14);
            c.closePath();
            c.fill();
          }}
          fill="#E53935"
          listening={false}
        />
      )}
      {/* Ручка хвостика */}
      {showHelpers && selected && obj.tail.enabled && (
        <Circle
          x={obj.tail.tipX}
          y={obj.tail.tipY}
          radius={7}
          fill="#1E88E5"
          stroke="#FFFFFF"
          strokeWidth={2}
          draggable
          onMouseDown={(e) => {
            e.cancelBubble = true;
          }}
          onDragStart={(e) => {
            e.cancelBubble = true;
            props.onTailStart(obj.id);
          }}
          onDragMove={(e) => {
            e.cancelBubble = true;
            props.onTailMove(obj.id, e.target.x(), e.target.y());
          }}
          onDragEnd={(e) => {
            e.cancelBubble = true;
            props.onTailEnd(obj.id);
          }}
        />
      )}
    </Group>
  );
}
