import { describe, expect, it, vi } from 'vitest';
import { SONG_CATALOG } from '../content/songs';
import { decodeChallenge, encodeChallenge } from './challenge';
import { exerciseSongId } from './exerciseIds';
import { getPersonalBest, recordRun, type RunResult } from './records';
import { countScorableNotes } from './scoring';
import {
  PUBLIC_DOMAIN_LAST_DEATH_YEAR,
  defineSong,
  findSongInfo,
  findSongPart,
  loadSong,
  type SongInfo,
  type SongScore
} from './songs';
import { isRepertoireSongId, songSongId } from './songIds';

const memoryStorage = (): Storage => {
  const items = new Map<string, string>();
  return {
    get length() { return items.size; },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => { items.delete(key); },
    setItem: (key, value) => { items.set(key, String(value)); }
  };
};

const info = (overrides: Partial<SongInfo> = {}): SongInfo => ({
  code: 900,
  title: 'Peça de teste',
  composer: 'Beethoven',
  composerDeathYear: 1827,
  arranger: 'PRGB',
  level: 1,
  bpm: 80,
  key: { tonic: 'C', scale: 'major' },
  timeSignature: [4, 4],
  parts: [{ code: 0, name: 'Melodia' }],
  ...overrides
});

const score = (bars: string[], pickup?: [number, number]): SongScore => ({ pickup, parts: [{ code: 0, bars }] });

const tabOf = (bars: string[], overrides: Partial<SongInfo> = {}, pickup?: [number, number]) =>
  defineSong(info(overrides), score(bars, pickup)).buildTab(0);

describe('the notation', () => {
  it('reads notes, rests, dots, triplets and chords, and times them by the bar', () => {
    const tab = tabOf(['1:0q 2:1e re 3:0q. 3:0e']);
    // q(48) + e(24) + e rest(24) + q.(72) + e(24) = 192
    expect(tab.notes.map((note) => note.timeMs)).toEqual([0, 750, 1500, 2625]);
    expect(tab.notes.map((note) => [note.string, note.fret])).toEqual([[1, 0], [2, 1], [3, 0], [3, 0]]);
    expect(tab.initialBpm).toBe(80);
  });

  it('is free about spaces, and "|" splits bars', () => {
    const a = tabOf(['  1:0h   1:1h | 1:3w ']);
    const b = tabOf(['1:0h 1:1h', '1:3w']);
    expect(a.notes.map((n) => [n.timeMs, n.fret])).toEqual(b.notes.map((n) => [n.timeMs, n.fret]));
    expect(a.notes).toHaveLength(3);
  });

  it('counts triplets as a third of a beat', () => {
    const tab = tabOf(['1:0e3 1:1e3 1:3e3 1:0e3 1:1e3 1:3e3 1:0e3 1:1e3 1:3e3 1:0e3 1:1e3 1:3e3']);
    expect(tab.notes).toHaveLength(12);
    expect(tab.notes[3].timeMs).toBe(Math.round(60000 / 80));
  });

  it('marks the notes of a chord and judges the label root', () => {
    const tab = tabOf(['C[5:3 4:2 3:0 2:1]w']);
    expect(tab.notes).toHaveLength(4);
    expect(tab.notes[0].chord).toEqual({ label: 'C', rootClass: 0, toneClasses: expect.arrayContaining([0, 4, 7]) });
    expect(tab.notes.slice(1).every((note) => note.chordMember)).toBe(true);
    expect(countScorableNotes(tab.notes)).toBe(1);
  });

  it('holds a tied note instead of adding one', () => {
    const song = defineSong(info(), score(['1:0h 1:1h', '~1:1h 1:3h']));
    expect(song.noteCount(0)).toBe(3);
    const tab = song.buildTab(0);
    expect(tab.notes).toHaveLength(3);
    expect(tab.notes[1].durationMs).toBe(Math.round(2 * (60000 / 80) * 2));
  });

  it('accepts a pickup bar that is shorter than the signature', () => {
    const tab = tabOf(['1:0q', '1:1w'], {}, [1, 4]);
    expect(tab.notes.map((note) => note.timeMs)).toEqual([0, 750]);
    expect(tab.beatGrid[0].timeMs).toBeLessThanOrEqual(0);
  });

  it('rejects an invalid token, naming the piece, the bar and the token', () => {
    expect(() => tabOf(['1:0w', '1:0q 1:3x 1:0h'])).toThrow('Peça de teste (Melodia), compasso 2, token "1:3x"');
    expect(() => tabOf(['9:0w'])).toThrow('corda 9 não existe');
    expect(() => tabOf(['1:23w'])).toThrow('casa 23 fora do braço');
    expect(() => tabOf(['1:3 1:0h'])).toThrow('falta a duração');
    expect(() => tabOf(['banana 1:0h'])).toThrow('token "banana"');
    expect(() => tabOf(['rx 1:0h'])).toThrow('duração inválida');
    expect(() => tabOf(['[1:0 2:1]w'])).toThrow('token "[1:0 2:1]w"');
    expect(() => tabOf(['C[1:0]w'])).toThrow('pelo menos duas notas');
    expect(() => tabOf(['C[1:0 1:1]w'])).toThrow('mesma corda');
    expect(() => tabOf(['X[1:0 2:1]w'])).toThrow('começar por uma nota');
    expect(() => tabOf(['1:0h ~1:1h 1:0h'])).toThrow('ligadura');
    expect(() => tabOf(['~1:0w'])).toThrow('ligadura');
  });

  it('rejects a bar that is short or long', () => {
    expect(() => tabOf(['1:0q 1:0q 1:0q'])).toThrow('compasso 1: compasso curto');
    expect(() => tabOf(['1:0w', '1:0w 1:0q'])).toThrow('compasso 2: compasso longo');
    expect(() => tabOf(['1:0q', '1:0w'], {}, [1, 2])).toThrow('compasso 1: compasso curto');
    expect(() => tabOf(['1:0q 1:0q 1:0q 1:0q'], { timeSignature: [3, 4] })).toThrow('compasso longo');
  });
});

