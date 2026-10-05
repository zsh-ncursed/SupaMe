// Автосохранение проекта в IndexedDB (по ТЗ 5.11.2: 1–3 сек после изменений)
import { useEditor } from '../store/editorStore';
import { putProject } from '../db/idb';
import { renderThumbnail } from './stageCapture';
import type { ProjectRecord } from '../types';

let timer: number | undefined;
let started = false;
let saving = false;
let pendingAgain = false;

async function saveNow(): Promise<void> {
  const st = useEditor.getState();
  if (!st.projectId || saving) {
    if (saving) pendingAgain = true;
    return;
  }
  saving = true;
  useEditor.getState().setSaveStatus('saving');
  try {
    const thumbnail = await renderThumbnail();
    const record: ProjectRecord = {
      id: st.projectId,
      name: st.projectName,
      createdAt: st.createdAt,
      updatedAt: Date.now(),
      thumbnail,
      data: {
        version: 1,
        canvas: JSON.parse(JSON.stringify(st.canvas)),
        objects: JSON.parse(JSON.stringify(st.objects)),
      },
    };
    await putProject(record);
    const cur = useEditor.getState();
    if (cur.projectId === st.projectId) {
      useEditor.getState().setSaveStatus('saved');
    }
  } catch (err) {
    console.error('Ошибка сохранения', err);
    useEditor.getState().notify('Ошибка сохранения проекта', 'error');
    useEditor.getState().setSaveStatus('dirty');
  } finally {
    saving = false;
    if (pendingAgain) {
      pendingAgain = false;
      schedule();
    }
  }
}

function schedule() {
  if (timer !== undefined) window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    timer = undefined;
    void saveNow();
  }, 1200);
}

export function startAutosave(): () => void {
  if (started) return () => undefined;
  started = true;
  const unsub = useEditor.subscribe((state) => {
    if (!state.projectId) return;
    if (state.saveStatus === 'dirty') schedule();
  });

  const onBeforeUnload = () => {
    const st = useEditor.getState();
    if (st.projectId && st.saveStatus === 'dirty') {
      void saveNow();
    }
  };
  window.addEventListener('beforeunload', onBeforeUnload);

  return () => {
    unsub();
    window.removeEventListener('beforeunload', onBeforeUnload);
    if (timer !== undefined) window.clearTimeout(timer);
    started = false;
  };
}

export function forceSave(): void {
  void saveNow();
}
