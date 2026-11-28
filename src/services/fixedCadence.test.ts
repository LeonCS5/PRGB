import { describe, expect, it } from 'vitest';
import { ANALYSIS_HZ, EVERY_FRAME, FixedCadence } from './fixedCadence';

interface Options {
  seconds?: number;
  jitterMs?: number; // each frame lands up to this early or late
  jankEveryS?: number; // a frozen main thread: no frame for jankMs, every jankEveryS seconds
  jankMs?: number;
  clockStepMs?: number; // the audio clock only moves in jumps of this size (0: exact)
}

/** The audio-clock time of every frame a screen of `hz` paints, with jitter and janks, then the ones that run. */
const simulate = (hz: number, options: Options = {}, cadence = new FixedCadence()) => {
  const { seconds = 10, jitterMs = 0, jankEveryS = 0, jankMs = 0, clockStepMs = 0 } = options;
  let seed = 1234;
  const random = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648 - 0.5;
  };
  const frames: number[] = [];
  const runs: number[] = [];
  const frameMs = 1000 / hz;
  let nextJank = jankEveryS * 1000;
  let last = -Infinity;
  for (let k = 0; k * frameMs < seconds * 1000; k++) {
    let timeMs = k * frameMs + random() * 2 * jitterMs;
    if (jankEveryS > 0 && timeMs >= nextJank && timeMs < nextJank + jankMs) timeMs = nextJank + jankMs; // the frame waits
    if (jankEveryS > 0 && timeMs >= nextJank + jankMs) nextJank += jankEveryS * 1000;
    timeMs = Math.max(timeMs, last + 0.01); // frames never go back
    last = timeMs;
    const clockMs = clockStepMs > 0 ? Math.floor(timeMs / clockStepMs) * clockStepMs : timeMs;
    frames.push(timeMs);
    if (cadence.shouldRun(clockMs / 1000)) runs.push(timeMs);
  }
  return { frames, runs };
};

const perSecond = (runs: number[], seconds = 10) => runs.length / seconds;
const smallestGapMs = (runs: number[]) => runs.slice(1).reduce((smallest, time, index) => Math.min(smallest, time - runs[index]), Infinity);

describe('FixedCadence', () => {
  it('runs the first call', () => {
    expect(new FixedCadence().shouldRun(123.456)).toBe(true);
  });

  describe.each([60, 75, 90, 120, 144, 165, 240])('on a %i Hz screen', (hz) => {
    it('analyses about 60 times a second, with jitter and janks', () => {
      for (const options of [{}, { jitterMs: 0.6 }, { jitterMs: 1, jankEveryS: 2, jankMs: 200 }]) {
        const { runs } = simulate(hz, options);
        // A jank of 200 ms every 2 s loses 10% of the time: the cadence does not make that up
        const lost = options.jankMs ? 1 - (options.jankMs / 1000) / (options.jankEveryS ?? 1) : 1;
        expect(perSecond(runs)).toBeGreaterThan(ANALYSIS_HZ * lost * 0.98);
        expect(perSecond(runs)).toBeLessThan(ANALYSIS_HZ * 1.02);
      }
    });

    it('never analyses twice in less than 11.5 ms', () => {
      for (const options of [{}, { jitterMs: 0.5 }, { jitterMs: 0.5, jankEveryS: 2, jankMs: 200 }]) {
        const { runs } = simulate(hz, options);
        const margin = options.jitterMs ?? 0;
        // A frame later than its slot by the jitter, then one earlier, can bring two runs a bit closer than a step.
        // At 90 and 100 Hz two runs on consecutive frames cannot be avoided (a frame is shorter than that), or the
        // rate would fall under 60: the floor is one frame there
        const floor = Math.min(11.5, 1000 / hz) - 2 * margin;
        expect(smallestGapMs(runs)).toBeGreaterThan(floor - 0.01);
      }
    });
  });

  it('analyses every frame on a 60 Hz screen, none skipped for arriving a little early', () => {
    for (const jitterMs of [0, 0.5, 1.5, 3]) {
      const { frames, runs } = simulate(60, { jitterMs });
      expect(runs.length).toBe(frames.length);
    }
  });

  it('analyses every frame on a screen slower than the step (30 Hz): it cannot do more', () => {
    const { frames, runs } = simulate(30, { jitterMs: 1 });
    expect(runs.length).toBe(frames.length);
    expect(perSecond(runs)).toBeCloseTo(30, 0);
  });

  it('keeps the rate when the audio clock only moves in coarse jumps (10 ms)', () => {
    for (const hz of [60, 144, 240]) {
      const { runs } = simulate(hz, { clockStepMs: 10 });
      expect(perSecond(runs)).toBeGreaterThan(ANALYSIS_HZ * 0.98);
      expect(perSecond(runs)).toBeLessThan(ANALYSIS_HZ * 1.02);
    }
  });

  it('runs once after a long stall, with no burst to make up for it', () => {
    const cadence = new FixedCadence();
    expect(cadence.shouldRun(0)).toBe(true);
    expect(cadence.shouldRun(0.5)).toBe(true); // half a second of nothing: one analysis
    // Right after, the next frames wait for a step as usual (144 Hz here)
    const results = [1, 2, 3].map((frame) => cadence.shouldRun(0.5 + frame / 144));
    expect(results).toEqual([false, true, false]);
  });

  it('starts again when the clock goes back (a rebuilt context)', () => {
    const cadence = new FixedCadence();
    cadence.shouldRun(50);
    cadence.shouldRun(50.01);
    expect(cadence.shouldRun(0.001)).toBe(true);
    expect(cadence.shouldRun(0.002)).toBe(false);
  });

  it('reset makes the next call run', () => {
    const cadence = new FixedCadence();
    cadence.shouldRun(1);
    expect(cadence.shouldRun(1.001)).toBe(false);
    cadence.reset();
    expect(cadence.shouldRun(1.002)).toBe(true);
  });

  it('goes back to every frame when the clock is frozen (a suspended context)', () => {
    const cadence = new FixedCadence();
    const results = Array.from({ length: 30 }, () => cadence.shouldRun(5));
    expect(results[0]).toBe(true);
    expect(results.slice(1, 11).every((run) => run === false)).toBe(true);
    expect(results.slice(12).every((run) => run === true)).toBe(true); // a stuck pitch clears, as it did before
    // The clock comes back to life: a normal cadence again
    expect(cadence.shouldRun(5 + 1 / 144)).toBe(false);
  });

  it('EVERY_FRAME analyses every frame', () => {
    expect([1, 1, 1].map(() => EVERY_FRAME.shouldRun(0))).toEqual([true, true, true]);
  });
});