describe('defineSong', () => {
  it('refuses a note outside the declared key, unless the piece declares the accidental', () => {
    expect(() => tabOf(['1:0q 1:2q 1:0h'])).toThrow('notas fora da tonalidade: F# no compasso 1');
    expect(tabOf(['1:0q 1:2q 1:0h'], { key: { tonic: 'C', scale: 'major', accidentals: ['F#'] } }).notes).toHaveLength(3);
    expect(tabOf(['1:0q 1:2q 1:0h'], { key: { tonic: 'D', scale: 'major' } }).notes).toHaveLength(3);
  });

  it('refuses a composer who is not in the public domain yet', () => {
    expect(() => defineSong(info({ composerDeathYear: PUBLIC_DOMAIN_LAST_DEATH_YEAR + 1 }), score(['1:0w']))).toThrow('só entra obra');
    expect(() => defineSong(info({ composerDeathYear: PUBLIC_DOMAIN_LAST_DEATH_YEAR }), score(['1:0w']))).not.toThrow();
    // An original work of the PRGB has no death year; anyone else without one is refused
    expect(() => defineSong(info({ composer: 'Original', composerDeathYear: null }), score(['1:0w']))).not.toThrow();
    expect(() => defineSong(info({ composer: 'Tradicional', composerDeathYear: null }), score(['1:0w']))).not.toThrow();
    expect(() => defineSong(info({ composer: 'Beethoven', composerDeathYear: null }), score(['1:0w']))).toThrow('só vale obra original');
  });

  it('refuses invalid metadata and parts that do not match', () => {
    expect(() => defineSong(info({ level: 4 as 3 }), score(['1:0w']))).toThrow('nível');
    expect(() => defineSong(info({ bpm: 5 }), score(['1:0w']))).toThrow('andamento');
    expect(() => defineSong(info({ code: 10000 }), score(['1:0w']))).toThrow();
    expect(() => defineSong(info({ parts: [{ code: 0, name: 'A' }, { code: 0, name: 'B' }] }), score(['1:0w']))).toThrow('repetido');
    expect(() => defineSong(info({ parts: [{ code: 1, name: 'A' }] }), score(['1:0w']))).toThrow('não são as declaradas');
    expect(() => defineSong(info({ title: ' ' }), score(['1:0w']))).toThrow('obrigatórios');
  });

  it('builds the same tab every time', () => {
    const song = defineSong(info(), score(['1:0q 1:1q 1:3q 1:0q', 'C[5:3 4:2 3:0]w']));
    expect(song.buildTab(0)).toEqual(song.buildTab(0));
  });

  it('writes the id, title, composer and part name into the tab', () => {
    const tab = tabOf(['1:0w']);
    expect(tab.songId).toBe(songSongId(900, 0));
    expect(tab.title).toBe('Peça de teste');
    expect(tab.artist).toBe('Beethoven');
    expect(tab.trackName).toBe('Melodia');
  });
});

