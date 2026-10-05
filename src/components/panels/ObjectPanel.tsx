// Панель свойств одного объекта
import { useEditor } from '../../store/editorStore';
import { useAsset } from '../../db/assets';
import { FONTS, CAPTION_FONT } from '../../lib/fonts';
import {
  SectionTitle,
  NumField,
  SliderField,
  ColorField,
  CheckField,
  SelectField,
  TextAreaField,
  BtnRow,
} from '../fields';
import { useTransientUpdate } from '../useTransientUpdate';
import type { ImageObject, ImageFilters, TextObject, BubbleObject, EditorObject, TextAlign, TextTransform, BubbleShape } from '../../types';
import { DEFAULT_FILTERS, normalizeFilters, isFiltersDefault } from '../../lib/filters';

export function ObjectPanel({ obj }: { obj: EditorObject }) {
  return (
    <div className="panel-section">
      <CommonSection obj={obj} />
      {obj.kind === 'image' && <ImageSection obj={obj} />}
      {obj.kind === 'text' && <TextSection obj={obj} />}
      {obj.kind === 'bubble' && <BubbleSection obj={obj} />}
    </div>
  );
}

function kindLabel(obj: EditorObject): string {
  return obj.kind === 'image' ? 'Изображение' : obj.kind === 'text' ? 'Текст' : 'Баббл';
}

function CommonSection({ obj }: { obj: EditorObject }) {
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
        <button className="btn btn--sm" title="Поднять слой (Ctrl+])" onClick={() => st().moveLayer([obj.id], 'up')}>⬆</button>
        <button className="btn btn--sm" title="Опустить слой (Ctrl+[)" onClick={() => st().moveLayer([obj.id], 'down')}>⬇</button>
        <button className="btn btn--sm" title="На передний план" onClick={() => st().moveLayer([obj.id], 'front')}>⤒</button>
        <button className="btn btn--sm" title="На задний план" onClick={() => st().moveLayer([obj.id], 'back')}>⤓</button>
      </BtnRow>
      <BtnRow>
        <button className="btn btn--sm" onClick={() => st().updateObject(obj.id, { locked: !obj.locked })}>
          {obj.locked ? '🔓 Разблокировать' : '🔒 Заблокировать'}
        </button>
        <button className="btn btn--sm" onClick={() => st().duplicateObjects([obj.id])}>⧉ Копия</button>
        <button className="btn btn--sm" onClick={() => st().deleteObjects([obj.id])}>✕ Удалить</button>
      </BtnRow>
    </>
  );
}

// ---------- Изображение ----------

function ImageSection({ obj }: { obj: ImageObject }) {
  const tf = useTransientUpdate();
  const st = useEditor.getState;
  const entry = useAsset(obj.assetId);
  const natW = entry?.width ?? 0;
  const natH = entry?.height ?? 0;

  return (
    <>
      <div className="grid-2">
        <NumField label="Ширина" value={obj.width} min={8} onChange={(v) => tf(obj.id, { width: v, height: Math.round(v / (natW / natH || 1)) })} />
        <NumField label="Высота" value={obj.height} min={8} onChange={(v) => tf(obj.id, { height: v, width: Math.round(v * (natW / natH || 1)) })} />
      </div>
      <BtnRow>
        <button className="btn btn--sm" onClick={() => st().updateObject(obj.id, { flipX: !obj.flipX })}>⇋ Отразить ↔</button>
        <button className="btn btn--sm" onClick={() => st().updateObject(obj.id, { flipY: !obj.flipY })}>⇅ Отразить ↕</button>
      </BtnRow>
      <SectionTitle>Обрезка</SectionTitle>
      {obj.crop && natW > 0 ? (
        <>
          <div className="grid-2">
            <NumField label="X" value={obj.crop.x} min={0} max={natW - 1} onChange={(v) => tf(obj.id, { crop: { ...obj.crop, x: v, width: Math.min(obj.crop!.width, natW - v) } } as Partial<EditorObject>) } />
            <NumField label="Y" value={obj.crop.y} min={0} max={natH - 1} onChange={(v) => tf(obj.id, { crop: { ...obj.crop, y: v, height: Math.min(obj.crop!.height, natH - v) } } as Partial<EditorObject>)} />
            <NumField label="Ширина" value={obj.crop.width} min={1} max={natW} onChange={(v) => tf(obj.id, { crop: { ...obj.crop, width: v } } as Partial<EditorObject>)} />
            <NumField label="Высота" value={obj.crop.height} min={1} max={natH} onChange={(v) => tf(obj.id, { crop: { ...obj.crop, height: v } } as Partial<EditorObject>)} />
          </div>
          <BtnRow>
            <button className="btn btn--sm" onClick={() => st().updateObject(obj.id, { crop: null })}>
              Сбросить обрезку
            </button>
          </BtnRow>
        </>
      ) : (
        <div className="panel-note">
          Область обрезки можно задать в пикселях исходника{natW ? ` (${natW}×${natH})` : ''}
          <BtnRow>
            <button
              className="btn btn--sm"
              disabled={!natW}
              onClick={() =>
                st().updateObject(obj.id, {
                  crop: { x: 0, y: 0, width: natW, height: Math.round(natH / 2) },
                })
              }
            >
              Обрезать нижнюю половину
            </button>
          </BtnRow>
        </div>
      )}
      <SectionTitle>Фильтры</SectionTitle>
      <FiltersSection obj={obj} />
    </>
  );
}

