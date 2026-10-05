import { useEditor } from '../store/editorStore';
import { forceSave } from '../lib/autosave';
import { buildExportFile, parseImportFile, downloadBlob } from '../lib/projectIO';
import { translit, safeFileName } from '../lib/utils';
import { useUi } from '../store/uiStore';
import { useRef } from 'react';

export function TopBar() {
  const projectName = useEditor((s) => s.projectName);
  const saveStatus = useEditor((s) => s.saveStatus);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const openProjects = useUi((s) => s.openProjects);
  const openExport = useUi((s) => s.openExport);
  const importRef = useRef<HTMLInputElement | null>(null);

  const statusText =
    saveStatus === 'saved' ? 'Сохранено' : saveStatus === 'saving' ? 'Сохранение…' : 'Есть изменения';

  const exportProjectFile = async () => {
    const st = useEditor.getState();
    if (!st.projectId) {
      st.notify('Сначала создайте проект', 'error');
      return;
    }
    try {
      const { blob } = await buildExportFile(
        { id: st.projectId, name: st.projectName, createdAt: st.createdAt, updatedAt: st.updatedAt },
        st.canvas && { version: 1, canvas: st.canvas, objects: st.objects }
      );
      downloadBlob(blob, `${safeFileName(translit(st.projectName), 'project')}.supame.json`);
      st.notify('Проект сохранён в файл', 'success');
    } catch (err) {
      console.error(err);
      st.notify('Ошибка экспорта проекта', 'error');
    }
  };

  const importProjectFile = async (file: File) => {
    try {
      const rec = await parseImportFile(file);
      useEditor.getState().loadProjectRecord(rec);
      useEditor.getState().notify(`Проект «${rec.name}» импортирован`, 'success');
    } catch (err) {
      console.error(err);
      useEditor.getState().notify('Не удалось импортировать проект', 'error');
    }
  };

  return (
    <header className="topbar">
      <div className="topbar__brand">
        <span className="topbar__logo">SupaMe</span>
      </div>

      <button className="btn" onClick={() => useEditor.getState().newProject()}>
        Новый
      </button>
      <button className="btn" onClick={openProjects}>
        Проекты
      </button>

      <input
        className="topbar__name"
        value={projectName}
        onChange={(e) => useEditor.getState().setProjectName(e.target.value)}
        title="Название проекта"
        spellCheck={false}
      />

      <div className="topbar__sep" />

      <button className="btn btn--icon" disabled={!canUndo} onClick={() => useEditor.getState().undo()} title="Отменить (Ctrl+Z)">
        ↶
      </button>
      <button className="btn btn--icon" disabled={!canRedo} onClick={() => useEditor.getState().redo()} title="Повторить (Ctrl+Shift+Z)">
        ↷
      </button>

      <div className="topbar__sep" />

      <button className="btn" onClick={() => forceSave()} title="Сохранить (Ctrl+S)">
        Сохранить
      </button>
      <button className="btn btn--primary" onClick={openExport} title="Экспорт изображения (Ctrl+E)">
        Экспорт
      </button>
      <button className="btn" onClick={() => void exportProjectFile()} title="Скачать проект файлом">
        В файл
      </button>
      <button className="btn" onClick={() => importRef.current?.click()} title="Импорт проекта из файла">
        Из файла
      </button>
      <input
        ref={importRef}
        type="file"
        accept=".json,application/json"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void importProjectFile(f);
          e.target.value = '';
        }}
      />

      <span className={`topbar__status topbar__status--${saveStatus}`}>{statusText}</span>
    </header>
  );
}
