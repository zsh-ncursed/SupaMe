// Диспетчер панели свойств: общие свойства + секция по типу объекта.
// Каждая секция живёт в своём модуле (./object/*), чтобы файл оставался
// маленьким, а добавление нового типа объекта не разрастало его.
import { CommonSection, kindLabel } from './object/CommonSection';
import { ImageSection } from './object/ImageSection';
import { TextSection } from './object/TextSection';
import { BubbleSection } from './object/BubbleSection';
import { ShapeSection } from './object/ShapeSection';
import type { EditorObject } from '../../types';

export function ObjectPanel({ obj }: { obj: EditorObject }) {
  return (
    <div className="panel-section">
      <CommonSection obj={obj} />
      {obj.kind === 'image' && <ImageSection obj={obj} />}
      {obj.kind === 'text' && <TextSection obj={obj} />}
      {obj.kind === 'bubble' && <BubbleSection obj={obj} />}
      {obj.kind === 'shape' && <ShapeSection obj={obj} />}
    </div>
  );
}

export { kindLabel };
