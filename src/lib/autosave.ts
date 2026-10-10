// Автосохранение проекта в IndexedDB (по ТЗ 5.11.2: 1–3 сек после изменений)
// + надёжное сохранение при закрытии (код-ревью): beforeunload асинхронен,
// поэтому дополнительно ловим pagehide и visibilitychange->hidden — они срабатывают
// раньше и надёжнее в большинстве браузеров.
import { useEditor } from '../store/editorStore';
import { AUTOSAVE_DEBOUNCE_MS } from './config';
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
  }, AUTOSAVE_DEBOUNCE_MS);
}

export function startAutosave(): () => void {
  if (started) return () => undefined;
  started = true;
  const unsub = useEditor.subscribe((state) => {
    if (!state.projectId) return;
    if (state.saveStatus === 'dirty') schedule();
  });

  // Немедленный сброс при «уходе» страницы (частые тройные срабатывания
  // pagehide + visibilitychange + beforeunload — saveNow идемпотентен за счёт флага saving)
  const flush = () => {
    const st = useEditor.getState();
    if (st.projectId && st.saveStatus === 'dirty') {
      void saveNow();
    }
  };
  const onPageHide = () => flush();
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') flush();
  };
  window.addEventListener('pagehide', onPageHide);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('beforeunload', flush);

  return () => {
    unsub();
    window.removeEventListener('pagehide', onPageHide);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('beforeunload', flush);
    if (timer !== undefined) window.clearTimeout(timer);
    started = false;
  };
}

export function forceSave(): void {
  void saveNow();
}
