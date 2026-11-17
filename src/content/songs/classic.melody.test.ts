import { describe, expect, it } from 'vitest';
import { findSongPart } from '../../services/songs';
import { songSongId } from '../../services/songIds';

// Each melody is written here by name (sounding pitch) and length in beats, apart from the fret notation
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const nameOf = (midi: number): string => `${NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;

const expand = (text: string): [string, number][] =>
  text.trim().split(/\s+/).map((token) => {
    const [name, beats] = token.split('/');
    return [name, Number(beats)];
  });

const played = async (code: number) => {
  const part = (await findSongPart(songSongId(code, 0), 0))!;
  const beatMs = 60000 / part.tab.initialBpm;
  return { notes: part.tab.notes.map((note) => [nameOf(note.midiNote), Math.round((note.durationMs / beatMs) * 4) / 4] as [string, number]), part };
};

const startsOf = async (code: number): Promise<number[]> => {
  const part = (await findSongPart(songSongId(code, 0), 0))!;
  const beatMs = 60000 / part.tab.initialBpm;
  return part.tab.notes.map((note) => Math.round((note.timeMs / beatMs) * 4) / 4);
};

const startsFor = (melody: [string, number][]): number[] => {
  let at = 0;
  return melody.map(([, beats]) => { const start = at; at += beats; return start; });
};

// 3/4, strain A of the minuet, an octave below the piano score
const MINUET_STRAIN = `
  D4/1 G3/0.5 A3/0.5 B3/0.5 C4/0.5   D4/1 G3/1 G3/1
  E4/1 C4/0.5 D4/0.5 E4/0.5 F#4/0.5  G4/1 G3/1 G3/1
  C4/1 D4/0.5 C4/0.5 B3/0.5 A3/0.5   B3/1 C4/0.5 B3/0.5 A3/0.5 G3/0.5
  A3/1 B3/0.5 A3/0.5 G3/0.5 F#3/0.5  G3/3
`;

const STAR_A = 'C4/1 C4/1 G4/1 G4/1  A4/1 A4/1 G4/2';
const STAR_B = 'F4/1 F4/1 E4/1 E4/1  D4/1 D4/1 C4/2';
const STAR_C = 'G4/1 G4/1 F4/1 F4/1  E4/1 E4/1 D4/2';

describe('Minueto em Sol', () => {
  const melody = [...expand(MINUET_STRAIN), ...expand(MINUET_STRAIN)];
  it('has the notes and lengths of the known strain, played twice', async () => {
    const { notes } = await played(6);
    expect(notes).toEqual(melody);
    expect(await startsOf(6)).toEqual(startsFor(melody));
  });
  it('lasts between 30 and 90 seconds and ends on G', async () => {
    const { part, notes } = await played(6);
    expect(part.tab.totalDurationMs).toBeGreaterThanOrEqual(30000);
    expect(part.tab.totalDurationMs).toBeLessThanOrEqual(90000);
    expect(notes[notes.length - 1][0]).toBe('G3');
  });
});

describe('Brilha, brilha, estrelinha', () => {
  const melody = expand([STAR_A, STAR_B, STAR_C, STAR_C, STAR_A, STAR_B].join(' '));
  it('has the notes and lengths of the known tune', async () => {
    const { notes } = await played(7);
    expect(notes).toEqual(melody);
    expect(await startsOf(7)).toEqual(startsFor(melody));
  });
  it('lasts between 30 and 90 seconds and ends on C', async () => {
    const { part, notes } = await played(7);
    expect(part.tab.totalDurationMs).toBeGreaterThanOrEqual(30000);
    expect(part.tab.totalDurationMs).toBeLessThanOrEqual(90000);
    expect(notes[notes.length - 1][0]).toBe('C4');
  });
});
