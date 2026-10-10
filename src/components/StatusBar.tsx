import { useEditor } from '../store/editorStore';

export function StatusBar() {
  const canvas = useEditor((s) => s.canvas);
  const zoom = useEditor((s) => s.zoom);
  const objects = useEditor((s) => s.objects);
  const saveStatus = useEditor((s) => s.saveStatus);
  const selectedCount = useEditor((s) => s.selectedIds.length);

  return (
    <footer className="statusbar">
      <span>
        Холст: {canvas.width} × {canvas.height}
      </span>
      <span>Масштаб: {Math.round(zoom * 100)}%</span>
      <span>
        Объектов: {objects.length}
        {selectedCount ? ` · выделено: ${selectedCount}` : ''}
      </span>
      <span className="statusbar__spacer" />
      <span className={`statusbar__save statusbar__save--${saveStatus}`}>
        {saveStatus === 'saved'
          ? 'Все изменения сохранены'
          : saveStatus === 'saving'
            ? 'Сохранение…'
            : 'Не сохранено'}
      </span>
      <span className="statusbar__hint">Колесо — масштаб · Del — удалить · Ctrl+Z — отменить</span>
    </footer>
  );
}
