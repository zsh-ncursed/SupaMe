// Плавающая панель инструментов Paint (слева сверху над холстом)
import { useUi } from '../store/uiStore';
import type { ToolId } from '../store/uiStore';

const TOOLS: { id: ToolId; icon: string; title: string }[] = [
  { id: 'select', icon: '↖', title: 'Выделение (V)' },
  { id: 'pencil', icon: '✏', title: 'Карандаш (P)' },
  { id: 'pen', icon: '✒', title: 'Перо — сглаженная кривая (N)' },
  { id: 'line', icon: '╱', title: 'Линия (L), Shift — шаг 45°' },
  { id: 'rect', icon: '▭', title: 'Прямоугольник (R)' },
  { id: 'ellipse', icon: '◯', title: 'Овал (O)' },
  { id: 'fill', icon: '⛁', title: 'Заливка (F): фигура, баббл, текст или фон' },
];

export function PaintToolbar() {
  const tool = useUi((s) => s.tool);
  const strokeColor = useUi((s) => s.strokeColor);
  const fillColor = useUi((s) => s.fillColor);
  const strokeWidth = useUi((s) => s.strokeWidth);
  const st = useUi.getState;

  return (
    <div className="paint-toolbar">
      {TOOLS.map((t) => (
        <button
          key={t.id}
          className={`ptool${tool === t.id ? ' ptool--active' : ''}`}
          title={t.title}
          onClick={() => st().setTool(t.id)}
        >
          {t.icon}
        </button>
      ))}
      <div className="ptool-sep" />
      <input
        type="color"
        className="ptool-color"
        title="Цвет обводки / карандаша"
        value={strokeColor}
        onChange={(e) => st().setStrokeColor(e.target.value)}
      />
      <input
        type="color"
        className="ptool-color"
        title="Цвет заливки (фигуры, баббла, текста, фона)"
        value={fillColor}
        onChange={(e) => st().setFillColor(e.target.value)}
      />
      <div className="ptool-width" title={`Толщина обводки: ${strokeWidth}`}>
        <input
          type="range"
          min={1}
          max={40}
          value={strokeWidth}
          onChange={(e) => st().setStrokeWidth(Number(e.target.value))}
        />
        <span>{strokeWidth}</span>
      </div>
    </div>
  );
}
