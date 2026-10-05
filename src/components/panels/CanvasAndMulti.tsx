// Панели «Холст» (ничего не выбрано) и мультивыделение
import { useRef } from 'react';
import { useEditor } from '../../store/editorStore';
import { SectionTitle, NumField, ColorField, CheckField, BtnRow } from '../fields';
import { CANVAS_PRESETS, MIN_CANVAS, MAX_CANVAS } from '../../types';
import type { EditorObject } from '../../types';
import { addAsset } from '../../db/assets';

export function CanvasPanel() {
  const canvas = useEditor((s) => s.canvas);
  const st = useEditor.getState;

  return (
    <div className="panel-section">
      <SectionTitle>Холст</SectionTitle>
      <div className="preset-grid">
        {CANVAS_PRESETS.map((p) => (
          <button key={p.label} className="btn btn--block" onClick={() => st().setCanvasSize(p.width, p.height)}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="grid-2">
        <NumField
          label="Ширина"
          value={canvas.width}
          min={MIN_CANVAS}
          max={MAX_CANVAS}
          onChange={(v) => st().setCanvasSize(v, canvas.height)}
        />
        <NumField
          label="Высота"
          value={canvas.height}
          min={MIN_CANVAS}
          max={MAX_CANVAS}
          onChange={(v) => st().setCanvasSize(canvas.width, v)}
        />
      </div>
      <ColorField
        label="Цвет фона"
        value={canvas.background.color}
        onChange={(c) => st().setBackground({ type: 'color', color: c })}
      />
      <label className="field field--check">
        <input
          type="checkbox"
          checked={canvas.background.transparent}
          onChange={(e) => st().setBackground({ transparent: e.target.checked })}
        />
        <span className="field__label">Прозрачный фон</span>
      </label>
      <BgImageControls />
      <div className="panel-note">Масштаб и «Вписать» — кнопки под холстом или колесо мыши</div>
    </div>
  );
}

function BgImageControls() {
  const canvas = useEditor((s) => s.canvas);
  const st = useEditor.getState;
  const inputRef = useRef<HTMLInputElement | null>(null);
  return (
    <div>
      <div className="field field--row">
        <button className="btn btn--sm" onClick={() => inputRef.current?.click()}>
          Фон-изображение
        </button>
        {canvas.background.type === 'image' && (
          <button
            className="btn btn--sm"
            onClick={() => st().setBackground({ type: 'color', assetId: undefined })}
          >
            Убрать фон
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try {
            const assetId = await addAsset(f, f.name, f.type);
            st().setBackground({ type: 'image', assetId, transparent: false });
            window.dispatchEvent(new Event('supame:assets-changed'));
          } catch {
            st().notify('Не удалось загрузить фон', 'error');
          }
          e.target.value = '';
        }}
      />
    </div>
  );
}

export function MultiPanel({ sel }: { sel: EditorObject[] }) {
  const st = useEditor.getState;
  const ids = sel.map((o) => o.id);
  return (
    <div className="panel-section">
      <SectionTitle>Выделено: {sel.length}</SectionTitle>
      <div className="align-grid">
        <button className="btn btn--sm" title="По левому краю" onClick={() => st().alignSelected('left')}>⭰</button>
        <button className="btn btn--sm" title="По центру гориз." onClick={() => st().alignSelected('hcenter')}>⭤</button>
        <button className="btn btn--sm" title="По правому краю" onClick={() => st().alignSelected('right')}>⭢</button>
        <button className="btn btn--sm" title="По верхнему краю" onClick={() => st().alignSelected('top')}>⭱</button>
        <button className="btn btn--sm" title="По центру вертикали" onClick={() => st().alignSelected('vcenter')}>⭥</button>
        <button className="btn btn--sm" title="По нижнему краю" onClick={() => st().alignSelected('bottom')}>⭣</button>
      </div>
      <div className="field--row">
        <button className="btn btn--sm" onClick={() => st().distributeSelected('h')}>
          Распределить ↔
        </button>
        <button className="btn btn--sm" onClick={() => st().distributeSelected('v')}>
          Распределить ↕
        </button>
      </div>
      <BtnRow>
        <button className="btn btn--sm" onClick={() => st().duplicateObjects(ids)}>
          Дублировать
        </button>
        <button className="btn btn--sm" onClick={() => st().deleteObjects(ids)}>
          Удалить
        </button>
      </BtnRow>
      <p className="panel-note">«Распределить» работает от трёх объектов</p>
    </div>
  );
}
