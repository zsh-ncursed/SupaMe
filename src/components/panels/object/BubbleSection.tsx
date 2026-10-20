// Свойства баббла: форма, заливка, хвостик, текст
import { useEditor } from '../../../store/editorStore';
import { useTransientUpdate } from '../../useTransientUpdate';
import { FONTS } from '../../../lib/fonts';
import {
  SectionTitle,
  NumField,
  SliderField,
  ColorField,
  CheckField,
  SelectField,
  TextAreaField,
  BtnRow,
} from '../../fields';
import type { BubbleObject, BubbleShape, EditorObject, TextAlign } from '../../../types';

const ALIGN_OPTS: { value: TextAlign; label: string }[] = [
  { value: 'left', label: 'По левому краю' },
  { value: 'center', label: 'По центру' },
  { value: 'right', label: 'По правому краю' },
];

const FONT_OPTS = FONTS.map((f) => ({ value: f.family, label: f.label }));

export // ---------- Баббл ----------

const SHAPE_OPTS: { value: BubbleShape; label: string }[] = [
  { value: 'rounded-rect', label: 'Скруглённый' },
  { value: 'ellipse', label: 'Овал' },
  { value: 'cloud', label: 'Облачко' },
  { value: 'shout', label: 'Крик' },
  { value: 'rect', label: 'Прямоугольник' },
];

export function BubbleSection({ obj }: { obj: BubbleObject }) {
  const tf = useTransientUpdate();
  const st = useEditor.getState;
  const t = obj.text;

  return (
    <>
      <SelectField
        label="Форма"
        value={obj.shape}
        options={SHAPE_OPTS}
        onChange={(v) => st().updateObject(obj.id, { shape: v })}
      />
      <div className="grid-2">
        <ColorField
          label="Фон"
          value={obj.fill === 'rgba(0,0,0,0)' ? '#FFFFFF' : obj.fill}
          onChange={(v) => tf(obj.id, { fill: v })}
        />
        <ColorField
          label="Граница"
          value={obj.strokeColor}
          onChange={(v) => tf(obj.id, { strokeColor: v })}
        />
      </div>
      <div className="grid-2">
        <NumField
          label="Толщина границы"
          value={obj.strokeWidth}
          min={0}
          max={40}
          onChange={(v) => tf(obj.id, { strokeWidth: v })}
        />
        {obj.shape === 'rounded-rect' && (
          <NumField
            label="Радиус углов"
            value={obj.cornerRadius}
            min={0}
            max={200}
            onChange={(v) => tf(obj.id, { cornerRadius: v })}
          />
        )}
      </div>
      <NumField
        label="Отступ текста"
        value={obj.padding}
        min={0}
        max={120}
        onChange={(v) => tf(obj.id, { padding: v })}
      />
      <CheckField
        label="Хвостик"
        checked={obj.tail.enabled}
        onChange={(v) => st().replaceObject({ ...obj, tail: { ...obj.tail, enabled: v } })}
      />
      {obj.tail.enabled && (
        <>
          <div className="grid-2">
            <NumField
              label="Основание"
              value={obj.tail.baseWidth}
              min={6}
              max={120}
              onChange={(v) =>
                tf(obj.id, { tail: { ...obj.tail, baseWidth: v } } as Partial<EditorObject>)
              }
            />
            <SliderField
              label="Кривизна"
              value={obj.tail.curve}
              min={0}
              max={1}
              step={0.05}
              onChange={(v) =>
                tf(obj.id, { tail: { ...obj.tail, curve: v } } as Partial<EditorObject>)
              }
            />
          </div>
          <BtnRow>
            <button
              className="btn btn--sm"
              onClick={() =>
                st().replaceObject({
                  ...obj,
                  tail: {
                    ...obj.tail,
                    tipX: -Math.round(obj.width / 2) - 40,
                    tipY: Math.round(obj.height / 2) + 46,
                  },
                })
              }
            >
              Вернуть хвостик
            </button>
          </BtnRow>
        </>
      )}
      <SectionTitle>Текст баббла</SectionTitle>
      <TextAreaField
        label="Реплика"
        value={t.value}
        rows={2}
        onChange={(v) => tf(obj.id, { text: { ...t, value: v } } as Partial<EditorObject>)}
      />
      <SelectField
        label="Шрифт"
        value={t.fontFamily}
        options={FONT_OPTS}
        onChange={(v) => st().updateObject(obj.id, { text: { ...t, fontFamily: v } })}
      />
      <div className="grid-2">
        <NumField
          label="Размер"
          value={t.fontSize}
          min={6}
          max={200}
          onChange={(v) => tf(obj.id, { text: { ...t, fontSize: v } } as Partial<EditorObject>)}
        />
        <ColorField
          label="Цвет"
          value={t.color}
          onChange={(v) => tf(obj.id, { text: { ...t, color: v } } as Partial<EditorObject>)}
        />
      </div>
      <CheckField
        label="Жирный"
        checked={t.bold}
        onChange={(v) => st().updateObject(obj.id, { text: { ...t, bold: v } })}
      />
      <SelectField
        label="Выравнивание"
        value={t.align}
        options={ALIGN_OPTS}
        onChange={(v) => st().updateObject(obj.id, { text: { ...t, align: v } })}
      />
      <CheckField
        label="Автоподбор размера"
        checked={t.autoFit}
        onChange={(v) => st().updateObject(obj.id, { text: { ...t, autoFit: v } })}
      />
    </>
  );
}