function FiltersSection({ obj }: { obj: ImageObject }) {
  const tf = useTransientUpdate();
  const st = useEditor.getState;
  const f = normalizeFilters(obj.filters);
  const set = (patch: Partial<ImageFilters>) =>
    tf(obj.id, { filters: { ...f, ...patch } } as Partial<EditorObject>);

  return (
    <>
      <div className="grid-2">
        <CheckField label="Ч/Б" checked={f.grayscale} onChange={(v) => set({ grayscale: v })} />
        <CheckField label="Сепия" checked={f.sepia} onChange={(v) => set({ sepia: v })} />
      </div>
      <SliderField
        label="Яркость"
        value={f.brightness - 100}
        min={-100}
        max={100}
        onChange={(v) => set({ brightness: Math.round(v) + 100 })}
      />
      <SliderField
        label="Контраст"
        value={f.contrast}
        min={-100}
        max={100}
        onChange={(v) => set({ contrast: Math.round(v) })}
      />
      <SliderField
        label="Насыщенность"
        value={f.saturation - 100}
        min={-100}
        max={100}
        onChange={(v) => set({ saturation: Math.round(v) + 100 })}
      />
      <SliderField
        label="Размытие"
        value={f.blur}
        min={0}
        max={30}
        onChange={(v) => set({ blur: Math.round(v) })}
        display={(v) => `${Math.round(v)} px`}
      />
      <BtnRow>
        <button
          className="btn btn--sm"
          disabled={isFiltersDefault(f)}
          onClick={() => st().updateObject(obj.id, { filters: { ...DEFAULT_FILTERS } })}
        >
          Сбросить фильтры
        </button>
      </BtnRow>
    </>
  );
}

// ---------- Текст ----------

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

function TextSection({ obj }: { obj: TextObject }) {
  const tf = useTransientUpdate();
  const st = useEditor.getState;
  const sh = obj.shadow;

  return (
    <>
      <TextAreaField label="Текст" value={obj.text} rows={3} onChange={(v) => tf(obj.id, { text: v })} />
      <SelectField label="Шрифт" value={obj.fontFamily} options={FONT_OPTS} onChange={(v) => st().updateObject(obj.id, { fontFamily: v })} />
      <div className="grid-2">
        <NumField label="Размер" value={obj.fontSize} min={6} max={400} onChange={(v) => tf(obj.id, { fontSize: v })} />
        <NumField label="Ширина блока" value={obj.boxWidth} min={20} onChange={(v) => tf(obj.id, { boxWidth: v, width: v })} />
      </div>
      <BtnRow>
        <button className={`btn btn--sm${obj.fontWeight === 'bold' ? ' btn--active' : ''}`} onClick={() => st().updateObject(obj.id, { fontWeight: obj.fontWeight === 'bold' ? 'normal' : 'bold' })}>
          <b>Ж</b>
        </button>
        <button className={`btn btn--sm${obj.fontStyle === 'italic' ? ' btn--active' : ''}`} onClick={() => st().updateObject(obj.id, { fontStyle: obj.fontStyle === 'italic' ? 'normal' : 'italic' })}>
          <i>К</i>
        </button>
        <SelectField label="Регистр" value={obj.textTransform} options={TRANSFORM_OPTS} onChange={(v) => st().updateObject(obj.id, { textTransform: v })} />
      </BtnRow>
      <ColorField label="Цвет текста" value={obj.color} onChange={(v) => tf(obj.id, { color: v })} />
      <div className="grid-2">
        <ColorField label="Обводка" value={obj.strokeColor} onChange={(v) => tf(obj.id, { strokeColor: v })} />
        <NumField label="Толщина обводки" value={obj.strokeWidth} min={0} max={40} onChange={(v) => tf(obj.id, { strokeWidth: v })} />
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
          <ColorField label="Цвет тени" value={sh.color} onChange={(v) => tf(obj.id, { shadow: { ...sh, color: v } } as Partial<EditorObject>)} />
          <div className="grid-2">
            <NumField label="Сдвиг X" value={sh.offsetX} min={-60} max={60} onChange={(v) => tf(obj.id, { shadow: { ...sh, offsetX: v } } as Partial<EditorObject>)} />
            <NumField label="Сдвиг Y" value={sh.offsetY} min={-60} max={60} onChange={(v) => tf(obj.id, { shadow: { ...sh, offsetY: v } } as Partial<EditorObject>)} />
          </div>
          <SliderField label="Размытие тени" value={sh.blur} min={0} max={40} onChange={(v) => tf(obj.id, { shadow: { ...sh, blur: v } } as Partial<EditorObject>)} />
          <SliderField
            label="Плотность тени"
            value={Math.round(sh.opacity * 100)}
            min={0}
            max={100}
            onChange={(v) => tf(obj.id, { shadow: { ...sh, opacity: v / 100 } } as Partial<EditorObject>)}
            display={(v) => `${v}%`}
          />
        </>
      )}
      <SelectField label="Выравнивание" value={obj.align} options={ALIGN_OPTS} onChange={(v) => st().updateObject(obj.id, { align: v })} />
      <SliderField
        label="Межстрочный"
        value={obj.lineHeight}
        min={0.8}
        max={2}
        step={0.05}
        onChange={(v) => tf(obj.id, { lineHeight: v })}
      />
      <NumField label="Межбуквенный" value={obj.letterSpacing} min={-20} max={100} onChange={(v) => tf(obj.id, { letterSpacing: v })} />
      <BtnRow>
        <button className="btn btn--sm" onClick={() => st().updateObject(obj.id, { fontFamily: CAPTION_FONT, fontWeight: 'bold', textTransform: 'uppercase' })}>
          Мемный стиль
        </button>
      </BtnRow>
    </>
  );
}

