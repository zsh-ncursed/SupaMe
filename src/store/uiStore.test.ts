import { beforeEach, describe, expect, it } from 'vitest';
import { useUi, TOOL_LABELS, SHAPE_TOOLS } from './uiStore';
import type { ToolId } from './uiStore';
import { DEFAULT_STROKE_COLOR, DEFAULT_FILL_COLOR, DEFAULT_STROKE_WIDTH } from '../lib/config';

describe('uiStore', () => {
  beforeEach(() => {
    // Сброс к «нейтральному» состоянию
    useUi.setState({
      projectsOpen: false,
      exportOpen: false,
      importOpen: false,
      tool: 'select',
      strokeColor: DEFAULT_STROKE_COLOR,
      fillColor: DEFAULT_FILL_COLOR,
      strokeWidth: DEFAULT_STROKE_WIDTH,
    });
  });

  it('uses the documented neutral defaults', () => {
    const s = useUi.getState();
    expect(s.tool).toBe('select');
    expect(s.strokeColor).toBe('#000000');
    expect(s.fillColor).toBe('#FFFFFF');
    expect(s.strokeWidth).toBe(6);
    expect(s.projectsOpen).toBe(false);
    expect(s.exportOpen).toBe(false);
    expect(s.importOpen).toBe(false);
  });

  it('switches the drawing tool', () => {
    useUi.getState().setTool('pen');
    expect(useUi.getState().tool).toBe('pen');
  });

  it('updates paint settings', () => {
    useUi.getState().setStrokeColor('#ff0000');
    useUi.getState().setFillColor('#00ff00');
    useUi.getState().setStrokeWidth(12);
    const s = useUi.getState();
    expect(s.strokeColor).toBe('#ff0000');
    expect(s.fillColor).toBe('#00ff00');
    expect(s.strokeWidth).toBe(12);
  });

  it('opens and closes dialogs independently', () => {
    const st = useUi.getState;
    st().openProjects();
    expect(useUi.getState().projectsOpen).toBe(true);
    st().closeProjects();
    expect(useUi.getState().projectsOpen).toBe(false);

    st().openExport();
    expect(useUi.getState().exportOpen).toBe(true);
    st().closeExport();
    expect(useUi.getState().exportOpen).toBe(false);

    st().openImport();
    expect(useUi.getState().importOpen).toBe(true);
    st().closeImport();
    expect(useUi.getState().importOpen).toBe(false);
  });

  it('TOOL_LABELS covers every valid tool with a human label', () => {
    const tools = ['select', 'pencil', 'pen', 'line', 'rect', 'ellipse', 'fill'] as const;
    for (const t of tools) {
      expect(typeof TOOL_LABELS[t]).toBe('string');
      expect(TOOL_LABELS[t].length).toBeGreaterThan(0);
    }
    // в LABELS нет «мусорных» ключей (все они — валидные инструменты)
    for (const key of Object.keys(TOOL_LABELS) as ToolId[]) {
      expect((tools as readonly string[]).includes(key)).toBe(true);
    }
  });

  it('SHAPE_TOOLS lists exactly the drawing tools that produce a shape', () => {
    // SHAPE_TOOLS используются для «рисующего» состояния холста
    expect(SHAPE_TOOLS).toEqual(['pencil', 'pen', 'line', 'rect', 'ellipse']);
  });
});
