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
// A hammer-on, pull-off or slide has no pick to show it: the change of note is only found after two detections agree
// on it, and its onset is soft. A linked note is allowed this much more time after the line (Perfect is not).
export const LEGATO_EXTRA_LATE_MS = 60;
// A linked note counts as played without a break when the note before it lasts to within this of it
export const LEGATO_MAX_GAP_MS = 60;
// ...and only once the same note has been read this many times in a row: a single reading of the blend of two notes, or
// of a slide passing by, is not the note (a frame is about 16 ms, and at 16 notes a second a note lasts under four of them)
export const LEGATO_HELD_FRAMES = 2;

/**
 * How far ahead of the line a note is, as the judge sees it (positive = still coming, negative = already past).
 * A pitch reaches the judge `latencyMs` of real time after the string was played, and the song runs at `speed`
 * song-ms per real ms, so the delay is worth latencyMs * speed of song time: a note played exactly on time reads 0.
 */
export function noteTimeDiffMs(noteTimeMs: number, positionMs: number, latencyMs: number, speed: number): number {
  return noteTimeMs - positionMs + latencyMs * speed;
}

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

/**
 * What a note needs from the player's hand to be hit:
 * - 'attack': a fresh pick (an attack not spent on an earlier note);
 * - 'pitch-change': no pick, only the note itself, reached by a change of note after the previous hit (the destination
 *   of a hammer-on, a pull-off or a slide);
 * - 'none': the note is never judged (dead, grace).
 */
export type AttackRequirement = 'attack' | 'pitch-change' | 'none';

// What judgeNote needs to know about a note beyond the note: derived from its neighbours, once per tab
export interface JudgeContext {
  requirement: AttackRequirement;
  // Slide origin: the pitches the slide passes on its way to the destination, inclusive. They count as Good at most, so
  // a slide that starts before the origin pitch settles is not a miss.
  slideRange?: readonly [number, number];
}

// A slide leaves its note toward the next one (shift, legato); 'in' arrives from nowhere and 'out' leaves to nowhere
const slidesToNextNote = (slide: string | undefined): boolean => !!slide && !/^in/i.test(slide) && !/out/i.test(slide);

/**
 * Whether `note` is played with a pick or reached from `previous`, the last note before it on its string. It is reached
 * (no pick) when it is marked as a hammer-on/pull-off, or `previous` slides to it, `previous` rings on until it, and it
 * is another pitch. Any slide counts as the legato kind: the data can't tell a slide that re-picks its destination
 * from one that doesn't, and a re-picked destination also changes the note, so it passes either way.
 */
export function classifyAttackRequirement(note: NoteEvent, previous?: NoteEvent | null): AttackRequirement {
  if (!isScorable(note)) return 'none';
  if (note.chord || !previous || previous.dead || previous.chordMember) return 'attack';
  if (previous.midiNote === note.midiNote || note.timeMs <= previous.timeMs) return 'attack';
  if (previous.timeMs + previous.durationMs < note.timeMs - LEGATO_MAX_GAP_MS) return 'attack';
  return note.hammerOnOrPullOff || slidesToNextNote(previous.slide) ? 'pitch-change' : 'attack';
}

/** The context of every note of a tab, by note id. Notes must be in time order, as the parser leaves them. */
export function buildJudgeContexts(notes: readonly NoteEvent[]): Map<string, JudgeContext> {
  const contexts = new Map<string, JudgeContext>();
  const lastOnString = new Map<number, NoteEvent>();
  for (const note of notes) {
    const previous = lastOnString.get(note.string);
    const requirement = classifyAttackRequirement(note, previous);
    contexts.set(note.id, { requirement });
    if (requirement === 'pitch-change' && previous && slidesToNextNote(previous.slide)) {
      const origin = contexts.get(previous.id);
      if (origin) origin.slideRange = [Math.min(previous.midiNote, note.midiNote), Math.max(previous.midiNote, note.midiNote)];
    }
    if (!note.grace) lastOnString.set(note.string, note);
  }
  return contexts;
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
  // The last change of note (DetectedPitch.changeId) seen at a hit. A note reached without a pick needs a newer one,
  // so the note still ringing from the previous hit can't pass for it. Absent = none yet.
  changeId?: number;
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
export function consumeAttack(ledger: AttackLedger, attackId: number, noteTimeMs: number, changeId?: number): AttackLedger {
  const sameChord = attackId === ledger.attackId && canUseAttack(ledger, attackId, noteTimeMs);
  const next: AttackLedger = { attackId, noteTimeMs: sameChord ? ledger.noteTimeMs : noteTimeMs };
  const seen = changeId === undefined ? ledger.changeId : Math.max(changeId, ledger.changeId ?? -Infinity);
  if (seen !== undefined) next.changeId = seen;
  return next;
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
  pitch: Pick<DetectedPitch, 'midiNote' | 'volume' | 'attackId'> & Partial<Pick<DetectedPitch, 'changeId' | 'heldFrames'>> | null,
  ledger?: AttackLedger,
  context?: JudgeContext
): NoteOutcome | null {
  if (!isScorable(note)) return timeDiffMs < -HIT_LATE_MS ? 'skip' : null;
  if (note.chord) return judgeChord(note, note.chord, timeDiffMs, pitch, ledger);

  // A note reached without a pick: its note has to be heard exactly, after a change of note that no earlier hit used
  const linked = context?.requirement === 'pitch-change';
  const lateMs = linked ? HIT_LATE_MS + LEGATO_EXTRA_LATE_MS : HIT_LATE_MS;
  if (timeDiffMs <= HIT_EARLY_MS && timeDiffMs >= -lateMs) {
    if (!pitch || pitch.volume <= MIN_PITCH_VOLUME) return null;
    // A pitch that hasn't settled yet is a note on its way (a slide, the blend of two notes), never the note itself
    if (linked && pitch.heldFrames !== undefined && pitch.heldFrames < LEGATO_HELD_FRAMES) return null;
    if (ledger) {
      // Without a change counter in the pitch (tests, old callers) a linked note falls back to needing a fresh pick
      const fresh = linked && pitch.changeId !== undefined
        ? pitch.changeId > (ledger.changeId ?? -1)
        : canUseAttack(ledger, pitch.attackId, note.timeMs);
      if (!fresh) return null;
    }
    // Bends accept either the written pitch or the bend target, a semitone either way
    const midiDiff = Math.min(
      Math.abs(pitch.midiNote - note.midiNote),
      Math.abs(pitch.midiNote - bendTargetMidi(note))
    );
    // A semitone off (wrong fret, out of tune) still counts, and so does an octave off (where a detector can land on
    // a low string), but neither is ever perfect
    // The note before it still rings a semitone away, and a slide passes it on the way: only the note itself will do
    if (linked) return midiDiff === 0 || midiDiff === 12 ? (isPerfectTime(timeDiffMs) && midiDiff === 0 ? 'perfect' : 'good') : null;
    if (midiDiff > 1 && midiDiff !== 12) {
      const range = context?.slideRange;
      if (range && pitch.midiNote >= range[0] && pitch.midiNote <= range[1]) return 'good';
      return note.acceptClasses?.includes(pitchClassOf(pitch.midiNote)) ? 'good' : null;
    }
    return isPerfectTime(timeDiffMs) && midiDiff === 0 ? 'perfect' : 'good';
  }

  if (timeDiffMs < -lateMs) return note.ghost ? 'skip' : 'miss';
  return null;
}
