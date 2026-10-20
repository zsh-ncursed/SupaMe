// Свойства изображения: размер, отражение, обрезка, фильтры
import { useEditor } from '../../../store/editorStore';
import { useAsset } from '../../../db/assets';
import { useTransientUpdate } from '../../useTransientUpdate';
import { NumField, BtnRow, SectionTitle, SliderField, CheckField } from '../../fields';
import { normalizeFilters, isFiltersDefault, DEFAULT_FILTERS } from '../../../lib/filters';
import type { ImageObject, EditorObject, ImageFilters } from '../../../types';

export function ImageSection({ obj }: { obj: ImageObject }) {
  const tf = useTransientUpdate();
  const st = useEditor.getState;
  const entry = useAsset(obj.assetId);
  const natW = entry?.width ?? 0;
  const natH = entry?.height ?? 0;

  return (
    <>
      <div className="grid-2">
        <NumField
          label="Ширина"
          value={obj.width}
          min={8}
          onChange={(v) => tf(obj.id, { width: v, height: Math.round(v / (natW / natH || 1)) })}
        />
        <NumField
          label="Высота"
          value={obj.height}
          min={8}
          onChange={(v) => tf(obj.id, { height: v, width: Math.round(v * (natW / natH || 1)) })}
        />
      </div>
      <BtnRow>
        <button
          className="btn btn--sm"
          onClick={() => st().updateObject(obj.id, { flipX: !obj.flipX })}
        >
          ⇋ Отразить ↔
        </button>
        <button
          className="btn btn--sm"
          onClick={() => st().updateObject(obj.id, { flipY: !obj.flipY })}
        >
          ⇅ Отразить ↕
        </button>
      </BtnRow>
      <SectionTitle>Обрезка</SectionTitle>
      {obj.crop && natW > 0 ? (
        <>
          <div className="grid-2">
            <NumField
              label="X"
              value={obj.crop.x}
              min={0}
              max={natW - 1}
              onChange={(v) =>
                tf(obj.id, {
                  crop: { ...obj.crop, x: v, width: Math.min(obj.crop!.width, natW - v) },
                } as Partial<EditorObject>)
              }
            />
            <NumField
              label="Y"
              value={obj.crop.y}
              min={0}
              max={natH - 1}
              onChange={(v) =>
                tf(obj.id, {
                  crop: { ...obj.crop, y: v, height: Math.min(obj.crop!.height, natH - v) },
                } as Partial<EditorObject>)
              }
            />
            <NumField
              label="Ширина"
              value={obj.crop.width}
              min={1}
              max={natW}
              onChange={(v) =>
                tf(obj.id, { crop: { ...obj.crop, width: v } } as Partial<EditorObject>)
              }
            />
            <NumField
              label="Высота"
              value={obj.crop.height}
              min={1}
              max={natH}
              onChange={(v) =>
                tf(obj.id, { crop: { ...obj.crop, height: v } } as Partial<EditorObject>)
              }
            />
          </div>
          <BtnRow>
            <button
              className="btn btn--sm"
              onClick={() => st().updateObject(obj.id, { crop: null })}
            >
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

export function FiltersSection({ obj }: { obj: ImageObject }) {
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
