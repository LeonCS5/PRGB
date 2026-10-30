// The notes heard in Play Free, kept for a short while so they can be drawn as they scroll away.

import type { DetectedPitch } from './audioEngine';

export const TRAIL_WINDOW_MS = 15000;

export interface PlayedNote {
  attackId: number;
  noteName: string;
  midiNote: number;
  string: number | null; // 1 to 6
  fret: number | null;
  clarity: number; // of the reading the note is showing
  startMs: number;
  endMs: number;
}

const reading = ({ noteName, midiNote, stringEstimate, fretEstimate, clarity }: DetectedPitch) => ({
  noteName,
  midiNote,
  string: stringEstimate ?? null,
  fret: fretEstimate ?? null,
  clarity,
});

/**
 * A new attackId adds a note. The same one keeps it ringing, and silence changes nothing: the engine gives
 * a change of note its own attackId. The first frames of a pluck are the least reliable, so a note keeps
 * its clearest reading instead of the first. Notes that ended over TRAIL_WINDOW_MS ago are dropped.
 */
export function updateTrail(trail: PlayedNote[], pitch: DetectedPitch | null, nowMs: number): PlayedNote[] {
  const next = trail.filter((note) => note.endMs >= nowMs - TRAIL_WINDOW_MS);
  if (!pitch) return next;

  const last = next.at(-1);
  if (last?.attackId !== pitch.attackId) {
    return [...next, { attackId: pitch.attackId, ...reading(pitch), startMs: nowMs, endMs: nowMs }];
  }
  const updated = pitch.clarity >= last.clarity
    ? { ...last, ...reading(pitch), endMs: nowMs }
    : { ...last, endMs: nowMs };
  return [...next.slice(0, -1), updated];
}
