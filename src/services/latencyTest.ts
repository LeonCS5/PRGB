// Logic of the latency test. Notes arrive at a steady pace and the player plays each one as it reaches the line. The
// gap between the line and the moment the detector reads the note is what scoring must give back. The pace matters:
// a player who can see the next note coming plays with it, while one who only reacts would add a reaction time.

import type { DetectedPitch } from './audioEngine';
import { LATENCY_SAMPLES_MAX, LATENCY_SAMPLES_STEP } from './audioDevices';
import { MIN_PITCH_VOLUME } from './scoring';

export const TEST_NOTE_COUNT = 12;
export const WARM_UP_NOTES = 2; // the first ones find the pace and don't count
export const NOTE_INTERVAL_MS = 1200;
export const FIRST_NOTE_MS = 3000;
export const TEST_END_MS = FIRST_NOTE_MS + (TEST_NOTE_COUNT - 1) * NOTE_INTERVAL_MS + 900;

const EARLIEST_HIT_MS = -400;
const LATEST_HIT_MS = 600;
const MIN_HEARD_NOTES = 6;
const MAX_SPREAD_MS = 45; // over this the player was not steady enough for the number to mean anything
const OUTLIER_FLOOR_MS = 40; // two steady players can differ this much without either being an outlier
export const HIGH_LATENCY_MS = 200;

export const testNoteTime = (index: number): number => FIRST_NOTE_MS + index * NOTE_INTERVAL_MS;

export const emptyOffsets = (): (number | null)[] => Array.from({ length: TEST_NOTE_COUNT }, () => null);

/** The note a hit belongs to: the first free one whose window holds it. A stray extra attack finds none. */
export function noteForHit(offsets: readonly (number | null)[], hitMs: number): number | null {
  for (let index = 0; index < offsets.length; index += 1) {
    const offset = hitMs - testNoteTime(index);
    if (offsets[index] === null && offset >= EARLIEST_HIT_MS && offset < LATEST_HIT_MS) return index;
  }
  return null;
}

export interface AttackTracker {
  attackId: number; // the last attack already turned into a hit
  pendingMs: number | null; // first frame of a new attack, waiting for a second reading to agree with it
  pendingMidi: number;
}

export const createAttackTracker = (pitch: DetectedPitch | null): AttackTracker =>
  ({ attackId: pitch?.attackId ?? -1, pendingMs: null, pendingMidi: -1 });

export interface AttackReading {
  tracker: AttackTracker;
  hitMs: number | null;
}

/**
 * The moment a new attack gives a note the game could judge, read once per frame like the game does. A stray first
 * reading (the pick noise, an octave off) is not that moment: scoring would wait for the next one, so this does too.
 */
export function readAttack(tracker: AttackTracker, pitch: DetectedPitch | null, nowMs: number): AttackReading {
  if (!pitch || pitch.volume <= MIN_PITCH_VOLUME || pitch.attackId === tracker.attackId) {
    return { tracker: { ...tracker, pendingMs: null }, hitMs: null };
  }
  if (tracker.pendingMs !== null && Math.abs(pitch.midiNote - tracker.pendingMidi) <= 1) {
    return { tracker: { attackId: pitch.attackId, pendingMs: null, pendingMidi: -1 }, hitMs: tracker.pendingMs };
  }
  return { tracker: { ...tracker, pendingMs: nowMs, pendingMidi: pitch.midiNote }, hitMs: null };
}

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

export type LatencyVerdict = 'ok' | 'unsteady' | 'few';

export interface LatencyResult {
  verdict: LatencyVerdict;
  latencyMs: number;
  spreadMs: number; // typical distance from the result
  heard: number; // notes heard, warm-up left out
  expected: number;
}

export function summarizeTest(offsets: readonly (number | null)[]): LatencyResult {
  const counted = offsets.slice(WARM_UP_NOTES).filter((offset): offset is number => offset !== null);
  const expected = TEST_NOTE_COUNT - WARM_UP_NOTES;
  if (counted.length === 0) return { verdict: 'few', latencyMs: 0, spreadMs: 0, heard: 0, expected };
  const center = median(counted);
  const spread = median(counted.map((offset) => Math.abs(offset - center)));
  const limit = Math.max(spread * 3, OUTLIER_FLOOR_MS);
  const kept = counted.filter((offset) => Math.abs(offset - center) <= limit);
  const latency = median(kept);
  const spreadMs = Math.round(median(kept.map((offset) => Math.abs(offset - latency))));
  const verdict = counted.length < MIN_HEARD_NOTES ? 'few' : spreadMs > MAX_SPREAD_MS ? 'unsteady' : 'ok';
  return { verdict, latencyMs: Math.max(0, Math.round(latency)), spreadMs, heard: counted.length, expected };
}

/** The two compensation settings that add up to a latency. The input one fills first. */
export function latencySettings(latencyMs: number, sampleRate: number): { inputLatencySamples: number; outputLatencySamples: number } {
  const total = Math.round(((latencyMs / 1000) * sampleRate) / LATENCY_SAMPLES_STEP) * LATENCY_SAMPLES_STEP;
  const capped = Math.min(total, LATENCY_SAMPLES_MAX * 2);
  const inputLatencySamples = Math.min(capped, LATENCY_SAMPLES_MAX);
  return { inputLatencySamples, outputLatencySamples: capped - inputLatencySamples };
}
