import { useEffect } from 'react';
import { useEditor } from '../store/editorStore';
import { TOAST_DURATION_MS } from '../lib/config';

export function Toast() {
  const toast = useEditor((s) => s.toast);
  const closeToast = useEditor((s) => s.closeToast);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => closeToast(), TOAST_DURATION_MS);
    return () => window.clearTimeout(t);
  }, [toast?.id, closeToast, toast]);

  if (!toast) return null;

  return (
    <div className={`toast toast--${toast.type}`} role="status">
      <span>{toast.text}</span>
      <button className="toast__close" onClick={closeToast} aria-label="Закрыть">
        ×
      </button>
    </div>
  );
}