describe('the catalog', () => {
  it('never repeats a code or an id, and stays inside the repertoire range', () => {
    const codes = SONG_CATALOG.map((entry) => entry.info.code);
    expect(new Set(codes).size).toBe(codes.length);
    const ids = SONG_CATALOG.flatMap((entry) => entry.info.parts.map((part) => songSongId(entry.info.code, part.code)));
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(isRepertoireSongId(id)).toBe(true);
      expect(id).not.toBe(exerciseSongId(0, 0));
    }
  });

  it('keeps the ids already in use', () => {
    expect(findSongInfo(-200010)?.info.title).toBe('Ode à Alegria');
  });

  it('lists only metadata: the notes are a separate import', () => {
    for (const entry of SONG_CATALOG) {
      expect(Object.keys(entry.info)).not.toContain('bars');
      expect(typeof entry.load).toBe('function');
    }
  });

  for (const entry of SONG_CATALOG) {
    describe(entry.info.title, () => {
      it('is valid: bars add up, notes in key, frets 0 to 22, public domain', async () => {
        const song = await loadSong(entry.info.code);
        expect(song).not.toBeNull();
        for (const part of entry.info.parts) {
          const tab = song!.buildTab(part.code);
          expect(tab.notes.every((note) => note.fret >= 0 && note.fret <= 22)).toBe(true);
          expect(tab.notes.length).toBeGreaterThan(0);
        }
      });

      it('is counted by the shared normalizer exactly as written', async () => {
        const song = (await loadSong(entry.info.code))!;
        for (const part of entry.info.parts) {
          const tab = song.buildTab(part.code);
          expect(tab.notes).toHaveLength(song.noteCount(part.code));
          expect(countScorableNotes(tab.notes)).toBeGreaterThan(0);
        }
      });

      it('fits a challenge link, whose text filter refuses reserved words', async () => {
        const song = (await loadSong(entry.info.code))!;
        for (const part of entry.info.parts) {
          const tab = song.buildTab(part.code);
          const challenge = { v: 1 as const, songId: tab.songId, partId: 0, title: tab.title, artist: tab.artist, trackName: tab.trackName, score: 1000, accuracy: 90, nickname: null };
          expect(decodeChallenge(encodeChallenge(challenge))).toMatchObject({ songId: tab.songId, partId: 0, artist: tab.artist });
        }
      });

      it('comes back from its id, as a record or a challenge link would ask for it', async () => {
        for (const part of entry.info.parts) {
          const found = await findSongPart(songSongId(entry.info.code, part.code), 0);
          expect(found?.tab.songId).toBe(songSongId(entry.info.code, part.code));
          expect(found?.partId).toBe(0);
        }
      });
    });
  }

  it('plays Ode à Alegria: 16 bars, 64 beats at 72 bpm, the known melody', async () => {
    const part = (await findSongPart(-200010, 0))!;
    const notes = part.tab.notes;
    // 15 + 15 + 17 + 15 notes in the four phrases
    expect(Math.round(part.tab.totalDurationMs)).toBe(Math.round(16 * 4 * (60000 / 72)));
    expect(notes.slice(0, 5).map((note) => note.noteName)).toEqual(['E4', 'E4', 'F4', 'G4', 'G4']);
    expect(notes[notes.length - 1].noteName).toBe('C4');
    expect(notes).toHaveLength(62);
  });
});

describe('finding a piece again', () => {
  it('answers null for anything that is not a piece or a part', async () => {
    expect(await findSongPart(-1, 0)).toBeNull();
    expect(await findSongPart(exerciseSongId(60, 0), 0)).toBeNull();
    expect(await findSongPart(songSongId(9999, 0), 0)).toBeNull(); // no such piece
    expect(await findSongPart(-200011, 0)).toBeNull(); // no such part
    expect(await findSongPart(-200010, 1)).toBeNull(); // pieces have one partId
    expect(await findSongPart(-200010, 0.5)).toBeNull();
    expect(findSongInfo(-200011)).toBeNull();
  });

  it('loads each piece once and knows no other', async () => {
    const first = loadSong(1);
    expect(loadSong(1)).toBe(first);
    expect(await loadSong(2)).toBeNull();
  });
});

describe('records and challenges keep the repertoire ids', () => {
  const run = (overrides: Partial<RunResult>): RunResult => ({
    songId: -200010, partId: 0, title: 'Ode à Alegria', artist: 'Beethoven', trackName: 'Melodia', score: 1000,
    accuracy: 90, maxCombo: 20, perfect: 10, good: 5, miss: 2, speed: 1, mode: 'solo', playedAt: '2026-10-28T12:00:00.000Z', ...overrides
  });

  it('keeps the record of a piece', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    expect(recordRun(run({})).isPersonalBest).toBe(true);
    expect(getPersonalBest(-200010, 0, 1)?.score).toBe(1000);
    vi.unstubAllGlobals();
  });

  it('still drops the ids between the two ranges', () => {
    const storage = memoryStorage();
    expect(recordRun(run({ songId: -150000 }), storage).isPersonalBest).toBe(false);
    expect(recordRun(run({ songId: -300000 }), storage).isPersonalBest).toBe(false);
  });

  it('carries a piece through a link', () => {
    const sent = { v: 1 as const, songId: -200010, partId: 0, title: 'Ode à Alegria', artist: 'Beethoven', trackName: 'Melodia', score: 800, accuracy: 88, nickname: null };
    expect(decodeChallenge(encodeChallenge(sent))).toEqual(sent);
  });
});
