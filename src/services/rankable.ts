import { DEMO_SONG_ID } from './demoSong';

// Ranking only accepts content seeded in the database: the server rejects anything it can't fetch itself,
// and the external catalog refuses automated access. Later fronts (own repertoire, seeded exercises) add
// their id ranges here. Bundled exercises (ids from -1000 down) are not seeded yet, so they stay out.
const RANKABLE_ID_RANGES: ReadonlyArray<readonly [min: number, max: number]> = [
  [DEMO_SONG_ID, DEMO_SONG_ID]
];

export const isRankableSongId = (songId: number): boolean =>
  Number.isSafeInteger(songId) && RANKABLE_ID_RANGES.some(([min, max]) => songId >= min && songId <= max);
