import { DEMO_SONG_ID } from './demoSong';
import { songSongId } from './songIds';

// Ranking only accepts content seeded in the database: the server rejects anything it can't fetch itself,
// and the external catalog refuses automated access. Later fronts (own repertoire, seeded exercises) add
// their ids here. Bundled exercises (ids from -1000 down) are not seeded yet, so they stay out.
// A repertoire piece is listed only after its row is in supabase/migrations (seed_repertoire) and applied.
export const SEEDED_REPERTOIRE_IDS: readonly number[] = [songSongId(1, 0)]; // Ode à Alegria

const RANKABLE_IDS: ReadonlySet<number> = new Set([DEMO_SONG_ID, ...SEEDED_REPERTOIRE_IDS]);

export const isRankableSongId = (songId: number): boolean =>
  Number.isSafeInteger(songId) && RANKABLE_IDS.has(songId);
