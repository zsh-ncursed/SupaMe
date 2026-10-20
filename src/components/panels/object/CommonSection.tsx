// Общие свойства объекта: позиция, поворот, прозрачность, слои, блокировка
import { useEditor } from '../../../store/editorStore';
import { NumField, SliderField, BtnRow, SectionTitle } from '../../fields';
import { useTransientUpdate } from '../../useTransientUpdate';
import type { EditorObject, ShapeVariant } from '../../../types';

export function kindLabel(obj: EditorObject): string {
  if (obj.kind === 'image') return 'Изображение';
  if (obj.kind === 'text') return 'Текст';
  if (obj.kind === 'bubble') return 'Баббл';
  const names: Record<ShapeVariant, string> = {
    rect: 'Прямоугольник',
    ellipse: 'Овал',
    triangle: 'Треугольник',
    line: 'Линия',
    pencil: 'Карандаш',
    pen: 'Перо',
  };
  return names[obj.shape];
}

export function CommonSection({ obj }: { obj: EditorObject }) {
  const tf = useTransientUpdate();
  const st = useEditor.getState;
  return (
    <>
      <SectionTitle>{kindLabel(obj)}</SectionTitle>
      <div className="grid-2">
        <NumField label="X" value={obj.x} onChange={(v) => tf(obj.id, { x: v })} />
        <NumField label="Y" value={obj.y} onChange={(v) => tf(obj.id, { y: v })} />
      </div>
      <SliderField
        label="Поворот"
        value={obj.rotation}
        min={-180}
        max={180}
        onChange={(v) => tf(obj.id, { rotation: v })}
        display={(v) => `${Math.round(v)}°`}
      />
      <SliderField
        label="Прозрачность"
        value={Math.round(obj.opacity * 100)}
        min={0}
        max={100}
        onChange={(v) => tf(obj.id, { opacity: v / 100 })}
        display={(v) => `${v}%`}
      />
      <BtnRow>
        <button
          className="btn btn--sm"
          title="Поднять слой (Ctrl+])"
          disabled={obj.locked}
          onClick={() => st().moveLayer([obj.id], 'up')}
        >
          ⬆
        </button>
        <button
          className="btn btn--sm"
          title="Опустить слой (Ctrl+[)"
          disabled={obj.locked}
          onClick={() => st().moveLayer([obj.id], 'down')}
        >
          ⬇
        </button>
        <button
          className="btn btn--sm"
          title="На передний план"
          disabled={obj.locked}
          onClick={() => st().moveLayer([obj.id], 'front')}
        >
          ⤒
        </button>
        <button
          className="btn btn--sm"
          title="На задний план"
          disabled={obj.locked}
          onClick={() => st().moveLayer([obj.id], 'back')}
        >
          ⤓
        </button>
      </BtnRow>
      <BtnRow>
        <button
          className="btn btn--sm"
          onClick={() => st().updateObject(obj.id, { locked: !obj.locked })}
        >
          {obj.locked ? '🔓 Разблокировать' : '🔒 Заблокировать'}
        </button>
        <button className="btn btn--sm" onClick={() => st().duplicateObjects([obj.id])}>
          ⧉ Копия
        </button>
        <button
          className="btn btn--sm"
          title={obj.locked ? 'Сначала разблокируйте объект' : 'Удалить'}
          disabled={obj.locked}
          onClick={() => st().deleteObjects([obj.id])}
        >
          ✕ Удалить
        </button>
      </BtnRow>
    </>
  );
}
