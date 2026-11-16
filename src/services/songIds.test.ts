import { describe, expect, it } from 'vitest';
import { isExerciseSongId } from './exerciseIds';
import { MAX_SONG_CODE, isRepertoireSongId, parseRepertoireSongId, songSongId } from './songIds';

describe('repertoire ids', () => {
  it('keeps the ids already published: records and challenge links store them', () => {
    expect(songSongId(0, 0)).toBe(-200000);
    expect(songSongId(1, 0)).toBe(-200010);
    expect(songSongId(1, 2)).toBe(-200012);
  });

  it('round-trips every code and part', () => {
    for (const [code, partCode] of [[0, 0], [1, 9], [57, 3], [MAX_SONG_CODE, 9]]) {
      expect(parseRepertoireSongId(songSongId(code, partCode))).toEqual({ code, partCode });
    }
  });

  it('never collides with exercises, the demo or downloaded songs', () => {
    const extremes = [songSongId(0, 0), songSongId(MAX_SONG_CODE, 9)];
    for (const id of extremes) {
      expect(isRepertoireSongId(id)).toBe(true);
      expect(isExerciseSongId(id)).toBe(false);
      expect(id).toBeLessThan(-100000);
    }
    for (const id of [-1, 1, 123456, -1000, -100000, -199999, -300000, 1.5, Number.NaN, '-200000', null]) {
      expect(isRepertoireSongId(id)).toBe(false);
    }
  });

  it('rejects codes outside the range', () => {
    expect(() => songSongId(-1, 0)).toThrow();
    expect(() => songSongId(MAX_SONG_CODE + 1, 0)).toThrow();
    expect(() => songSongId(1, 10)).toThrow();
    expect(() => parseRepertoireSongId(-5)).toThrow();
  });
});
