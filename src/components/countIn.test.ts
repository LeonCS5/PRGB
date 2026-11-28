import { describe, expect, it } from 'vitest';
import {
  COUNT_IN_MS, COUNT_IN_OPACITY_END, COUNT_IN_OPACITY_START,
  countInOpacity, countInRemainingMs, countInSecondsLeft, countInStartPositionMs
} from './countIn';

describe('count-in', () => {
  it('starts with the whole count ahead, in song time, at any speed', () => {
    expect(countInStartPositionMs(COUNT_IN_MS, 1)).toBe(-5000);
    expect(countInStartPositionMs(COUNT_IN_MS, 0.5)).toBe(-2500);
    expect(countInStartPositionMs(COUNT_IN_MS, 2)).toBe(-10000);
  });

  it('counts real seconds whatever the speed', () => {
    for (const speed of [0.25, 0.5, 1, 1.5, 2]) {
      const start = countInStartPositionMs(COUNT_IN_MS, speed);
      expect(countInRemainingMs(start, speed)).toBeCloseTo(5000);
      expect(countInSecondsLeft(start, speed)).toBe(5);
      expect(countInSecondsLeft(start * 0.2 + 1, speed)).toBe(1);
    }
    expect(countInSecondsLeft(0, 1)).toBe(0);
    expect(countInSecondsLeft(300, 1)).toBe(0);
  });

  it('fades from discreet to almost gone and is removed when the music begins', () => {
    expect(countInOpacity(5000, 5000)).toBeCloseTo(COUNT_IN_OPACITY_START);
    expect(COUNT_IN_OPACITY_START).toBeLessThan(0.7);
    const samples = [5000, 4000, 3000, 2000, 1000, 100].map((left) => countInOpacity(left, 5000));
    for (let i = 1; i < samples.length; i++) expect(samples[i]).toBeLessThan(samples[i - 1]);
    expect(samples[samples.length - 1]).toBeGreaterThan(COUNT_IN_OPACITY_END);
    expect(countInOpacity(0, 5000)).toBe(0);
    expect(countInOpacity(-10, 5000)).toBe(0);
    expect(countInOpacity(7000, 5000)).toBeCloseTo(COUNT_IN_OPACITY_START);
  });

  it('copes with a count of 3 s (the next exercise of a session)', () => {
    expect(countInOpacity(3000, 3000)).toBeCloseTo(COUNT_IN_OPACITY_START);
    expect(countInOpacity(1500, 3000)).toBeCloseTo((COUNT_IN_OPACITY_START + COUNT_IN_OPACITY_END) / 2);
  });
});
