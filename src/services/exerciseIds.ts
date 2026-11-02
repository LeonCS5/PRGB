// Ids of the exercises bundled with the app. Records and challenge links keep them, so a code must never be
// renumbered or reused. Downloaded songs have positive ids and the ranked demo is -1.

const FIRST_ID = -1000;
const LAST_ID = -100000;
const PATTERN_SLOTS = 10;

export const isExerciseSongId = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value <= FIRST_ID && value >= LAST_ID;

export const exerciseSongId = (code: number, patternCode: number): number =>
  FIRST_ID - code * PATTERN_SLOTS - patternCode;

export const parseExerciseSongId = (songId: number): { code: number; patternCode: number } => {
  const offset = FIRST_ID - songId;
  return { code: Math.floor(offset / PATTERN_SLOTS), patternCode: offset % PATTERN_SLOTS };
};
