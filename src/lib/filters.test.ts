import { describe, expect, it } from 'vitest';
import Konva from 'konva';
import {
  DEFAULT_FILTERS,
  filterPipeline,
  filterAttrs,
  normalizeFilters,
  isFiltersDefault,
} from './filters';

describe('filters model', () => {
  it('has documented neutral defaults', () => {
    expect(DEFAULT_FILTERS).toEqual({
      brightness: 100,
      contrast: 0,
      saturation: 100,
      blur: 0,
      grayscale: false,
      sepia: false,
    });
  });

  it('isFiltersDefault is true only for neutral filters', () => {
    expect(isFiltersDefault(DEFAULT_FILTERS)).toBe(true);
    expect(isFiltersDefault({ ...DEFAULT_FILTERS, blur: 2 })).toBe(false);
    expect(isFiltersDefault({ ...DEFAULT_FILTERS, grayscale: true })).toBe(false);
  });
});

describe('normalizeFilters', () => {
  it('returns defaults for undefined input', () => {
    expect(normalizeFilters(undefined)).toEqual(DEFAULT_FILTERS);
  });

  it('normalizes legacy model where contrast=100 meant neutral', () => {
    const legacy = { brightness: 100, contrast: 100, saturation: 100 };
    expect(normalizeFilters(legacy).contrast).toBe(0);
  });

  it('passes the current model through unchanged', () => {
    const curr = { brightness: 120, contrast: -30, saturation: 50, blur: 4, grayscale: true, sepia: false };
    expect(normalizeFilters(curr)).toEqual(curr);
  });
});

describe('filterPipeline', () => {
  it('produces an empty pipeline for neutral filters', () => {
    expect(filterPipeline(DEFAULT_FILTERS)).toEqual([]);
  });

  it('preserves a documented order for all filters combined', () => {
    const all = { brightness: 120, contrast: 10, saturation: 80, blur: 3, grayscale: true, sepia: true };
    const pipe = filterPipeline(all);
    expect(pipe).toEqual([
      Konva.Filters.Grayscale,
      Konva.Filters.Sepia,
      Konva.Filters.Brighten,
      Konva.Filters.Contrast,
      Konva.Filters.HSL,
      Konva.Filters.Blur,
    ]);
  });

  it('omits filters that are at neutral values', () => {
    const f = { ...DEFAULT_FILTERS, sepia: true };
    expect(filterPipeline(f)).toEqual([Konva.Filters.Sepia]);
  });
});

describe('filterAttrs', () => {
  it('maps model values to Konva attribute space', () => {
    const a = filterAttrs({ brightness: 150, contrast: -50, saturation: 50, blur: 5, grayscale: false, sepia: false });
    expect(a).toEqual({ brightness: 0.5, contrast: -50, saturation: 0.5, blurRadius: 5 });
  });
});
