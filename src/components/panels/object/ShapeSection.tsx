// Свойства фигур и штрихов (инструменты Paint)
import { useEditor } from '../../../store/editorStore';
import { useTransientUpdate } from '../../useTransientUpdate';
import { NumField, ColorField, CheckField, SelectField } from '../../fields';
import type { ShapeObject, ShapeVariant, EditorObject } from '../../../types';

export // ---------- Фигуры и штрихи (инструменты Paint) ----------

const VARIANT_OPTS: { value: ShapeVariant; label: string }[] = [
  { value: 'rect', label: 'Прямоугольник' },
  { value: 'ellipse', label: 'Овал' },
  { value: 'triangle', label: 'Треугольник' },
  { value: 'line', label: 'Линия' },
  { value: 'pencil', label: 'Карандаш' },
  { value: 'pen', label: 'Перо' },
];

export function ShapeSection({ obj }: { obj: ShapeObject }) {
  const tf = useTransientUpdate();
  const st = useEditor.getState;
  const filled = obj.shape === 'rect' || obj.shape === 'ellipse' || obj.shape === 'triangle';

  return (
    <>
      <SelectField
        label="Фигура"
        value={obj.shape}
        options={VARIANT_OPTS}
        onChange={(v) => st().updateObject(obj.id, { shape: v })}
      />
      {filled && (
        <div className="grid-2">
          <ColorField
            label="Заливка"
            value={obj.fill ?? '#FFFFFF'}
            onChange={(v) => tf(obj.id, { fill: v } as Partial<EditorObject>)}
          />
          <CheckField
            label="Без заливки"
            checked={obj.fill === null}
            onChange={(v) => st().updateObject(obj.id, { fill: v ? null : '#FFFFFF' })}
          />
        </div>
      )}
      <div className="grid-2">
        <ColorField
          label="Обводка"
          value={obj.strokeColor}
          onChange={(v) => tf(obj.id, { strokeColor: v } as Partial<EditorObject>)}
        />
        <NumField
          label="Толщина"
          value={obj.strokeWidth}
          min={0}
          max={80}
          onChange={(v) => tf(obj.id, { strokeWidth: v } as Partial<EditorObject>)}
        />
      </div>
      {obj.shape === 'rect' && (
        <NumField
          label="Радиус углов"
          value={obj.cornerRadius}
          min={0}
          max={200}
          onChange={(v) => tf(obj.id, { cornerRadius: v } as Partial<EditorObject>)}
        />
      )}
    </>
  );
}
