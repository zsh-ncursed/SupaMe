import { useEffect, useRef, useState } from 'react';
import { useEditor } from '../store/editorStore';
import {
  addImageFiles,
  addTextObject,
  addCaption,
  addBubbleObject,
  bubblePresetLabel,
  addAssetObject,
} from '../lib/addObjects';
import { TEMPLATES, applyTemplate } from '../lib/templates';
import { listAssets } from '../db/idb';
import { useAsset } from '../db/assets';
import { PaintToolbar } from './PaintToolbar';
import { on } from '../lib/bus';
import type { BubbleShape, EditorObject } from '../types';

type Tab = 'images' | 'text' | 'bubbles' | 'templates' | 'layers';

const BUBBLE_SHAPES: BubbleShape[] = ['rounded-rect', 'ellipse', 'cloud', 'shout', 'rect'];

export function LeftPanel() {
  const [tab, setTab] = useState<Tab>('images');
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Пустое состояние на холсте открывает диалог через событие
  useEffect(() => {
    const handler = () => fileRef.current?.click();
    return on('open-file-dialog', handler);
  }, []);

  return (
    <aside className="leftpanel">
      <PaintToolbar />
      <div className="leftpanel__body">
        <nav className="tabs">
          <button
            className={`tabs__tab${tab === 'images' ? ' tabs__tab--active' : ''}`}
            onClick={() => setTab('images')}
            title="Фото"
          >
            🖼️
          </button>
          <button
            className={`tabs__tab${tab === 'text' ? ' tabs__tab--active' : ''}`}
            onClick={() => setTab('text')}
            title="Текст"
          >
            ✍️
          </button>
          <button
            className={`tabs__tab${tab === 'bubbles' ? ' tabs__tab--active' : ''}`}
            onClick={() => setTab('bubbles')}
            title="Бабблы"
          >
            💬
          </button>
          <button
            className={`tabs__tab${tab === 'templates' ? ' tabs__tab--active' : ''}`}
            onClick={() => setTab('templates')}
            title="Шаблоны"
          >
            🧩
          </button>
          <button
            className={`tabs__tab${tab === 'layers' ? ' tabs__tab--active' : ''}`}
            onClick={() => setTab('layers')}
            title="Слои"
          >
            <span className="icon-layers">
              <span />
              <span />
              <span />
            </span>
          </button>
        </nav>

        {tab === 'images' && <ImagesTab />}
        {tab === 'text' && <TextTab />}
        {tab === 'bubbles' && <BubblesTab />}
        {tab === 'templates' && <TemplatesTab />}
        {tab === 'layers' && <LayersTab />}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length) void addImageFiles(files);
            e.target.value = '';
          }}
        />
      </div>
    </aside>
  );
}

function ImagesTab() {
  const [assetList, setAssetList] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    const refresh = () => {
      listAssets()
        .then((recs) => setAssetList(recs.map((r) => ({ id: r.id, name: r.name }))))
        .catch(() => undefined);
    };
    refresh();
    return on('assets-changed', refresh);
  }, []);

  return (
    <div className="panel-section">
      <div className="assets-grid">
        {assetList.map((a) => (
          <AssetThumb key={a.id} id={a.id} />
        ))}
      </div>
      {!assetList.length && (
        <div className="panel-note">Загруженные изображения появятся здесь</div>
      )}
    </div>
  );
}

function AssetThumb({ id }: { id: string }) {
  const entry = useAsset(id);
  if (!entry) return null;
  return (
    <button
      className="asset-thumb"
      title={`Добавить на холст: ${entry.name}`}
      onClick={() => void addAssetObject(id)}
    >
      <img src={entry.url} alt={entry.name} />
    </button>
  );
}

function TextTab() {
  return (
    <div className="panel-section">
      <button className="btn btn--block" onClick={() => addTextObject()}>
        Добавить текст
      </button>
      <button className="btn btn--block" onClick={() => addCaption('top')}>
        Подпись сверху
      </button>
      <button className="btn btn--block" onClick={() => addCaption('bottom')}>
        Подпись снизу
      </button>
      <div className="panel-note">
        Подписи: жирный шрифт, белый текст с чёрной обводкой, по центру
      </div>
    </div>
  );
}

