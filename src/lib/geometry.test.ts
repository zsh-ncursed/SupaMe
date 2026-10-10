import { describe, expect, it } from 'vitest';
import { boundaryPoint, snapEdge, snapLineAngle } from './geometry';

describe('snapLineAngle', () => {
  it('snaps a near-horizontal line to 0°', () => {
    const [x1, y1] = snapLineAngle(0, 0, 100, 3);
    expect(Math.round(x1)).toBe(100);
    expect(Math.round(y1)).toBe(0);
  });

  it('snaps near-45° to 45°', () => {
    const [x1, y1] = snapLineAngle(0, 0, 100, 96);
    expect(Math.round(x1)).toBe(98);
    expect(Math.round(y1)).toBe(98);
  });

  it('preserves the length of the snapped segment', () => {
    const [x1, y1] = snapLineAngle(0, 0, 30, 40);
    expect(Math.hypot(x1, y1)).toBeCloseTo(50, 6);
  });
});

describe('snapEdge', () => {
  it('returns null when nothing is within threshold', () => {
    expect(snapEdge([10, 90], [0, 50, 100], 6)).toBeNull();
  });

  it('returns the closest (edge, target) pair', () => {
    const r = snapEdge([4, 96], [0, 100], 6);
    expect(r).toEqual({ delta: -4, guide: 0 }); // 4→0 (первый найденный с |d|=4)
  });

  it('prefers a nearer target over an earlier edge', () => {
    const r = snapEdge([4, 7], [0, 10], 6);
    expect(r).toEqual({ delta: 3, guide: 10 }); // 7→10, |3| < |4|
  });

  it('handles exact matches with zero delta', () => {
    const r = snapEdge([0, 100], [0, 100], 6);
    expect(r).toEqual({ delta: 0, guide: 0 });
  });
});

describe('boundaryPoint', () => {
  it('hits the right edge of a rect on pure horizontal direction', () => {
    expect(boundaryPoint('rect', 100, 100, 1, 0)).toEqual({ x: 50, y: 0 });
  });

  it('hits the bottom edge of a rect on pure vertical direction', () => {
    expect(boundaryPoint('rounded-rect', 100, 100, 0, 1)).toEqual({ x: 0, y: 50 });
  });

  it('hits the corner of a square on the diagonal', () => {
    const p = boundaryPoint('rect', 100, 100, 1, 1);
    expect(p.x).toBeCloseTo(50, 6);
    expect(p.y).toBeCloseTo(50, 6);
  });

  it('uses ellipse approximation for ellipse/cloud/shout', () => {
    expect(boundaryPoint('ellipse', 100, 50, 1, 0)).toEqual({ x: 50, y: 0 });
    expect(boundaryPoint('cloud', 100, 50, 0, 1).y).toBeCloseTo(25, 6);
  });

  it('handles zero-length direction without division by zero', () => {
    const p = boundaryPoint('ellipse', 100, 50, 0, 0);
    expect(Number.isFinite(p.x)).toBe(true);
    expect(Number.isFinite(p.y)).toBe(true);
  });
});
