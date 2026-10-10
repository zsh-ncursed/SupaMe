// Диалог управления проектами (список, открытие, переименование, копия, удаление, импорт)
// Список строится на лёгких ProjectMeta (без загрузки Blob объектов); полный рекорд
// читается из IndexedDB только для действий: открыть / переименовать / копию.
import { useEffect, useRef, useState } from 'react';
import { useEditor } from '../../store/editorStore';
import { useUi } from '../../store/uiStore';
import {
  listProjectMeta,
  listProjects,
  getProject,
  putProject,
  putProjectMeta,
  deleteProject,
  deleteProjectMeta,
} from '../../db/idb';
import { scheduleCollectGarbage } from '../../db/gc';
import { parseImportFile } from '../../lib/projectIO';
import { formatDate, uid } from '../../lib/utils';
import type { ProjectMeta, ProjectRecord } from '../../types';

const META_FROM_RECORD = (rec: ProjectRecord): ProjectMeta => ({
  id: rec.id,
  name: rec.name,
  updatedAt: rec.updatedAt,
  width: rec.data.canvas.width,
  height: rec.data.canvas.height,
  objectCount: rec.data.objects.length,
  thumbnail: rec.thumbnail,
});

export function ProjectsDialog() {
  const open = useUi((s) => s.projectsOpen);
  const close = useUi((s) => s.closeProjects);
  const projectsVersion = useEditor((s) => s.projectsVersion);
  const currentId = useEditor((s) => s.projectId);
  const [items, setItems] = useState<ProjectMeta[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const importRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        let metas = await listProjectMeta();
        if (!metas.length) {
          // Однократная миграция после обновления хранилища: у старых проектов
          // ещё нет лёгких мет — достраиваем их из полных записей.
          const recs = await listProjects();
          await Promise.all(recs.map((r) => putProjectMeta(META_FROM_RECORD(r))));
          metas = recs.map(META_FROM_RECORD);
        }
        setItems(metas.sort((a, b) => b.updatedAt - a.updatedAt));
      } catch {
        setItems([]);
      }
    })();
  }, [open, projectsVersion]);

  if (!open) return null;

  const st = useEditor.getState;

  const openProject = async (meta: ProjectMeta) => {
    const rec = await getProject(meta.id);
    if (!rec) return;
    st().loadProjectRecord(rec);
    close();
  };

  const commitRename = async (meta: ProjectMeta) => {
    const name = editName.trim();
    setEditingId(null);
    if (!name || name === meta.name) return;
    const rec = await getProject(meta.id);
    if (!rec) return;
    const updated = { ...rec, name, updatedAt: Date.now() };
    await putProject(updated);
    await putProjectMeta(META_FROM_RECORD(updated));
    if (rec.id === st().projectId) st().setProjectName(name);
    st().bumpProjectsVersion();
  };

  const duplicate = async (meta: ProjectMeta) => {
    const rec = await getProject(meta.id);
    if (!rec) return;
    const copy = JSON.parse(JSON.stringify(rec)) as ProjectRecord;
    copy.id = uid();
    copy.name = `${meta.name} (копия)`;
    copy.createdAt = Date.now();
    copy.updatedAt = Date.now();
    await putProject(copy);
    await putProjectMeta(META_FROM_RECORD(copy));
    st().bumpProjectsVersion();
  };

  const remove = async (meta: ProjectMeta) => {
    if (!window.confirm(`Удалить проект «${meta.name}»? Действие необратимо.`)) return;
    await deleteProject(meta.id);
    await deleteProjectMeta(meta.id);
    st().bumpProjectsVersion();
    st().notify(`Проект «${meta.name}» удалён`);
    // Ассеты, на которые ссылался только удалённый проект, стали сиротами — почистить
    scheduleCollectGarbage();
  };

  const importFile = async (f: File) => {
    try {
      const rec = await parseImportFile(f);
      await putProject(rec);
      await putProjectMeta(META_FROM_RECORD(rec));
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
          {items.map((meta) => (
            <div
              key={meta.id}
              className={`project-card${meta.id === currentId ? ' project-card--current' : ''}`}
            >
              <div className="project-card__thumb">
                {meta.thumbnail ? (
                  <img src={meta.thumbnail} alt="" />
                ) : (
                  <span className="project-card__placeholder" />
                )}
              </div>
              <div className="project-card__info">
                {editingId === meta.id ? (
                  <input
                    className="field__input"
                    value={editName}
                    autoFocus
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void commitRename(meta);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                  />
                ) : (
                  <div className="project-card__name" title={meta.name}>
                    {meta.name}
                  </div>
                )}
                <div className="project-card__meta">
                  {formatDate(meta.updatedAt)} · {meta.width}×{meta.height} · объектов:{' '}
                  {meta.objectCount}
                </div>
              </div>
              <div className="project-card__actions">
                <button className="btn btn--sm btn--primary" onClick={() => void openProject(meta)}>
                  Открыть
                </button>
                <button
                  className="btn btn--sm"
                  onClick={() => {
                    setEditingId(meta.id);
                    setEditName(meta.name);
                  }}
                >
                  Переименовать
                </button>
                <button className="btn btn--sm" onClick={() => void duplicate(meta)}>
                  Копия
                </button>
                <button className="btn btn--sm btn--danger" onClick={() => void remove(meta)}>
                  Удалить
                </button>
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
