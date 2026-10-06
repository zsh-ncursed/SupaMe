// Состояние диалогов, оверлеев и инструментов рисования
import { create } from 'zustand';

export type ToolId =
  | 'select'    // выделение и перемещение
  | 'pencil'    // карандаш
  | 'pen'       // перо (сглаженная кривая)
  | 'line'      // линия
  | 'rect'      // прямоугольник
  | 'ellipse'   // овал
  | 'fill';     // заливка

export const TOOL_LABELS: Record<ToolId, string> = {
  select: 'Выделение (V)',
  pencil: 'Карандаш (P)',
  pen: 'Перо (N)',
  line: 'Линия (L)',
  rect: 'Прямоугольник (R)',
  ellipse: 'Овал (O)',
  fill: 'Заливка (F)',
};

export const SHAPE_TOOLS: ToolId[] = ['pencil', 'pen', 'line', 'rect', 'ellipse'];

interface UiState {
  projectsOpen: boolean;
  exportOpen: boolean;
  importOpen: boolean;
  // Инструменты рисования
  tool: ToolId;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  setTool: (t: ToolId) => void;
  setStrokeColor: (c: string) => void;
  setFillColor: (c: string) => void;
  setStrokeWidth: (w: number) => void;
  openProjects: () => void;
  closeProjects: () => void;
  openExport: () => void;
  closeExport: () => void;
  openImport: () => void;
  closeImport: () => void;
}

export const useUi = create<UiState>()((set) => ({
  projectsOpen: false,
  exportOpen: false,
  importOpen: false,
  tool: 'select',
  strokeColor: '#000000',
  fillColor: '#FFFFFF',
  strokeWidth: 6,
  setTool: (tool) => set({ tool }),
  setStrokeColor: (strokeColor) => set({ strokeColor }),
  setFillColor: (fillColor) => set({ fillColor }),
  setStrokeWidth: (strokeWidth) => set({ strokeWidth }),
  openProjects: () => set({ projectsOpen: true }),
  closeProjects: () => set({ projectsOpen: false }),
  openExport: () => set({ exportOpen: true }),
  closeExport: () => set({ exportOpen: false }),
  openImport: () => set({ importOpen: true }),
  closeImport: () => set({ importOpen: false }),
}));