function BubblesTab() {
  return (
    <div className="panel-section">
      {BUBBLE_SHAPES.map((shape) => (
        <button key={shape} className="btn btn--block" onClick={() => addBubbleObject(shape)}>
          {bubblePresetLabel(shape)}
        </button>
      ))}
      <div className="panel-note">
        Хвостик баббла можно тянуть за синюю ручку (у выделенного баббла)
      </div>
    </div>
  );
}

function TemplatesTab() {
  const [busy, setBusy] = useState(false);
  return (
    <div className="panel-section">
      <div className="tpl-grid">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            className="tpl-card"
            disabled={busy !== null}
            onClick={() => {
              setBusy(true);
              void applyTemplate(t)
                .catch(() => useEditor.getState().notify('Не удалось применить шаблон', 'error'))
                .finally(() => setBusy(false));
            }}
          >
            <span className="tpl-preview">
              {t.preview.map((b, i) => (
                <span
                  key={i}
                  className="tpl-block"
                  style={{
                    left: `${b.x}%`,
                    top: `${b.y}%`,
                    width: `${b.w}%`,
                    height: `${b.h}%`,
                    background: b.color,
                  }}
                />
              ))}
            </span>
            <span className="tpl-name">{t.name}</span>
            <span className="tpl-hint">{t.hint}</span>
          </button>
        ))}
      </div>
      <div className="panel-note">
        Шаблон создаёт новый проект с заглушками — замените их своим изображением и текстом. Текущий
        проект останется в списке проектов.
      </div>
    </div>
  );
}

function LayersTab() {
  const objects = useEditor((s) => s.objects);
  return (
    <div className="panel-section layers">
      {objects.length === 0 && <div className="panel-note">Пока нет объектов</div>}
      {[...objects].reverse().map((o) => (
        <LayerRow key={o.id} obj={o} />
      ))}
    </div>
  );
}

function layerName(o: EditorObject): string {
  if (o.kind === 'image') return 'Изображение';
  if (o.kind === 'text') return `Текст: ${o.text.slice(0, 18) || '…'}`;
  if (o.kind === 'shape') {
    const names: Record<string, string> = {
      rect: 'Прямоугольник',
      ellipse: 'Овал',
      triangle: 'Треугольник',
      line: 'Линия',
      pencil: 'Карандаш',
      pen: 'Перо',
    };
    return names[o.shape] ?? 'Фигура';
  }
  return `Баббл: ${o.text.value.slice(0, 14) || '—'}`;
}

function LayerRow({ obj }: { obj: EditorObject }) {
  const selected = useEditor((s) => s.selectedIds.includes(obj.id));
  const st = useEditor.getState;
  return (
    <div
      className={`layer-row${selected ? ' layer-row--selected' : ''}${obj.locked ? ' layer-row--locked' : ''}`}
    >
      <button
        className="layer-row__main"
        title="Выбрать"
        onClick={(e) => {
          if (e.shiftKey) st().toggleSelect(obj.id);
          else st().select([obj.id]);
        }}
      >
        <span className="layer-row__icon">
          {obj.kind === 'image' ? '🖼' : obj.kind === 'text' ? 'T' : '💬'}
        </span>
        <span className="layer-row__name">{layerName(obj)}</span>
      </button>
      <button
        className="layer-row__btn"
        title={obj.visible ? 'Скрыть' : 'Показать'}
        onClick={() => st().updateObject(obj.id, { visible: !obj.visible })}
      >
        {obj.visible ? '👁' : '🚫'}
      </button>
      <button
        className="layer-row__btn"
        title={obj.locked ? 'Разблокировать' : 'Заблокировать'}
        onClick={() => st().updateObject(obj.id, { locked: !obj.locked })}
      >
        {obj.locked ? '🔒' : '🔓'}
      </button>
      <button
        className="layer-row__btn"
        title="Поднять слой"
        onClick={() => st().moveLayer([obj.id], 'up')}
      >
        ↑
      </button>
      <button
        className="layer-row__btn"
        title="Опустить слой"
        onClick={() => st().moveLayer([obj.id], 'down')}
      >
        ↓
      </button>
      <button
        className="layer-row__btn"
        title="Дублировать"
        onClick={() => st().duplicateObjects([obj.id])}
      >
        ⧉
      </button>
      <button
        className="layer-row__btn"
        title="Удалить"
        onClick={() => st().deleteObjects([obj.id])}
      >
        ✕
      </button>
    </div>
  );
}
