// Диалог экспорта изображения
import { useEffect, useState } from 'react';
import { useEditor } from '../../store/editorStore';
import { useUi } from '../../store/uiStore';
import { exportCanvas } from '../../lib/stageCapture';
import { downloadBlob } from '../../lib/projectIO';
import { safeFileName, translit } from '../../lib/utils';

type Fmt = 'png' | 'jpeg' | 'webp';

export function ExportDialog() {
  const open = useUi((s) => s.exportOpen);
  const close = useUi((s) => s.closeExport);
  const canvas = useEditor((s) => s.canvas);
  const projectName = useEditor((s) => s.projectName);

  const [format, setFormat] = useState<Fmt>('png');
  const [scale, setScale] = useState(1);
  const [quality, setQuality] = useState(92);
  const [transparent, setTransparent] = useState(false);
  const [name, setName] = useState('meme');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setName(safeFileName(translit(projectName), 'meme'));
  }, [open, projectName]);

  if (!open) return null;

  const st = useEditor.getState;

  const doExport = async () => {
    setBusy(true);
    try {
      const url = await exportCanvas({
        format,
        scale,
        quality: quality / 100,
        transparent: format !== 'jpeg' && transparent,
      });
      if (!url) throw new Error('Холст недоступен');
      const blob = await (await fetch(url)).blob();
      downloadBlob(blob, `${name || 'meme'}.${format}`);
      st().notify('Изображение сохранено', 'success');
      close();
    } catch (err) {
      console.error(err);
      st().notify('Ошибка экспорта', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="modal modal--narrow">
        <div className="modal__header">
          <h2>Экспорт изображения</h2>
          <button className="btn btn--icon" onClick={close}>✕</button>
        </div>
        <div className="modal__body">
          <label className="field">
            <span className="field__label">Формат</span>
            <select className="field__input" value={format} onChange={(e) => setFormat(e.target.value as Fmt)}>
              <option value="png">PNG</option>
              <option value="jpeg">JPEG</option>
              <option value="webp">WebP</option>
            </select>
          </label>
          <label className="field">
            <span className="field__label">Масштаб</span>
            <select className="field__input" value={scale} onChange={(e) => setScale(parseFloat(e.target.value))}>
              <option value={1}>1×</option>
              <option value={2}>2×</option>
              <option value={3}>3×</option>
            </select>
          </label>
          {format !== 'png' && (
            <label className="field field--slider">
              <span className="field__label">Качество</span>
              <input type="range" min={30} max={100} value={quality} onChange={(e) => setQuality(parseInt(e.target.value, 10))} />
              <span className="field__value">{quality}%</span>
            </label>
          )}
          {format !== 'jpeg' && (
            <label className="field field--check">
              <input type="checkbox" checked={transparent} onChange={(e) => setTransparent(e.target.checked)} />
              <span className="field__label">Прозрачный фон</span>
            </label>
          )}
          <label className="field">
            <span className="field__label">Имя файла</span>
            <input className="field__input" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <div className="panel-note">
            Итог: {canvas.width * scale} × {canvas.height * scale} px
          </div>
        </div>
        <div className="modal__actions modal__actions--end">
          <button className="btn" onClick={close}>Отмена</button>
          <button className="btn btn--primary" disabled={busy} onClick={() => void doExport()}>
            {busy ? 'Экспорт…' : 'Экспорт'}
          </button>
        </div>
      </div>
    </div>
  );
}
