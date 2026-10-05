// Серия правок = одна запись в истории (для слайдеров, цветов, текста)
import { useRef } from 'react';
import { useEditor } from '../store/editorStore';
import type { EditorObject } from '../types';

export function useTransientUpdate() {
  const startedRef = useRef(false);
  const timerRef = useRef<number | undefined>(undefined);

  return (id: string, patch: Partial<EditorObject>) => {
    const st = useEditor.getState();
    if (!startedRef.current) {
      st.beginTransient();
      startedRef.current = true;
    }
    st.updateObject(id, patch, { history: false });
    if (timerRef.current !== undefined) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      st.endTransient();
      startedRef.current = false;
      timerRef.current = undefined;
    }, 700);
  };
}
