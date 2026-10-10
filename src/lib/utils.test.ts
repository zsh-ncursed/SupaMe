import { describe, expect, it } from 'vitest';
import { clamp, safeFileName, translit, uid } from './utils';

describe('clamp', () => {
  it('keeps values inside bounds', () => {
    expect(clamp(50, 0, 100)).toBe(50);
  });
  it('clamps below the minimum', () => {
    expect(clamp(-5, 0, 100)).toBe(0);
  });
  it('clamps above the maximum', () => {
    expect(clamp(150, 0, 100)).toBe(100);
  });
  it('handles inverted bounds from real call sites', () => {
    const min = -Infinity;
    expect(clamp(30, min, Infinity)).toBe(30);
  });
});

describe('safeFileName', () => {
  it('strips illegal filename characters', () => {
    expect(safeFileName('My <Meme> "x"')).toBe('My_Meme_x');
  });
  it('replaces whitespace with underscores', () => {
    expect(safeFileName('a  b')).toBe('a_b');
  });
  it('returns the fallback for empty results', () => {
    expect(safeFileName('   ')).toBe('meme');
    expect(safeFileName('///', 'project')).toBe('project');
  });
});

describe('translit', () => {
  it('transliterates common Cyrillic, keeping spaces as-is', () => {
    expect(translit('АбВгД')).toBe('abvgd');
    expect(translit('Привет мир')).toBe('privet mir');
    expect(translit('Ж Щ Ч Ш Ы Э Ю Я')).toBe('zh sch ch sh y e yu ya');
  });
  it('leaves non-cyrillic characters unchanged', () => {
    expect(translit('ABC 123')).toBe('abc 123');
  });
});

describe('uid', () => {
  it('produces unique ids', () => {
    const a = uid();
    const b = uid();
    expect(a).not.toBe(b);
    expect(typeof a).toBe('string');
    expect(a.length).toBeGreaterThan(8);
  });
});
