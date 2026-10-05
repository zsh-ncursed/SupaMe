// Реестр Konva-нод объектов: нужен трансформеру и экспорту
import type Konva from 'konva';

const refs = new Map<string, Konva.Node>();

export function registerNode(id: string, node: Konva.Node | null) {
  if (node) refs.set(id, node);
  else refs.delete(id);
}

export function getNode(id: string): Konva.Node | undefined {
  return refs.get(id);
}

export function clearNodes() {
  refs.clear();
}
