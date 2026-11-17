import { describe, expect, it } from 'vitest';
import { loadSong } from '../../services/songs';

// Each melody is written again here by ear, as note names and beats, apart from the fret notation of the piece
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const nameOf = (midi: number): string => `${NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
const parse = (text: string): [string, number][] =>
  text.trim().split(/\s+/).map((token) => {
    const [name, beats] = token.split('/');
    return [name, Number(beats)];
  });

describe('Greensleeves', () => {
  // Name/beats; a tied-free melody with no rests, so each note starts where the previous one ends
  const expected = parse(`
    E4/1
    G4/2 A4/1  B4/1.5 C5/0.5 B4/1  A4/2 F#4/1  D4/1.5 E4/0.5 F#4/1
    G4/2 E4/1  E4/1.5 D#4/0.5 E4/1  F#4/2 D#4/1  B3/2 E4/1
    G4/2 A4/1  B4/1.5 C5/0.5 B4/1  A4/2 F#4/1  D4/1.5 E4/0.5 F#4/1
    G4/1.5 F#4/0.5 E4/1  D#4/1.5 C#4/0.5 D#4/1  E4/3
  `);

  it('has the melody as it is sung', async () => {
    const song = (await loadSong(2))!;
    const tab = song.buildTab(0);
    const beatMs = 60000 / song.info.bpm;
    expect(tab.notes.map((note) => nameOf(note.midiNote))).toEqual(expected.map(([name]) => name));
    let start = 0;
    expected.forEach(([, beats], index) => {
      expect(tab.notes[index].timeMs).toBeCloseTo(start * beatMs, 0);
      start += beats;
    });
    expect(start).toBe(46);
  });

  it('lasts between 30 and 90 seconds', async () => {
    const tab = (await loadSong(2))!.buildTab(0);
    expect(tab.totalDurationMs).toBeGreaterThanOrEqual(30000);
    expect(tab.totalDurationMs).toBeLessThanOrEqual(90000);
  });
});
