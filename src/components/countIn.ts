// The count before a run from the very start: the lane is empty, the first note arrives on the hit line this
// long after the start, and the number in the middle of the screen fades out until the music begins.

// Real time of the count when nothing else is asked (a session passes its own, shorter one after the first item)
export const COUNT_IN_MS = 5000;

// The number is discreet from the first frame and nearly gone when the music starts; at 0 it is removed
export const COUNT_IN_OPACITY_START = 0.55;
export const COUNT_IN_OPACITY_END = 0.1;

// Where the song clock rests before the run starts, and where it begins: the whole count ahead, in song time
export const countInStartPositionMs = (leadInMs: number, speed: number): number => -leadInMs * speed;

// Real time left of the count (the song clock runs at `speed`, the count does not)
export const countInRemainingMs = (positionMs: number, speed: number): number => (positionMs < 0 ? -positionMs / speed : 0);

// The whole number shown: 5, 4, 3, 2, 1
export const countInSecondsLeft = (positionMs: number, speed: number): number => Math.ceil(countInRemainingMs(positionMs, speed) / 1000);

export const countInOpacity = (remainingMs: number, totalMs: number): number => {
  if (remainingMs <= 0 || totalMs <= 0) return 0;
  const left = Math.min(1, remainingMs / totalMs);
  return COUNT_IN_OPACITY_END + (COUNT_IN_OPACITY_START - COUNT_IN_OPACITY_END) * left;
};
