import { describe, expect, it } from 'vitest';
import { exerciseSongId } from './exerciseIds';
import { countScorableNotes, maxPossibleScore } from '../../supabase/functions/_shared/scoreLimits.ts';
import migration from '../../supabase/migrations/20261117120000_seed_repertoire.sql?raw';
import { isRankableSongId, SEEDED_REPERTOIRE_IDS } from './rankable';
import { findSongPart } from './songs';
import { songSongId } from './songIds';

describe('isRankableSongId', () => {
  it('accepts the seeded demo', () => {
    expect(isRankableSongId(-1)).toBe(true);
  });

  it('accepts the seeded repertoire pieces and not the ones that are not listed', () => {
    expect(isRankableSongId(songSongId(1, 0))).toBe(true);
    expect(isRankableSongId(songSongId(2, 0))).toBe(false);
    expect(isRankableSongId(songSongId(1, 1))).toBe(false);
  });

  it('rejects catalog songs, bundled exercises and invalid ids', () => {
    expect(isRankableSongId(1)).toBe(false);
    expect(isRankableSongId(123456)).toBe(false);
    expect(isRankableSongId(0)).toBe(false);
    expect(isRankableSongId(exerciseSongId(0, 0))).toBe(false);
    expect(isRankableSongId(-2)).toBe(false);
    expect(isRankableSongId(Number.NaN)).toBe(false);
  });
});

describe('seeded repertoire rows', () => {

  // The server only knows the numbers in the migration: if a piece changes (a note, a duration) they must change too
  it.each(SEEDED_REPERTOIRE_IDS.map((id) => [id]))('the migration row of %i matches what the game counts', async (id) => {
    const part = await findSongPart(id, 0);
    expect(part).not.toBeNull();
    const notes = countScorableNotes(part!.tab.notes);
    const quote = (text: string) => `'${text.replace(/'/g, "''")}'`;
    const row = `(${id}, 0, 0, ${quote(part!.tab.title)}, ${quote(part!.tab.artist)}, ${quote(part!.tab.trackName)}, ${notes}, ${part!.tab.totalDurationMs}, ${maxPossibleScore(notes)})`;
    expect(migration).toContain(row);
  });
});
