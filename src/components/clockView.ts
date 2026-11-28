import { countInOpacity, countInRemainingMs, countInSecondsLeft } from './countIn';

// What the screen shows of the song clock. The clock itself (positionRef) moves every frame and is only read by the
// canvas, the judging and the synth; React renders again only when one of these discrete values changes.
export interface ClockView {
  before: boolean; // the clock is negative: the count before the run (or the overlap of a training lap)
  atStart: boolean; // the clock rests at exactly 0: the run has not begun
  second: number; // whole seconds of the clock shown in the time label
  countSecondsLeft: number; // the number of the count in the middle of the lane
  countOpacity: number; // opacity of that number when React last rendered; the frames in between write it on the element
  autoTenths: number; // the Auto scale under the line, in tenths (10 = the notes have room): the Zoom card shows it
}

export const clockViewOf = (positionMs: number, speed: number, countTotalMs: number, autoFactor: number = 1): ClockView => ({
  before: positionMs < 0,
  atStart: positionMs === 0,
  second: Math.floor(Math.max(0, positionMs) / 1000),
  countSecondsLeft: countInSecondsLeft(positionMs, speed),
  countOpacity: countInOpacity(countInRemainingMs(positionMs, speed), countTotalMs),
  autoTenths: Math.round(autoFactor * 10)
});

// The opacity is not compared: it changes every frame and is written on the element, not rendered
export const sameClockView = (a: ClockView, b: ClockView): boolean =>
  a.before === b.before && a.atStart === b.atStart && a.second === b.second && a.countSecondsLeft === b.countSecondsLeft && a.autoTenths === b.autoTenths;

/** m:ss of a time in ms (what the time labels show). */
export const formatClock = (ms: number): string => {
  const totalSec = Math.floor(Math.max(0, ms) / 1000);
  return `${Math.floor(totalSec / 60)}:${(totalSec % 60).toString().padStart(2, '0')}`;
};

/**
 * What a screen reader says for the position slider: "1:05 de 3:20", not the raw number of milliseconds that
 * aria-valuenow carries. It changes once a second, with the label, so it costs no render per frame.
 */
export const positionValueText = (second: number, durationMs: number): string => `${formatClock(second * 1000)} de ${formatClock(durationMs)}`;
