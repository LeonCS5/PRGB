// Scoring rules the server needs to bound a submitted score. They mirror the game: a Perfect is worth
// 150 and a Good 100, times a combo multiplier that grows by 1 every 5 hits in a row, up to 4.
// Pure TypeScript (shared with the Edge Functions): no Deno or DOM APIs.

import type { NoteEvent } from './tabNormalizer.ts';

export const PERFECT_POINTS = 150;
export const GOOD_POINTS = 100;
export const COMBO_STEP = 5;
export const MAX_MULTIPLIER = 4;

/** Dead (muted) and grace notes are never judged, so they can't score. */
export const isScorable = (note: Pick<NoteEvent, 'dead' | 'grace'>): boolean => !note.dead && !note.grace;

export const countScorableNotes = (notes: readonly Pick<NoteEvent, 'dead' | 'grace'>[]): number =>
  notes.reduce((count, note) => count + (isScorable(note) ? 1 : 0), 0);

/**
 * Highest score possible with `scorableNotes` notes: all Perfect without breaking the combo, i.e. the sum
 * for k = 0..n-1 of PERFECT_POINTS * min(MAX_MULTIPLIER, floor(k / COMBO_STEP) + 1), in closed form.
 */
export function maxPossibleScore(scorableNotes: number): number {
  if (!Number.isInteger(scorableNotes) || scorableNotes < 0) {
    throw new RangeError(`scorableNotes must be a non-negative integer, got ${scorableNotes}`);
  }
  // The first notes climb the multiplier in blocks of COMBO_STEP; every note after the climb gets the maximum
  const climbNotes = (MAX_MULTIPLIER - 1) * COMBO_STEP;
  const climbing = Math.min(scorableNotes, climbNotes);
  const fullBlocks = Math.floor(climbing / COMBO_STEP);
  const partialBlock = climbing % COMBO_STEP;
  const multiplierSum =
    (COMBO_STEP * fullBlocks * (fullBlocks + 1)) / 2 +
    partialBlock * (fullBlocks + 1) +
    MAX_MULTIPLIER * (scorableNotes - climbing);
  return PERFECT_POINTS * multiplierSum;
}
