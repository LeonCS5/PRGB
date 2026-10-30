import { describe, expect, it } from 'vitest';
import {
  COMBO_STEP,
  GOOD_POINTS,
  MAX_MULTIPLIER,
  PERFECT_POINTS,
  countScorableNotes,
  isScorable,
  maxPossibleScore
} from './scoreLimits.ts';

// Literal transcription of the game's scoring: the k-th consecutive hit (0-based) earns 150 × min(4, ⌊k/5⌋ + 1)
const naiveMax = (n: number): number => {
  let total = 0;
  for (let k = 0; k < n; k++) total += 150 * Math.min(4, Math.floor(k / 5) + 1);
  return total;
};

describe('scoring constants', () => {
  it('match the game rules', () => {
    expect([PERFECT_POINTS, GOOD_POINTS, COMBO_STEP, MAX_MULTIPLIER]).toEqual([150, 100, 5, 4]);
  });
});

describe('isScorable / countScorableNotes', () => {
  it('skips dead and grace notes but keeps ghost and regular ones', () => {
    const notes = [{}, { dead: true }, { grace: true }, { dead: false, grace: false }, { dead: true, grace: true }];
    expect(notes.map(isScorable)).toEqual([true, false, false, true, false]);
    expect(countScorableNotes(notes)).toBe(2);
    expect(countScorableNotes([])).toBe(0);
  });
});

describe('maxPossibleScore', () => {
  it('matches the naive sum for every count up to 500', () => {
    for (let n = 0; n <= 500; n++) expect(maxPossibleScore(n), `n = ${n}`).toBe(naiveMax(n));
  });

  it('handles the multiplier steps', () => {
    expect(maxPossibleScore(0)).toBe(0);
    expect(maxPossibleScore(1)).toBe(150);
    expect(maxPossibleScore(5)).toBe(750);
    expect(maxPossibleScore(6)).toBe(750 + 300);
    expect(maxPossibleScore(15)).toBe(750 + 1500 + 2250);
    expect(maxPossibleScore(16)).toBe(4500 + 600);
    expect(maxPossibleScore(10_000)).toBe(naiveMax(10_000));
  });

  it('rejects counts that are not non-negative integers', () => {
    for (const bad of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => maxPossibleScore(bad)).toThrow(RangeError);
    }
  });
});
