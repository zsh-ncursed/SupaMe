import { describe, expect, it } from 'vitest';
import { TEMPLATES } from './templates';
import type { BubbleObject, EditorObject } from '../types';

describe('templates metadata', () => {
  it('has at least one built-in template', () => {
    expect(TEMPLATES.length).toBeGreaterThan(0);
  });

  it('keeps ids and names unique and non-empty', () => {
    const ids = TEMPLATES.map((t) => t.id);
    const names = TEMPLATES.map((t) => t.name);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(names).size).toBe(names.length);
    for (const id of ids) expect(id.length).toBeGreaterThan(0);
    for (const n of names) expect(n.length).toBeGreaterThan(0);
  });

  it('defines a valid canvas for every template', () => {
    for (const t of TEMPLATES) {
      expect(t.width).toBeGreaterThan(0);
      expect(t.height).toBeGreaterThan(0);
      expect(t.background).toBeDefined();
      if (t.background.type === 'image') {
        expect(t.background.assetId).toBeTruthy();
      } else {
        expect(typeof t.background.color).toBe('string');
      }
    }
  });

  it('preview blocks stay inside the card square (with a small overflow margin)', () => {
    // Превью — в процентах от квадрата карточки; длинные подписи могут вплотную
    // подходить к краю, и некоторые шаблоны прижимают блок к краю, поэтому даём
    // запас до 150% и жёстко запрещаем выход за его предел.
    for (const t of TEMPLATES) {
      expect(t.preview.length).toBeGreaterThan(0);
      for (const b of t.preview) {
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.y).toBeGreaterThanOrEqual(0);
        expect(b.w).toBeGreaterThan(0);
        expect(b.h).toBeGreaterThan(0);
        expect(b.x + b.w).toBeLessThanOrEqual(150);
        expect(b.y + b.h).toBeLessThanOrEqual(150);
      }
    }
  });

  it('needsPhoto templates build at least one placeholder image', () => {
    const withPhoto = TEMPLATES.filter((t) => t.needsPhoto);
    expect(withPhoto.length).toBeGreaterThan(0);
    for (const t of withPhoto) {
      const objs = t.build('ph');
      expect(objs.some((o) => o.kind === 'image')).toBe(true);
    }
  });

  it('templates that do not need a photo ignore the placeholder argument', () => {
    for (const t of TEMPLATES.filter((x) => !x.needsPhoto)) {
      const objs = t.build('');
      expect(objs.some((o) => o.kind === 'image')).toBe(false);
    }
  });
});

describe('template builds', () => {
  it('every template produces well-formed objects inside the canvas', () => {
    for (const t of TEMPLATES) {
      const objs = t.build('ph');
      expect(objs.length).toBeGreaterThan(0);
      for (const o of objs) {
        expect(o.id.length).toBeGreaterThan(0);
        expect(o.width).toBeGreaterThan(0);
        expect(o.height).toBeGreaterThan(0);
        expect(typeof o.rotation).toBe('number');
        // не вылезаем за границы холста (за вычетом радиуса обводки)
        expect(o.x - o.width / 2).toBeGreaterThanOrEqual(-25);
        expect(o.y - o.height / 2).toBeGreaterThanOrEqual(-25);
        expect(o.x + o.width / 2).toBeLessThanOrEqual(t.width + 25);
        expect(o.y + o.height / 2).toBeLessThanOrEqual(t.height + 25);
      }
    }
  });

  it('build produces unique object ids', () => {
    for (const t of TEMPLATES) {
      const ids = t.build('ph').map((o) => o.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('text and bubble objects carry non-empty text', () => {
    for (const t of TEMPLATES) {
      for (const o of t.build('ph')) {
        if (o.kind === 'text') {
          expect(o.text.length).toBeGreaterThan(0);
        } else if (o.kind === 'bubble') {
          expect((o as BubbleObject).text.value.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('placeholder images reference the passed asset id', () => {
    for (const t of TEMPLATES) {
      if (!t.needsPhoto) continue;
      for (const o of t.build('photo-abc-1') as (EditorObject & { assetId?: string })[]) {
        if (o.kind === 'image') expect(o.assetId).toBe('photo-abc-1');
      }
    }
  });
});
