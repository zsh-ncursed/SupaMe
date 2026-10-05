// Holder для ссылки на Konva.Stage (нужен экспорту изображений и превью)
import type Konva from 'konva';

let stageRef: Konva.Stage | null = null;

export function setStage(stage: Konva.Stage | null) {
  stageRef = stage;
}

export function getStage(): Konva.Stage | null {
  return stageRef;
}
