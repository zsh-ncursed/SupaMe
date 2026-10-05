// Диспетчер правой панели
import { useEditor } from '../../store/editorStore';
import { CanvasPanel, MultiPanel } from './CanvasAndMulti';
import { ObjectPanel } from './ObjectPanel';

export function RightPanel() {
  const selectedIds = useEditor((s) => s.selectedIds);
  const objects = useEditor((s) => s.objects);
  const sel = objects.filter((o) => selectedIds.includes(o.id));

  if (sel.length === 0) return <CanvasPanel />;
  if (sel.length > 1) return <MultiPanel sel={sel} />;
  return <ObjectPanel obj={sel[0]} />;
}
