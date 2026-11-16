import { describe, expect, it } from 'vitest';
import { exerciseSongId } from './exerciseIds';
import { isRankableSongId } from './rankable';

describe('isRankableSongId', () => {
  it('accepts the seeded demo', () => {
    expect(isRankableSongId(-1)).toBe(true);
  });

  it('rejects catalog songs, bundled exercises and invalid ids', () => {
    expect(isRankableSongId(1)).toBe(false);
    expect(isRankableSongId(123456)).toBe(false);
    expect(isRankableSongId(0)).toBe(false);
    expect(isRankableSongId(exerciseSongId(0, 0))).toBe(false);
    expect(isRankableSongId(-2)).toBe(false);
    expect(isRankableSongId(Number.NaN)).toBe(false);
  });
});
