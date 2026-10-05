// Контекстное меню правой кнопкой (ТЗ 5.13)
import { useEffect, useRef } from 'react';
import { useEditor } from '../store/editorStore';

export interface ContextMenuState {
  /** координаты для position: fixed */
  x: number;
  y: number;
  /** объект под курсором (null — пустое место холста) */
  targetId: string | null;
  /** есть что вставить из буфера */
  pasteable: boolean;
}

interface Props {
  menu: ContextMenuState | null;
  onClose: () => void;
}

export function ContextMenu({ menu, onClose }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menu) return;
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [menu, onClose]);

  if (!menu) return null;

  const st = useEditor.getState;
  const selected = st().selectedIds;
  // если кликнули по невыделенному объекту — работаем с ним одним
  const ids =
    menu.targetId && !selected.includes(menu.targetId) ? [menu.targetId] : selected;
  const obj = menu.targetId ? st().objects.find((o) => o.id === menu.targetId) : null;

  const run = (fn: () => void) => {
    fn();
    onClose();
  };

  const item = (label: string, enabled: boolean, fn: () => void) => (
    <button
      className="ctx-item"
      disabled={!enabled}
      onClick={() => run(fn)}
    >
      {label}
    </button>
  );

  return (
    <div className="ctx-menu" ref={ref} style={{ left: menu.x, top: menu.y }}>
      {item('Дублировать', ids.length > 0, () => st().duplicateObjects(ids))}
      {item('Копировать', ids.length > 0, () => st().copySelected())}
      {item('Вставить', menu.pasteable, () => st().pasteClipboard())}
      <div className="ctx-sep" />
      {item('Поднять на слой выше', ids.length > 0, () => st().moveLayer(ids, 'up'))}
      {item('Опустить на слой ниже', ids.length > 0, () => st().moveLayer(ids, 'down'))}
      {item('На передний план', ids.length > 0, () => st().moveLayer(ids, 'front'))}
      {item('На задний план', ids.length > 0, () => st().moveLayer(ids, 'back'))}
      {(obj || ids.length > 0) && <div className="ctx-sep" />}
      {obj &&
        item(
          obj.locked ? 'Разблокировать' : 'Заблокировать',
          true,
          () => st().updateObject(obj.id, { locked: !obj.locked })
        )}
      {obj &&
        item(
          obj.visible ? 'Скрыть' : 'Показать',
          true,
          () => st().updateObject(obj.id, { visible: !obj.visible })
        )}
      <div className="ctx-sep" />
      {item('Удалить', ids.length > 0, () => st().deleteObjects(ids))}
    </div>
  );
}
