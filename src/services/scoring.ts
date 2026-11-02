// Scoring rules of the practice game, kept free of React/DOM so the canvas, duo mode and the
// online ranking all judge notes the same way.

import type { ChordTarget, NoteEvent } from './tabsApi';
import type { DetectedPitch } from './audioEngine';

// How far from the line a note counts, on each side of it. The pitch is only read after the pick, so most of the
// room is after the line; a note played early keeps ringing into the window, so that side needs less.
export const PERFECT_EARLY_MS = 70;
export const PERFECT_LATE_MS = 110;
export const HIT_EARLY_MS = 150;
export const HIT_LATE_MS = 260;
export const PERFECT_POINTS = 150;
export const GOOD_POINTS = 100;
export const COMBO_STEP = 5; // the multiplier goes up every 5 hits in a row
export const MAX_MULTIPLIER = 4;
export const MIN_PITCH_VOLUME = 0.02;
// Notes this close to the note an attack already hit belong to the same chord (or strum)
export const CHORD_WINDOW_MS = 30;
// A strum spreads over the strings and its low period takes longer to read: measured up to ~170 ms for a
// synthesized strum against ~120 ms for one low note. Chords are judged this much later than single notes.
export const CHORD_READ_DELAY_MS = 80;

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
 * Dead and grace notes are never judged, nor are the notes of a chord besides the one that stands for it.
 * Ghost notes score when played but can't be missed.
 */
export function isScorable(note: NoteEvent): boolean {
  return !note.dead && !note.grace && !note.chordMember;
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

const pitchClassOf = (midi: number): number => ((midi % 12) + 12) % 12;
const isHitTime = (timeDiffMs: number): boolean => timeDiffMs <= HIT_EARLY_MS && timeDiffMs >= -HIT_LATE_MS;
const isPerfectTime = (timeDiffMs: number): boolean => timeDiffMs <= PERFECT_EARLY_MS && timeDiffMs >= -PERFECT_LATE_MS;

// Any note of the chord counts, since a real strum may read as another chord tone; the root is the sure sign of it
function judgeChord(
  note: NoteEvent,
  chord: ChordTarget,
  timeDiffMs: number,
  pitch: Pick<DetectedPitch, 'midiNote' | 'volume' | 'attackId'> | null,
  ledger?: AttackLedger
): NoteOutcome | null {
  const diff = timeDiffMs + CHORD_READ_DELAY_MS;
  if (isHitTime(diff)) {
    if (!pitch || pitch.volume <= MIN_PITCH_VOLUME) return null;
    if (ledger && !canUseAttack(ledger, pitch.attackId, note.timeMs)) return null;
    const heard = pitchClassOf(pitch.midiNote);
    if (!chord.toneClasses.includes(heard)) return null;
    return isPerfectTime(diff) && heard === chord.rootClass ? 'perfect' : 'good';
  }
  return diff < -HIT_LATE_MS ? 'miss' : null;
}

/**
 * The attack (DetectedPitch.attackId) last spent on a hit. `noteTimeMs` is the time of the first note
 * it hit, which anchors the chord window.
 */
export interface AttackLedger {
  attackId: number;
  noteTimeMs: number;
}

export function createAttackLedger(): AttackLedger {
  return { attackId: -1, noteTimeMs: -Infinity };
}

/**
 * One attack hits one note, or the notes of one chord: an attack already spent can only hit notes
 * within CHORD_WINDOW_MS of the note it hit. So holding a note can't hit the repeated notes after it.
 */
export function canUseAttack(ledger: AttackLedger, attackId: number, noteTimeMs: number): boolean {
  return attackId !== ledger.attackId || Math.abs(noteTimeMs - ledger.noteTimeMs) <= CHORD_WINDOW_MS;
}

/**
 * Ledger after a hit with this attack (a new object; the one given is not changed). More notes of the
 * same chord keep the chord's anchor, so notes under CHORD_WINDOW_MS apart can't chain into a long chord.
 */
export function consumeAttack(ledger: AttackLedger, attackId: number, noteTimeMs: number): AttackLedger {
  const sameChord = attackId === ledger.attackId && canUseAttack(ledger, attackId, noteTimeMs);
  return { attackId, noteTimeMs: sameChord ? ledger.noteTimeMs : noteTimeMs };
}

/**
 * Judge a pending note against the latest detected pitch. `timeDiffMs` is note.timeMs minus the
 * song position (positive = still ahead). Returns null while the note is still pending.
 * With a `ledger`, a pitch whose attack was already spent on an earlier note can't hit this one (the
 * note stays pending and may become a miss); after each hit, the caller updates the ledger with
 * consumeAttack(ledger, pitch.attackId, note.timeMs). Without one, any pitch can hit (old behavior).
 */
export function judgeNote(
  note: NoteEvent,
  timeDiffMs: number,
  pitch: Pick<DetectedPitch, 'midiNote' | 'volume' | 'attackId'> | null,
  ledger?: AttackLedger
): NoteOutcome | null {
  if (!isScorable(note)) return timeDiffMs < -HIT_LATE_MS ? 'skip' : null;
  if (note.chord) return judgeChord(note, note.chord, timeDiffMs, pitch, ledger);

  if (isHitTime(timeDiffMs)) {
    if (!pitch || pitch.volume <= MIN_PITCH_VOLUME) return null;
    if (ledger && !canUseAttack(ledger, pitch.attackId, note.timeMs)) return null;
    // Bends accept either the written pitch or the bend target, a semitone either way
    const midiDiff = Math.min(
      Math.abs(pitch.midiNote - note.midiNote),
      Math.abs(pitch.midiNote - bendTargetMidi(note))
    );
    // A semitone off (wrong fret, out of tune) still counts, and so does an octave off (where a detector can land on
    // a low string), but neither is ever perfect
    if (midiDiff > 1 && midiDiff !== 12) return note.acceptClasses?.includes(pitchClassOf(pitch.midiNote)) ? 'good' : null;
    return isPerfectTime(timeDiffMs) && midiDiff === 0 ? 'perfect' : 'good';
  }

  if (timeDiffMs < -HIT_LATE_MS) return note.ghost ? 'skip' : 'miss';
  return null;
}
