// Свойства текста: содержимое, шрифт, выравнивание, тень, стили
import { useEditor } from '../../../store/editorStore';
import { useTransientUpdate } from '../../useTransientUpdate';
import { FONTS, CAPTION_FONT } from '../../../lib/fonts';
import {
  NumField,
  SliderField,
  ColorField,
  CheckField,
  SelectField,
  TextAreaField,
  BtnRow,
} from '../../fields';
import type { TextObject, EditorObject, TextAlign, TextTransform } from '../../../types';

export // ---------- Текст ----------

const ALIGN_OPTS: { value: TextAlign; label: string }[] = [
  { value: 'left', label: 'По левому краю' },
  { value: 'center', label: 'По центру' },
  { value: 'right', label: 'По правому краю' },
];

const TRANSFORM_OPTS: { value: TextTransform; label: string }[] = [
  { value: 'none', label: 'Как есть' },
  { value: 'uppercase', label: 'ЗАГЛАВНЫЕ' },
  { value: 'lowercase', label: 'строчные' },
];

const FONT_OPTS = FONTS.map((f) => ({ value: f.family, label: f.label }));

export function TextSection({ obj }: { obj: TextObject }) {
  const tf = useTransientUpdate();
  const st = useEditor.getState;
  const sh = obj.shadow;

  return (
    <>
      <TextAreaField
        label="Текст"
        value={obj.text}
        rows={3}
        onChange={(v) => tf(obj.id, { text: v })}
      />
      <SelectField
        label="Шрифт"
        value={obj.fontFamily}
        options={FONT_OPTS}
        onChange={(v) => st().updateObject(obj.id, { fontFamily: v })}
      />
      <div className="grid-2">
        <NumField
          label="Размер"
          value={obj.fontSize}
          min={6}
          max={400}
          onChange={(v) => tf(obj.id, { fontSize: v })}
        />
        <NumField
          label="Ширина блока"
          value={obj.boxWidth}
          min={20}
          onChange={(v) => tf(obj.id, { boxWidth: v, width: v })}
        />
      </div>
      <BtnRow>
        <button
          className={`btn btn--sm${obj.fontWeight === 'bold' ? ' btn--active' : ''}`}
          onClick={() =>
            st().updateObject(obj.id, { fontWeight: obj.fontWeight === 'bold' ? 'normal' : 'bold' })
          }
        >
          <b>Ж</b>
        </button>
        <button
          className={`btn btn--sm${obj.fontStyle === 'italic' ? ' btn--active' : ''}`}
          onClick={() =>
            st().updateObject(obj.id, {
              fontStyle: obj.fontStyle === 'italic' ? 'normal' : 'italic',
            })
          }
        >
          <i>К</i>
        </button>
        <SelectField
          label="Регистр"
          value={obj.textTransform}
          options={TRANSFORM_OPTS}
          onChange={(v) => st().updateObject(obj.id, { textTransform: v })}
        />
      </BtnRow>
      <ColorField
        label="Цвет текста"
        value={obj.color}
        onChange={(v) => tf(obj.id, { color: v })}
      />
      <div className="grid-2">
        <ColorField
          label="Обводка"
          value={obj.strokeColor}
          onChange={(v) => tf(obj.id, { strokeColor: v })}
        />
        <NumField
          label="Толщина обводки"
          value={obj.strokeWidth}
          min={0}
          max={40}
          onChange={(v) => tf(obj.id, { strokeWidth: v })}
        />
      </div>
      <CheckField
        label="Тень текста"
        checked={!!sh}
        onChange={(v) =>
          st().updateObject(obj.id, {
            shadow: v ? { color: '#000000', offsetX: 4, offsetY: 4, blur: 8, opacity: 0.6 } : null,
          })
        }
      />
      {sh && (
        <>
          <ColorField
            label="Цвет тени"
            value={sh.color}
            onChange={(v) => tf(obj.id, { shadow: { ...sh, color: v } } as Partial<EditorObject>)}
          />
          <div className="grid-2">
            <NumField
              label="Сдвиг X"
              value={sh.offsetX}
              min={-60}
              max={60}
              onChange={(v) =>
                tf(obj.id, { shadow: { ...sh, offsetX: v } } as Partial<EditorObject>)
              }
            />
            <NumField
              label="Сдвиг Y"
              value={sh.offsetY}
              min={-60}
              max={60}
              onChange={(v) =>
                tf(obj.id, { shadow: { ...sh, offsetY: v } } as Partial<EditorObject>)
              }
            />
          </div>
          <SliderField
            label="Размытие тени"
            value={sh.blur}
            min={0}
            max={40}
            onChange={(v) => tf(obj.id, { shadow: { ...sh, blur: v } } as Partial<EditorObject>)}
          />
          <SliderField
            label="Плотность тени"
            value={Math.round(sh.opacity * 100)}
            min={0}
            max={100}
            onChange={(v) =>
              tf(obj.id, { shadow: { ...sh, opacity: v / 100 } } as Partial<EditorObject>)
            }
            display={(v) => `${v}%`}
          />
        </>
      )}
      <SelectField
        label="Выравнивание"
        value={obj.align}
        options={ALIGN_OPTS}
        onChange={(v) => st().updateObject(obj.id, { align: v })}
      />
      <SliderField
        label="Межстрочный"
        value={obj.lineHeight}
        min={0.8}
        max={2}
        step={0.05}
        onChange={(v) => tf(obj.id, { lineHeight: v })}
      />
      <NumField
        label="Межбуквенный"
        value={obj.letterSpacing}
        min={-20}
        max={100}
        onChange={(v) => tf(obj.id, { letterSpacing: v })}
      />
      <BtnRow>
        <button
          className="btn btn--sm"
          onClick={() =>
            st().updateObject(obj.id, {
              fontFamily: CAPTION_FONT,
              fontWeight: 'bold',
              textTransform: 'uppercase',
            })
          }
        >
          Мемный стиль
        </button>
      </BtnRow>
    </>
  );
}
