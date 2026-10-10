// Диалог управления проектами (список, открытие, переименование, копия, удаление, импорт)
import { useEffect, useRef, useState } from 'react';
import { useEditor } from '../../store/editorStore';
import { useUi } from '../../store/uiStore';
import { listProjects, putProject, deleteProject } from '../../db/idb';
import { scheduleCollectGarbage } from '../../db/gc';
import { parseImportFile } from '../../lib/projectIO';
import { formatDate, uid } from '../../lib/utils';
import type { ProjectRecord } from '../../types';

export function ProjectsDialog() {
  const open = useUi((s) => s.projectsOpen);
  const close = useUi((s) => s.closeProjects);
  const projectsVersion = useEditor((s) => s.projectsVersion);
  const currentId = useEditor((s) => s.projectId);
  const [items, setItems] = useState<ProjectRecord[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const importRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    listProjects()
      .then((recs) => setItems(recs.sort((a, b) => b.updatedAt - a.updatedAt)))
      .catch(() => setItems([]));
  }, [open, projectsVersion]);

  if (!open) return null;

  const st = useEditor.getState;

  const openProject = (rec: ProjectRecord) => {
    st().loadProjectRecord(rec);
    close();
  };

  const commitRename = async (rec: ProjectRecord) => {
    const name = editName.trim();
    setEditingId(null);
    if (!name || name === rec.name) return;
    await putProject({ ...rec, name, updatedAt: Date.now() });
    if (rec.id === st().projectId) st().setProjectName(name);
    st().bumpProjectsVersion();
  };

  const duplicate = async (rec: ProjectRecord) => {
    const copy = JSON.parse(JSON.stringify(rec)) as ProjectRecord;
    copy.id = uid();
    copy.name = `${rec.name} (копия)`;
    copy.createdAt = Date.now();
    copy.updatedAt = Date.now();
    await putProject(copy);
    st().bumpProjectsVersion();
  };

  const remove = async (rec: ProjectRecord) => {
    if (!window.confirm(`Удалить проект «${rec.name}»? Действие необратимо.`)) return;
    await deleteProject(rec.id);
    st().bumpProjectsVersion();
    st().notify(`Проект «${rec.name}» удалён`);
    // Ассеты, на которые ссылался только удалённый проект, стали сиротами — почистить
    scheduleCollectGarbage();
  };

  const importFile = async (f: File) => {
    try {
      const rec = await parseImportFile(f);
      await putProject(rec);
      st().bumpProjectsVersion();
      st().notify(`Проект «${rec.name}» импортирован`, 'success');
    } catch (err) {
      console.error(err);
      st().notify('Не удалось импортировать проект', 'error');
    }
  };

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="modal">
        <div className="modal__header">
          <h2>Проекты</h2>
          <button className="btn btn--icon" onClick={close} title="Закрыть">✕</button>
        </div>
        <div className="modal__actions">
          <button className="btn btn--primary" onClick={() => { st().newProject(); close(); }}>
            Новый проект
          </button>
          <button className="btn" onClick={() => importRef.current?.click()}>Импорт из файла</button>
        </div>
        <div className="modal__body project-list">
          {!items.length && <div className="panel-note">Сохранённых проектов пока нет</div>}
          {items.map((rec) => (
            <div key={rec.id} className={`project-card${rec.id === currentId ? ' project-card--current' : ''}`}>
              <div className="project-card__thumb">
                {rec.thumbnail ? <img src={rec.thumbnail} alt="" /> : <span className="project-card__placeholder" />}
              </div>
              <div className="project-card__info">
                {editingId === rec.id ? (
                  <input
                    className="field__input"
                    value={editName}
                    autoFocus
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void commitRename(rec);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                  />
                ) : (
                  <div className="project-card__name" title={rec.name}>{rec.name}</div>
                )}
                <div className="project-card__meta">
                  {formatDate(rec.updatedAt)} · {rec.data.canvas.width}×{rec.data.canvas.height} · объектов: {rec.data.objects.length}
                </div>
              </div>
              <div className="project-card__actions">
                <button className="btn btn--sm btn--primary" onClick={() => openProject(rec)}>Открыть</button>
                <button
                  className="btn btn--sm"
                  onClick={() => {
                    setEditingId(rec.id);
                    setEditName(rec.name);
                  }}
                >
                  Переименовать
                </button>
                <button className="btn btn--sm" onClick={() => void duplicate(rec)}>Копия</button>
                <button className="btn btn--sm btn--danger" onClick={() => void remove(rec)}>Удалить</button>
              </div>
            </div>
          ))}
        </div>
        <input
          ref={importRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importFile(f);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}
