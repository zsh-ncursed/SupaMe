import { describe, expect, it } from 'vitest';
import { getStage, setStage } from './stageHolder';

describe('stageHolder', () => {
  it('stores and returns the stage reference', () => {
    const fake = { isStage: true } as never;
    setStage(fake);
    expect(getStage()).toBe(fake);
  });

  it('returns null before a stage is set and when cleared', () => {
    setStage(null);
    expect(getStage()).toBeNull();
  });
});
