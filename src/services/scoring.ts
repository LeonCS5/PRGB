// Scoring rules of the practice game, kept free of React/DOM so the canvas, duo mode and the
// online ranking all judge notes the same way.

import type { NoteEvent } from './songsterrApi';
import type { DetectedPitch } from './audioEngine';

export const PERFECT_WINDOW_MS = 55;
export const HIT_WINDOW_MS = 130;
export const PERFECT_POINTS = 150;
export const GOOD_POINTS = 100;
export const COMBO_STEP = 5; // the multiplier goes up every 5 hits in a row
export const MAX_MULTIPLIER = 4;
export const MIN_PITCH_VOLUME = 0.02;

export type Judgement = 'perfect' | 'good' | 'miss';
export type NoteOutcome = Judgement | 'skip'; // 'skip' = dead/grace note, or ghost note not played: no points, no miss

export interface ScoreState {
  score: number;
  combo: number;
  maxCombo: number;
  perfect: number;
  good: number;
  miss: number;
}

export function createScoreState(): ScoreState {
  return { score: 0, combo: 0, maxCombo: 0, perfect: 0, good: 0, miss: 0 };
}

export function comboMultiplier(combo: number): number {
  return Math.min(MAX_MULTIPLIER, Math.floor(combo / COMBO_STEP) + 1);
}

/**
 * Returns a new state. A hit is worth its points times the multiplier of the combo built before it.
 */
export function applyJudgement(state: ScoreState, judgement: Judgement): ScoreState {
  if (judgement === 'miss') return { ...state, combo: 0, miss: state.miss + 1 };
  const isPerfect = judgement === 'perfect';
  const combo = state.combo + 1;
  return {
    ...state,
    score: state.score + (isPerfect ? PERFECT_POINTS : GOOD_POINTS) * comboMultiplier(state.combo),
    combo,
    maxCombo: Math.max(state.maxCombo, combo),
    perfect: state.perfect + (isPerfect ? 1 : 0),
    good: state.good + (isPerfect ? 0 : 1)
  };
}

export function accuracyPercent(state: ScoreState): number {
  const played = state.perfect + state.good + state.miss;
  return played > 0 ? Math.round(((state.perfect + state.good) / played) * 100) : 100;
}

/**
 * Dead and grace notes are never judged. Ghost notes score when played but can't be missed.
 */
export function isScorable(note: NoteEvent): boolean {
  return !note.dead && !note.grace;
}

export function countScorableNotes(notes: readonly NoteEvent[]): number {
  let count = 0;
  for (const note of notes) if (isScorable(note)) count++;
  return count;
}

/**
 * Score of hitting every scorable note perfectly in one combo. Nothing can score more: each note is
 * judged at most once and the combo before the k-th hit is at most k. This is the anti-cheat
 * ceiling for submitted scores, so a count that is not a whole, non-negative, safe number throws
 * RangeError instead of being rounded into some ceiling.
 */
export function maxPossibleScore(scorableCount: number): number {
  if (!Number.isSafeInteger(scorableCount) || scorableCount < 0) {
    throw new RangeError(`Invalid scorable note count: ${scorableCount}`);
  }
  const notes = scorableCount;
  // Hits before the multiplier tops out: COMBO_STEP at ×1, COMBO_STEP at ×2, ... up to ×(MAX - 1)
  const rampHits = (MAX_MULTIPLIER - 1) * COMBO_STEP;
  const ramp = Math.min(notes, rampHits);
  const fullSteps = Math.floor(ramp / COMBO_STEP);
  const rampWeight = (COMBO_STEP * fullSteps * (fullSteps + 1)) / 2 + (ramp - fullSteps * COMBO_STEP) * (fullSteps + 1);
  return PERFECT_POINTS * (rampWeight + (notes - ramp) * MAX_MULTIPLIER);
}

export function bendTargetMidi(note: NoteEvent): number {
  return note.midiNote + Math.round(note.bendSemitones ?? 0);
}

/**
 * Judge a pending note against the latest detected pitch. `timeDiffMs` is note.timeMs minus the
 * song position (positive = still ahead). Returns null while the note is still pending.
 */
export function judgeNote(
  note: NoteEvent,
  timeDiffMs: number,
  pitch: Pick<DetectedPitch, 'midiNote' | 'volume'> | null
): NoteOutcome | null {
  if (!isScorable(note)) return timeDiffMs < -HIT_WINDOW_MS ? 'skip' : null;

  const absDiff = Math.abs(timeDiffMs);
  if (absDiff <= HIT_WINDOW_MS) {
    if (!pitch || pitch.volume <= MIN_PITCH_VOLUME) return null;
    // Bends accept either the written pitch or the bend target, a semitone either way
    const midiDiff = Math.min(
      Math.abs(pitch.midiNote - note.midiNote),
      Math.abs(pitch.midiNote - bendTargetMidi(note))
    );
    if (midiDiff > 1) return null;
    return absDiff <= PERFECT_WINDOW_MS ? 'perfect' : 'good';
  }

  if (timeDiffMs < -HIT_WINDOW_MS) return note.ghost ? 'skip' : 'miss';
  return null;
}
