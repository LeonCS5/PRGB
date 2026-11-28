// Steady rate for the pitch analysis, on the audio clock, whatever the screen's refresh rate.
//
// The detection loop runs on requestAnimationFrame, so it ran as often as the screen paints: 144 times a second on a
// 144 Hz screen, 30 on a slow one. The attack debounce (3 frames), the legato hold (2 frames), the stable-note rule
// and the mirror history were all tuned for about 60 analyses a second, so they lasted a different time on each screen.

/** Analyses per second the judging was tuned for. */
export const ANALYSIS_HZ = 60;

export interface Cadence {
  /** True when this frame should be analysed. `nowSec` is the audio clock (AudioContext.currentTime). */
  shouldRun(nowSec: number): boolean;
  /** Forget what came before: the next call runs. */
  reset(): void;
}

/** Analyse on every frame, as the engine did before the cadence (and as a test double). */
export const EVERY_FRAME: Cadence = { shouldRun: () => true, reset: () => undefined };

/**
 * Lets one frame in a step through, the step being 1/ANALYSIS_HZ of audio time. Elapsed time is summed, and each run
 * takes one step off the sum, so the long-run rate is exactly the step's whatever the frame times are, also when the
 * clock itself only moves in coarse jumps. It never runs twice for one frame and never makes up for lost time:
 * after a stall (a busy thread, a hidden tab) it runs once and starts counting again.
 */
export class FixedCadence implements Cadence {
  private last: number | null = null;
  private carry = 0;
  private stalledCalls = 0;

  private readonly stepSec: number;
  private readonly slack: number;
  private readonly maxStalledCalls: number;

  /**
   * @param stepSec Audio time between two analyses.
   * @param slack Share of a step a frame may fall short and still run. A screen at about the step's rate would
   *   otherwise skip a frame whenever one came a little early; this also keeps two runs at least
   *   (1 - slack) of a step apart for the usual refresh rates.
   * @param maxStalledCalls Calls in a row in which the clock did not move before the clock is taken as frozen
   *   (a suspended context) and every frame runs again, so a stuck pitch still clears.
   */
  constructor(stepSec = 1 / ANALYSIS_HZ, slack = 0.2, maxStalledCalls = 12) {
    this.stepSec = stepSec;
    this.slack = slack;
    this.maxStalledCalls = maxStalledCalls;
  }

  reset(): void {
    this.last = null;
    this.carry = 0;
    this.stalledCalls = 0;
  }

  shouldRun(nowSec: number): boolean {
    // First call, or the clock went back (a context rebuilt): start again
    if (this.last === null || nowSec < this.last) {
      this.last = nowSec;
      this.carry = 0;
      this.stalledCalls = 0;
      return true;
    }
    const elapsed = nowSec - this.last;
    this.last = nowSec;
    if (elapsed === 0) return ++this.stalledCalls >= this.maxStalledCalls;
    this.stalledCalls = 0;
    this.carry += elapsed;
    if (this.carry < this.stepSec * (1 - this.slack)) return false;
    this.carry -= this.stepSec;
    // More than a whole step behind: one analysis now, no burst to catch up
    if (this.carry > this.stepSec) this.carry = 0;
    return true;
  }
}
