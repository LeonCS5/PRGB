// Which guide notes of the synth are due: the notes about to cross the hit line, handed to the audio clock once each.
// The notes of a lane are sorted by time once, so a frame looks only at the few notes inside its window (a binary
// search and a short walk) instead of every note of the song, and "already handed over" is a number per note and lap,
// not a text key. Nothing here allocates per frame.

import type { NoteEvent } from '../services/tabsApi';

export interface SynthLane {
  order: Int32Array; // indexes into the lane's notes of the ones that sound (a dead note does not), by time
  times: Float64Array; // the time of order[i]
  // Per note, the lap it was handed to the audio clock for (0 = not yet). Two arrays by lap parity: right after a
  // lap turns the old lap and the new one are both in the window, and they must not overwrite each other.
  played: [Int32Array, Int32Array];
  due: Int32Array; // where dueNotes writes the notes of this frame
}

export const createSynthLane = (notes: readonly NoteEvent[]): SynthLane => {
  const sounding: number[] = [];
  for (let index = 0; index < notes.length; index++) if (!notes[index].dead) sounding.push(index);
  sounding.sort((a, b) => notes[a].timeMs - notes[b].timeMs || a - b);
  return {
    order: Int32Array.from(sounding),
    times: Float64Array.from(sounding, (index) => notes[index].timeMs),
    played: [new Int32Array(notes.length), new Int32Array(notes.length)],
    due: new Int32Array(sounding.length)
  };
};

// The first position whose time is at least `value`
const lowerBound = (times: Float64Array, value: number): number => {
  let low = 0;
  let high = times.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (times[middle] < value) low = middle + 1;
    else high = middle;
  }
  return low;
};

/**
 * Marks as handed over, and writes into `lane.due`, the notes whose time is in [at - graceMs, at + lookaheadMs] and that
 * were not handed over for this lap yet. Returns how many (the first `count` of `lane.due`, as note indexes).
 */
export const dueNotes = (lane: SynthLane, at: number, lap: number, lookaheadMs: number, graceMs: number): number => {
  const played = lane.played[lap & 1];
  const end = at + lookaheadMs;
  let count = 0;
  for (let position = lowerBound(lane.times, at - graceMs); position < lane.times.length && lane.times[position] <= end; position++) {
    const noteIndex = lane.order[position];
    if (played[noteIndex] === lap) continue;
    played[noteIndex] = lap;
    lane.due[count++] = noteIndex;
  }
  return count;
};

/** A note taken back from the audio clock before it sounded can be handed over again. */
export const unmarkPlayed = (lane: SynthLane, noteIndex: number, lap: number): void => {
  const played = lane.played[lap & 1];
  if (played[noteIndex] === lap) played[noteIndex] = 0;
};

/** After a seek: the notes ahead of the new position sound again (those of this lap only). */
export const unmarkAfter = (lane: SynthLane, positionMs: number, lap: number): void => {
  const played = lane.played[lap & 1];
  // The first note later than the position
  let low = 0;
  let high = lane.times.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (lane.times[middle] <= positionMs) low = middle + 1;
    else high = middle;
  }
  for (let position = low; position < lane.times.length; position++) {
    const noteIndex = lane.order[position];
    if (played[noteIndex] === lap) played[noteIndex] = 0;
  }
};

export const clearPlayed = (lane: SynthLane): void => {
  lane.played[0].fill(0);
  lane.played[1].fill(0);
};
