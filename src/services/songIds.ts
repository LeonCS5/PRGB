// Ids of the bundled repertoire (public-domain pieces with our own arrangements). Records and challenge links
// keep them, so a code must never be renumbered or reused.
//
// Ranges, all disjoint:
//   positive          downloaded songs
//   -1                the ranked offline demo
//   -1000 .. -100000  exercises (exerciseIds.ts)
//   -200000 .. -299999 this repertoire: -200000 - code * 10 - partCode, code 0..9999, partCode 0..9

const FIRST_ID = -200000;
const LAST_ID = -299999;
const PART_SLOTS = 10;
export const MAX_SONG_CODE = 9999;

export const isRepertoireSongId = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value <= FIRST_ID && value >= LAST_ID;

export const songSongId = (code: number, partCode: number): number => {
  if (!Number.isInteger(code) || code < 0 || code > MAX_SONG_CODE) throw new Error(`Invalid song code: ${code}`);
  if (!Number.isInteger(partCode) || partCode < 0 || partCode >= PART_SLOTS) throw new Error(`Invalid part code: ${partCode}`);
  return FIRST_ID - code * PART_SLOTS - partCode;
};

export const parseRepertoireSongId = (songId: number): { code: number; partCode: number } => {
  if (!isRepertoireSongId(songId)) throw new Error(`Not a repertoire id: ${songId}`);
  const offset = FIRST_ID - songId;
  return { code: Math.floor(offset / PART_SLOTS), partCode: offset % PART_SLOTS };
};
