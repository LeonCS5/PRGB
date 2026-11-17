// Locks each original piece to the melody as it was composed, written here separately in note names and beats
// (not in strings and frets), so a wrong fret, string or rhythm in the transcription shows up as a failure.
// Syntax: NAME@BEATS plays a note for that many beats ("E2@.5", "A2@2/3"); r@BEATS is a rest; "|" marks a bar line.

import { describe, expect, it } from 'vitest';
import { loadSong } from '../../services/songs';

const PITCH_CLASS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

const midiOf = (name: string): number => {
  const match = /^([A-G])([#b]?)(\d)$/.exec(name);
  if (!match) throw new Error(`bad note name ${name}`);
  return 12 * (Number(match[3]) + 1) + PITCH_CLASS[match[1]] + (match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0);
};

const beats = (text: string): number => {
  const [top, bottom] = text.split('/');
  return bottom ? Number(top) / Number(bottom) : Number(top);
};

interface Expected {
  midi: number;
  start: number;
  length: number;
}

// Reads the melody text into notes with start and length in beats; every bar must hold exactly four beats
const melody = (text: string): Expected[] => {
  const notes: Expected[] = [];
  let clock = 0;
  text.split('|').forEach((bar, index) => {
    const barStart = clock;
    for (const token of bar.trim().split(/\s+/)) {
      const [name, length] = token.split('@');
      if (name !== 'r') notes.push({ midi: midiOf(name), start: clock, length: beats(length) });
      clock += beats(length);
    }
    expect(clock - barStart, `bar ${index + 1} of the written melody`).toBeCloseTo(4, 6);
  });
  return notes;
};

const play = async (code: number) => {
  const song = await loadSong(code);
  const tab = song!.buildTab(0);
  return tab.notes.map((note) => ({
    midi: note.midiNote,
    start: (note.timeMs * tab.initialBpm) / 60000,
    length: (note.durationMs * tab.initialBpm) / 60000
  }));
};

const expectSame = (actual: Expected[], expected: Expected[]): void => {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((note, index) => {
    const want = expected[index];
    expect(note.midi, `note ${index + 1}`).toBe(want.midi);
    expect(Math.abs(note.start - want.start), `start of note ${index + 1}`).toBeLessThan(0.02);
    expect(Math.abs(note.length - want.length), `length of note ${index + 1}`).toBeLessThan(0.02);
  });
};

// Rock riff in E minor: E E G E A B (motive), the same ending on G, an answer an octave up, a rising run
const rockMotive = 'E2@.5 E2@.5 G2@1 E2@.5 A2@.5 B2@1';
const rockMotiveDown = 'E2@.5 E2@.5 G2@1 E2@.5 A2@.5 G2@1';
const ROCK = [
  rockMotive, rockMotiveDown, rockMotive, 'B2@.5 A2@.5 G2@.5 E2@.5 E2@2',
  'E3@.5 E3@.5 D3@1 B2@.5 B2@.5 A2@1', 'E3@.5 E3@.5 D3@1 B2@.5 A2@.5 G2@1', 'A2@.5 B2@.5 D3@.5 E3@.5 D3@1 B2@1', 'A2@1 G2@1 E2@2',
  rockMotive, rockMotiveDown, rockMotive, 'A2@.5 G2@.5 E2@1 E2@1 r@1',
  'E2@.5 G2@.5 A2@.5 B2@.5 D3@.5 E3@.5 D3@.5 B2@.5', 'A2@.5 G2@.5 E2@.5 G2@.5 A2@.5 G2@.5 E2@1', 'E3@1 D3@1 B2@1 A2@1', 'G2@1 A2@1 E2@2'
].join(' | ');

// Blues in A, swung eighths: A C D Eb E C, then the same ending on D, E D C A to land, IV bars on D, V, turnaround
const swing = (first: string, second: string): string => `${first}@2/3 ${second}@1/3`;
const bluesRiff = `${swing('A2', 'C3')} ${swing('D3', 'Eb3')} E3@1 C3@1`;
const bluesRiffHigh = `${swing('A2', 'C3')} ${swing('D3', 'Eb3')} E3@1 D3@1`;
const bluesDown = `${swing('E3', 'D3')} ${swing('C3', 'A2')} A2@2`;
const BLUES = [
  bluesRiff, bluesRiffHigh, bluesRiff, bluesDown,
  `${swing('D3', 'G3')} ${swing('A3', 'G3')} D3@1 G3@1`, `${swing('D3', 'G3')} ${swing('A3', 'C4')} A3@1 G3@1`,
  bluesRiff, bluesDown,
  `${swing('E3', 'G3')} ${swing('A3', 'G3')} E3@2`, `${swing('D3', 'G3')} ${swing('A3', 'G3')} D3@2`, bluesRiff,
  `${swing('E3', 'G3')} ${swing('E3', 'D3')} C3@1 A2@1`,
  bluesRiff, bluesDown
].join(' | ');

// Funk riff in D minor on sixteenths: call, lower answer, high eighths, the call again, a closing line
const sixteenths = (text: string): string => text.split(' ').map((name) => `${name}@.25`).join(' ');
const funkCall = sixteenths('D3 r D3 F3 r D3 G3 r D3 r D3 F3 G3 A3 r D3');
const funkAnswer = sixteenths('A2 r A2 C3 r A2 C3 r D3 r C3 A2 G2 r A2 r');
const funkCallEnd = `${sixteenths('D3 r D3 F3 r D3 G3 r')} F3@.5 D3@.5 C3@.5 A2@.5`;
const funkHigh = 'D4@.5 C4@.25 D4@.25 F4@.5 D4@.5 C4@.5 A3@.5 G3@.5 D3@.5';
const funkHigher = 'G4@.5 F4@.25 G4@.25 A4@.5 G4@.5 F4@.5 D4@.5 C4@.5 A3@.5';
const FUNK = [
  funkCall, funkAnswer, funkCall, funkCallEnd,
  funkHigh, funkHigher, funkHigh, 'F4@.5 D4@.5 C4@.5 A3@.5 G3@.5 F3@.5 D3@.5 r@.5',
  funkCall, funkAnswer, funkCall, funkCallEnd,
  funkCall, funkAnswer, funkCall, 'D3@1 r@.5 A2@.5 D3@2'
].join(' | ');

// Octave-jump riff in G: G3 G4 G3 G4 A3 A4 A3 A4 / B3 B4 B3 B4 G3 G4 G3 G4 / D3 D4 D3 D4 E3 E4 E3 E4, then a bridge
const octaves = (...names: string[]): string => names.map((name) => `${name}@.5`).join(' ');
const jumpGA = octaves('G3', 'G4', 'G3', 'G4', 'A3', 'A4', 'A3', 'A4');
const jumpBG = octaves('B3', 'B4', 'B3', 'B4', 'G3', 'G4', 'G3', 'G4');
const jumpDE = octaves('D3', 'D4', 'D3', 'D4', 'E3', 'E4', 'E3', 'E4');
const OCTAVES = [
  jumpGA, jumpBG, jumpGA, `${octaves('G3', 'G4', 'G3', 'G4')} D3@2`,
  jumpDE, jumpBG, jumpGA, `${octaves('A3', 'A4', 'D3', 'D4')} G3@2`,
  'G4@1 G3@1 A4@1 A3@1', 'B4@1 B3@1 A4@1 A3@1', 'G4@1.5 G3@.5 G4@1 G3@1', 'D4@1 D3@1 E3@1 D3@1',
  jumpGA, jumpBG, jumpDE, `${octaves('G3', 'G4')} G3@1 G4@2`
].join(' | ');

const PIECES: [string, number, string, number][] = [
  ['Riff de rock em Mi menor', 10, ROCK, 100],
  ['Riff de blues em Lá', 11, BLUES, 84],
  ['Riff funk em Ré menor', 12, FUNK, 92],
  ['Riff com saltos de oitava em Sol', 13, OCTAVES, 112]
];

describe('original melodies', () => {
  for (const [title, code, text, bpm] of PIECES) {
    it(`${title}: notes and rhythm match the written melody`, async () => {
      expectSame(await play(code), melody(text));
      const seconds = (text.split('|').length * 4 * 60) / bpm;
      expect(seconds).toBeGreaterThanOrEqual(30);
      expect(seconds).toBeLessThanOrEqual(90);
    });
  }

  it('the riffs close on their tonic after a stepwise or leaping approach', async () => {
    const last = async (code: number) => (await play(code)).at(-1)!.midi % 12;
    expect(await last(10)).toBe(4); // E
    expect(await last(11)).toBe(9); // A
    expect(await last(12)).toBe(2); // D
    expect(await last(13)).toBe(7); // G
  });
});

// Chord progressions: label, the notes the voicing sounds (low to high), and length in beats
type Chord = [string, string[], number];
const CHORDS: Record<string, [string, string[]]> = {
  C: ['C', ['C3', 'E3', 'G3', 'C4']],
  Am: ['Am', ['A2', 'E3', 'A3', 'C4']],
  F: ['F', ['F3', 'A3', 'C4', 'F4']],
  G: ['G', ['G2', 'B2', 'D3', 'G3']]
};
const chord = (name: string, length: number): Chord => [CHORDS[name][0], CHORDS[name][1], length];
const barOf = (name: string, ...lengths: number[]): Chord[] => lengths.map((length) => chord(name, length));
const passOf = (...lengths: number[]): Chord[] => ['C', 'Am', 'F', 'G'].flatMap((name) => barOf(name, ...lengths));

const MAJOR_PROGRESSION: Chord[] = [
  ...passOf(4), ...passOf(2, 2), ...passOf(1, 1, 2),
  ...barOf('C', 1, 1, 1, 1), ...barOf('Am', 1, 1, 1, 1), ...barOf('F', 2), ...barOf('G', 2), ...barOf('C', 4)
];
const strum = (name: string): Chord[] => barOf(name, 1.5, 1.5, 1);
const MINOR_PROGRESSION: Chord[] = [
  ...['Am', 'F', 'C', 'G'].flatMap(strum), ...['Am', 'F', 'C', 'G'].flatMap(strum),
  ...['Am', 'F', 'C'].flatMap(strum), ...barOf('G', 1.5, 1.5, 0.5, 0.5),
  ...strum('Am'), ...strum('F'), ...barOf('C', 2), ...barOf('G', 2), ...barOf('Am', 4)
];

describe('original progressions', () => {
  const cases: [string, number, Chord[], number][] = [
    ['Progressão em Dó maior (I-vi-IV-V)', 14, MAJOR_PROGRESSION, 76],
    ['Progressão em Lá menor (i-VI-III-VII)', 15, MINOR_PROGRESSION, 88]
  ];
  for (const [title, code, expected, bpm] of cases) {
    it(`${title}: chords, voicings and rhythm match the written progression`, async () => {
      const song = await loadSong(code);
      const tab = song!.buildTab(0);
      const wanted = expected.flatMap(([label, names, length], index) => {
        const start = expected.slice(0, index).reduce((sum, item) => sum + item[2], 0);
        return names.map((name, position) => ({ label: position === 0 ? label : undefined, midi: midiOf(name), start, length }));
      });
      expect(tab.notes).toHaveLength(wanted.length);
      tab.notes.forEach((note, index) => {
        const want = wanted[index];
        expect(note.midiNote, `note ${index + 1}`).toBe(want.midi);
        expect(note.chord?.label, `chord label at note ${index + 1}`).toBe(want.label);
        expect(Math.abs((note.timeMs * bpm) / 60000 - want.start), `start of note ${index + 1}`).toBeLessThan(0.02);
        expect(Math.abs((note.durationMs * bpm) / 60000 - want.length), `length of note ${index + 1}`).toBeLessThan(0.02);
      });
      const bars = expected.reduce((sum, item) => sum + item[2], 0) / 4;
      expect(bars).toBe(16);
      const seconds = (bars * 4 * 60) / bpm;
      expect(seconds).toBeGreaterThanOrEqual(30);
      expect(seconds).toBeLessThanOrEqual(90);
    });
  }
});