// ---------- Баббл ----------

const SHAPE_OPTS: { value: BubbleShape; label: string }[] = [
  { value: 'rounded-rect', label: 'Скруглённый' },
  { value: 'ellipse', label: 'Овал' },
  { value: 'cloud', label: 'Облачко' },
  { value: 'shout', label: 'Крик' },
  { value: 'rect', label: 'Прямоугольник' },
];

function BubbleSection({ obj }: { obj: BubbleObject }) {
  const tf = useTransientUpdate();
  const st = useEditor.getState;
  const t = obj.text;

  return (
    <>
      <SelectField label="Форма" value={obj.shape} options={SHAPE_OPTS} onChange={(v) => st().updateObject(obj.id, { shape: v })} />
      <div className="grid-2">
        <ColorField label="Фон" value={obj.fill === 'rgba(0,0,0,0)' ? '#FFFFFF' : obj.fill} onChange={(v) => tf(obj.id, { fill: v })} />
        <ColorField label="Граница" value={obj.strokeColor} onChange={(v) => tf(obj.id, { strokeColor: v })} />
      </div>
      <div className="grid-2">
        <NumField label="Толщина границы" value={obj.strokeWidth} min={0} max={40} onChange={(v) => tf(obj.id, { strokeWidth: v })} />
        {obj.shape === 'rounded-rect' && (
          <NumField label="Радиус углов" value={obj.cornerRadius} min={0} max={200} onChange={(v) => tf(obj.id, { cornerRadius: v })} />
        )}
      </div>
      <NumField label="Отступ текста" value={obj.padding} min={0} max={120} onChange={(v) => tf(obj.id, { padding: v })} />
      <CheckField
        label="Хвостик"
        checked={obj.tail.enabled}
        onChange={(v) => st().replaceObject({ ...obj, tail: { ...obj.tail, enabled: v } })}
      />
      {obj.tail.enabled && (
        <>
          <div className="grid-2">
            <NumField label="Основание" value={obj.tail.baseWidth} min={6} max={120} onChange={(v) => tf(obj.id, { tail: { ...obj.tail, baseWidth: v } } as Partial<EditorObject>)} />
            <SliderField label="Кривизна" value={obj.tail.curve} min={0} max={1} step={0.05} onChange={(v) => tf(obj.id, { tail: { ...obj.tail, curve: v } } as Partial<EditorObject>)} />
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
      <TextAreaField label="Реплика" value={t.value} rows={2} onChange={(v) => tf(obj.id, { text: { ...t, value: v } } as Partial<EditorObject>)} />
      <SelectField label="Шрифт" value={t.fontFamily} options={FONT_OPTS} onChange={(v) => st().updateObject(obj.id, { text: { ...t, fontFamily: v } })} />
      <div className="grid-2">
        <NumField label="Размер" value={t.fontSize} min={6} max={200} onChange={(v) => tf(obj.id, { text: { ...t, fontSize: v } } as Partial<EditorObject>)} />
        <ColorField label="Цвет" value={t.color} onChange={(v) => tf(obj.id, { text: { ...t, color: v } } as Partial<EditorObject>)} />
      </div>
      <CheckField label="Жирный" checked={t.bold} onChange={(v) => st().updateObject(obj.id, { text: { ...t, bold: v } })} />
      <SelectField label="Выравнивание" value={t.align} options={ALIGN_OPTS} onChange={(v) => st().updateObject(obj.id, { text: { ...t, align: v } })} />
      <CheckField label="Автоподбор размера" checked={t.autoFit} onChange={(v) => st().updateObject(obj.id, { text: { ...t, autoFit: v } })} />
    </>
  );
}
