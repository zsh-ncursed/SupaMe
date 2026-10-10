// Зум холста к курсору (колесо) и расчёт масштаба «Вписать».
import { useEffect, type RefObject } from 'react';
import { useEditor } from '../../store/editorStore';
import { clamp } from '../../lib/utils';
import { ZOOM_MIN, ZOOM_MAX, ZOOM_STEP } from '../../lib/config';

/** Подписка на wheel с зумом к курсору (с учётом прокрутки контейнера) */
export function useStageZoom(ref: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const st = useEditor.getState();
      const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      const nz = clamp(st.zoom * factor, ZOOM_MIN, ZOOM_MAX);
      const ratio = nz / st.zoom;
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const sl = el.scrollLeft;
      const stp = el.scrollTop;
      st.setZoom(nz);
      requestAnimationFrame(() => {
        el.scrollLeft = (sl + cx) * ratio - cx;
        el.scrollTop = (stp + cy) * ratio - cy;
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [ref]);
}

/** Масштаб «Вписать»: чтобы холст с полями 24px поместился в контейнер */
export function calcZoomFit(boxW: number, boxH: number, canvasW: number, canvasH: number): number {
  return Math.min((boxW - 48) / canvasW, (boxH - 48) / canvasH);
}
