// Состояние диалогов и оверлеев интерфейса
import { create } from 'zustand';

interface UiState {
  projectsOpen: boolean;
  exportOpen: boolean;
  importOpen: boolean;
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
  openProjects: () => set({ projectsOpen: true }),
  closeProjects: () => set({ projectsOpen: false }),
  openExport: () => set({ exportOpen: true }),
  closeExport: () => set({ exportOpen: false }),
  openImport: () => set({ importOpen: true }),
  closeImport: () => set({ importOpen: false }),
}));
