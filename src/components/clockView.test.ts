import { describe, expect, it } from 'vitest';
import { COUNT_IN_MS, countInOpacity } from './countIn';
import { clockViewOf, formatClock, positionValueText, sameClockView } from './clockView';
import { beatLineColor } from './practiceLanes';

describe('clockViewOf', () => {
  it('shows the count before the run and the whole second of the clock', () => {
    const view = clockViewOf(-4200, 1, COUNT_IN_MS);
    expect(view).toMatchObject({ before: true, atStart: false, second: 0, countSecondsLeft: 5 });
    expect(view.countOpacity).toBeCloseTo(countInOpacity(4200, COUNT_IN_MS));
    expect(clockViewOf(0, 1, COUNT_IN_MS)).toMatchObject({ before: false, atStart: true, second: 0, countSecondsLeft: 0 });
    expect(clockViewOf(12999, 1, COUNT_IN_MS).second).toBe(12);
  });

  it('counts the real time of the count whatever the speed', () => {
    expect(clockViewOf(-5000 * 0.25, 0.25, COUNT_IN_MS).countSecondsLeft).toBe(5);
    expect(clockViewOf(-5000 * 2, 2, COUNT_IN_MS).countSecondsLeft).toBe(5);
  });
});

describe('sameClockView', () => {
  // The point of the whole change: the frames of one second must not ask React for a render
  it('is the same view for every frame inside a second, in play and in the count', () => {
    let renders = 0;
    let last = clockViewOf(1000, 1, COUNT_IN_MS);
    for (let ms = 1000; ms < 4000; ms += 16.7) {
      const view = clockViewOf(ms, 1, COUNT_IN_MS);
      if (!sameClockView(view, last)) { renders++; last = view; }
    }
    expect(renders).toBe(2); // 1 → 2 → 3 s: a render per shown second, not one per frame (about 180)

    renders = 0;
    last = clockViewOf(-5000, 1, COUNT_IN_MS);
    for (let ms = -5000; ms < 0; ms += 16.7) {
      const view = clockViewOf(ms, 1, COUNT_IN_MS);
      if (!sameClockView(view, last)) { renders++; last = view; }
    }
    expect(renders).toBeLessThanOrEqual(5);
  });

  it('notices the clock leaving the count and the start', () => {
    expect(sameClockView(clockViewOf(-1, 1, COUNT_IN_MS), clockViewOf(0, 1, COUNT_IN_MS))).toBe(false);
    expect(sameClockView(clockViewOf(0, 1, COUNT_IN_MS), clockViewOf(1, 1, COUNT_IN_MS))).toBe(false);
  });
});

describe('beatLineColor', () => {
  it('reuses the same strings: nothing is built per frame', () => {
    expect(beatLineColor(true, 0.8)).toBe(beatLineColor(true, 0.8));
    expect(beatLineColor(false, 1)).toBe('rgba(255, 255, 255, 0.050)');
  });

  it('is brighter near the line, for accents more than for plain beats, and stays inside the table', () => {
    expect(beatLineColor(true, 1)).toBe('rgba(255, 255, 255, 0.140)');
    expect(beatLineColor(true, 0.55)).toBe('rgba(255, 255, 255, 0.077)');
    expect(beatLineColor(true, 0)).toBe(beatLineColor(true, 0.55));
    expect(beatLineColor(true, 5)).toBe(beatLineColor(true, 1));
  });
});

describe('positionValueText', () => {
  it('says the position and the length as m:ss, the way a person reads them', () => {
    expect(positionValueText(65, 200_000)).toBe('1:05 de 3:20');
    expect(positionValueText(0, 59_999)).toBe('0:00 de 0:59');
  });
  it('changes only when the shown second does', () => {
    expect(positionValueText(7, 100_000)).toBe(positionValueText(7, 100_000));
    expect(positionValueText(7, 100_000)).not.toBe(positionValueText(8, 100_000));
  });
  it('formatClock never goes below zero', () => {
    expect(formatClock(-500)).toBe('0:00');
    expect(formatClock(3_600_000)).toBe('60:00');
  });
});
