import { useEffect, useRef, useState } from 'react';
import { TopBar } from './components/TopBar';
import { LeftPanel } from './components/LeftPanel';
import { RightPanel } from './components/panels/RightPanel';
import { CanvasStage } from './components/CanvasStage';
import { StatusBar } from './components/StatusBar';
import { ProjectsDialog } from './components/dialogs/ProjectsDialog';
import { ExportDialog } from './components/dialogs/ExportDialog';
import { Toast } from './components/Toast';
import { Welcome } from './components/Welcome';
import { useEditor } from './store/editorStore';
import { useUi } from './store/uiStore';
import type { ToolId } from './store/uiStore';
import { startAutosave, forceSave } from './lib/autosave';
import { addImageFiles } from './lib/addObjects';

const ARROW_DEBOUNCE_MS = 500;

function moveSelected(dx: number, dy: number, step: number, timerRef: { current: number | undefined }) {
  const st = useEditor.getState();
  if (!st.selectedIds.length) return;
  if (timerRef.current === undefined) st.beginTransient();
  for (const id of st.selectedIds) {
    const o = st.objects.find((x) => x.id === id);
    if (!o || o.locked) continue;
    st.updateObject(id, { x: o.x + dx * step, y: o.y + dy * step }, { history: false });
  }
  if (timerRef.current !== undefined) window.clearTimeout(timerRef.current);
  timerRef.current = window.setTimeout(() => {
    useEditor.getState().endTransient();
    timerRef.current = undefined;
  }, ARROW_DEBOUNCE_MS);
}

export default function App() {
  const [fontsTick, setFontsTick] = useState(0);
  const arrowTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => startAutosave(), []);

  // Перерисовка после загрузки шрифтов (точные метрики текста)
  useEffect(() => {
    let alive = true;
    document.fonts.ready.then(() => {
      if (alive) setFontsTick((t) => t + 1);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Горячие клавиши
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) {
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      const st = useEditor.getState();

      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) st.redo();
        else st.undo();
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        st.redo();
      } else if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        forceSave();
      } else if (mod && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        useUi.getState().openExport();
      } else if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        st.duplicateObjects(st.selectedIds);
      } else if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        st.selectAll();
      } else if (mod && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        st.copySelected();
      } else if (mod && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        st.pasteClipboard();
      } else if (mod && e.key === ']') {
        e.preventDefault();
        st.moveLayer(st.selectedIds, 'up');
      } else if (mod && e.key === '[') {
        e.preventDefault();
        st.moveLayer(st.selectedIds, 'down');
      } else if (mod && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        st.setZoom(st.zoom * 1.2);
      } else if (mod && e.key === '-') {
        e.preventDefault();
        st.setZoom(st.zoom / 1.2);
      } else if (mod && e.key === '0') {
        e.preventDefault();
        st.setZoom(1);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (st.selectedIds.length) {
          e.preventDefault();
          st.deleteObjects(st.selectedIds);
        }
      } else if (e.key === 'Escape') {
        st.clearSelection();
        useUi.getState().setTool('select');
        useUi.getState().closeExport();
        useUi.getState().closeProjects();
      } else if (e.key.startsWith('Arrow')) {
        const dx = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
        const dy = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
        if (dx || dy) {
          e.preventDefault();
          moveSelected(dx, dy, e.shiftKey ? 10 : 1, arrowTimerRef);
        }
      } else if (!mod && !e.altKey && e.key.length === 1) {
        // Быстрый выбор инструмента (V, P, N, L, R, O, F)
        const toolKeys: Record<string, ToolId> = {
          v: 'select',
          p: 'pencil',
          n: 'pen',
          l: 'line',
          r: 'rect',
          o: 'ellipse',
          f: 'fill',
        };
        const t = toolKeys[e.key.toLowerCase()];
        if (t) useUi.getState().setTool(t);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (arrowTimerRef.current !== undefined) window.clearTimeout(arrowTimerRef.current);
    };
  }, []);

  // Вставка изображений из буфера обмена
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files: File[] = [];
      for (const item of e.clipboardData?.items ?? []) {
        if (item.kind === 'file') {
          const f = item.getAsFile();
          if (f && f.type.startsWith('image/')) files.push(f);
        }
      }
      if (files.length) {
        e.preventDefault();
        void addImageFiles(files);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  return (
    <div className="app">
      <TopBar />
      <div className="app__main">
        <LeftPanel />
        <main className="app__canvas">
          <CanvasStage key={`stage-${fontsTick}`} onPickImages={() => window.dispatchEvent(new Event('supame:open-file-dialog'))} />
        </main>
        <aside className="app__right">
          <RightPanel />
        </aside>
      </div>
      <StatusBar />
      <ProjectsDialog />
      <ExportDialog />
      <Toast />
      <Welcome />
    </div>
  );
}
