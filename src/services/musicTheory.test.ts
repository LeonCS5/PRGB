import { describe, expect, it } from 'vitest';
import {
  KEYS,
  OPEN_CHORD_NAMES,
  SCALES,
  TUNING,
  chordIntervals,
  chordName,
  fretNote,
  movableChord,
  notesPerString,
  openChord,
  pitchClass,
  positionNotes,
  rootFret,
  type ChordQuality,
  type FretNote
} from './musicTheory';

const ALL_KEYS = KEYS.map((_, key) => key);
const fretsByString = (notes: FretNote[]) => notes.map((note) => `${6 - (5 - note.string)}:${note.fret}`);
const names = (notes: FretNote[]) => notes.map((note) => KEYS[pitchClass(note.midi)]);

describe('rootFret', () => {
  it('finds the key on a string, with room below it', () => {
    expect(rootFret(9)).toBe(5); // A on the low E string
    expect(rootFret(7)).toBe(3); // G
    expect(rootFret(4)).toBe(12); // E, up the neck: fret 0 has nothing under it
    expect(rootFret(0, 4)).toBe(3); // C on the A string
  });

  it('always lands on the key', () => {
    for (const key of ALL_KEYS) {
      for (const string of [0, 1, 2, 3, 4, 5]) expect(pitchClass(TUNING[string] + rootFret(key, string))).toBe(key);
    }
  });
});

describe('scale formulas', () => {
  it('match the seven modes, each a rotation of the major scale', () => {
    const rotate = (degree: number) => {
      const rotated = [...SCALES.major.slice(degree), ...SCALES.major.slice(0, degree).map((step) => step + 12)];
      return rotated.map((step) => step - SCALES.major[degree]);
    };
    expect(rotate(1)).toEqual([...SCALES.dorian]);
    expect(rotate(2)).toEqual([...SCALES.phrygian]);
    expect(rotate(3)).toEqual([...SCALES.lydian]);
    expect(rotate(4)).toEqual([...SCALES.mixolydian]);
    expect(rotate(5)).toEqual([...SCALES.naturalMinor]);
    expect(rotate(6)).toEqual([...SCALES.locrian]);
  });

  it('keep the relative pentatonics apart by a minor third', () => {
    const fromMinorThird = SCALES.minorPentatonic.map((step) => pitchClass(step - 3)).toSorted((a, b) => a - b);
    expect(fromMinorThird).toEqual([...SCALES.majorPentatonic]);
  });
});

describe('positionNotes', () => {
  it('writes the known G major position', () => {
    const up = positionNotes(7, SCALES.major);
    expect(names(up).slice(0, 8)).toEqual(['G', 'A', 'B', 'C', 'D', 'E', 'F#', 'G']);
    expect(fretsByString(up).slice(0, 8)).toEqual(['6:3', '6:5', '5:2', '5:3', '5:5', '4:2', '4:4', '4:5']);
  });

  it('adds the blue note to the first A minor box', () => {
    const up = positionNotes(9, SCALES.minorBlues);
    expect(fretsByString(up)).toEqual(['6:5', '6:8', '5:5', '5:6', '5:7', '4:5', '4:7', '3:5', '3:7', '3:8', '2:5', '2:8', '1:5']);
  });

  it('spells a C major arpeggio over two octaves', () => {
    const up = positionNotes(0, chordIntervals('maj'));
    expect(up.map((note) => note.midi)).toEqual([48, 52, 55, 60, 64, 67, 72]);
  });

  for (const [name, intervals] of Object.entries(SCALES)) {
    it(`${name}: climbs two octaves, in the scale and inside one position, in every key`, () => {
      for (const key of ALL_KEYS) {
        const up = positionNotes(key, intervals);
        const allowed = new Set(intervals.map((step) => pitchClass(key + step)));
        expect(pitchClass(up[0].midi)).toBe(key);
        expect(up.at(-1)?.midi).toBe(up[0].midi + 24);
        up.forEach((note, index) => {
          expect(allowed.has(pitchClass(note.midi))).toBe(true);
          expect(note.midi).toBe(TUNING[note.string] + note.fret);
          if (index > 0) expect(note.midi).toBeGreaterThan(up[index - 1].midi);
        });
        const frets = up.map((note) => note.fret);
        expect(Math.max(...frets) - Math.min(...frets)).toBeLessThanOrEqual(4);
        // Both octaves have every note of the scale
        const low = new Set(up.filter((note) => note.midi < up[0].midi + 12).map((note) => pitchClass(note.midi)));
        const high = new Set(up.filter((note) => note.midi >= up[0].midi + 12).map((note) => pitchClass(note.midi)));
        expect([name, key, low.size]).toEqual([name, key, intervals.length]);
        expect([name, key, high.size]).toEqual([name, key, intervals.length]);
      }
    });
  }
});

describe('notesPerString', () => {
  it('rebuilds the first A minor pentatonic box of the demo', () => {
    const box = notesPerString(9, SCALES.minorPentatonic, 2);
    expect(box.map((note) => [note.string, note.fret])).toEqual([
      [5, 5], [5, 8], [4, 5], [4, 7], [3, 5], [3, 7], [2, 5], [2, 7], [1, 5], [1, 8], [0, 5], [0, 8]
    ]);
  });

  it('writes the second box', () => {
    const box = notesPerString(9, SCALES.minorPentatonic, 2, 1);
    expect(box.map((note) => note.fret)).toEqual([8, 10, 7, 10, 7, 10, 7, 9, 8, 10, 8, 10]);
  });

  it('writes the classic three-note pattern of G major', () => {
    const notes = notesPerString(7, SCALES.major, 3);
    expect(notes.slice(0, 6).map((note) => note.fret)).toEqual([3, 5, 7, 3, 5, 7]);
    expect(notes).toHaveLength(18);
  });

  it('stays on the neck in every key, for all the boxes', () => {
    for (const key of ALL_KEYS) {
      for (const intervals of [SCALES.minorPentatonic, SCALES.majorPentatonic]) {
        for (let degree = 0; degree < 5; degree += 1) {
          const box = notesPerString(key, intervals, 2, degree);
          const frets = box.map((note) => note.fret);
          expect(Math.min(...frets)).toBeGreaterThanOrEqual(0);
          expect(Math.max(...frets)).toBeLessThanOrEqual(22);
          expect(Math.max(...frets) - Math.min(...frets)).toBeLessThanOrEqual(5);
        }
      }
    }
  });
});

describe('chords', () => {
  const classes = (notes: FretNote[]) => [...new Set(notes.map((note) => pitchClass(note.midi)))];

  it.each(OPEN_CHORD_NAMES)('%s plays only its chord notes, and can only leave out the fifth', (name) => {
    const chord = openChord(name);
    const played = classes(chord.notes);
    expect(chord.label).toBe(name);
    expect(played.every((pitch) => chord.toneClasses.includes(pitch))).toBe(true);
    const missing = chord.toneClasses.filter((pitch) => !played.includes(pitch));
    expect(missing.every((pitch) => pitch === pitchClass(chord.rootClass + 7))).toBe(true);
    expect(pitchClass(chord.notes[0].midi)).toBe(chord.rootClass);
  });

  it('writes an F barre chord on the first fret', () => {
    expect(movableChord(5, 'maj', 1, 'lowE').notes.map((note) => note.fret)).toEqual([13, 15, 15, 14, 13, 13].map((fret) => fret));
  });

  it('writes the known barre shapes', () => {
    expect(movableChord(7, 'maj', 3, 'lowE').notes.map((note) => note.fret)).toEqual([3, 5, 5, 4, 3, 3]); // G
    expect(movableChord(0, 'min', 3, 'a').notes.map((note) => note.fret)).toEqual([3, 5, 5, 4, 3]); // Cm
    expect(movableChord(9, '7', 5, 'lowE').notes.map((note) => note.fret)).toEqual([5, 7, 5, 6, 5, 5]); // A7
  });

  const qualities: ChordQuality[] = ['maj', 'min', '7', 'm7', 'maj7', 'm7b5', 'dim7', '5', 'sus2', 'sus4'];

  it.each(qualities)('%s: every movable voicing has its chord notes, root in the bass, in every key', (quality) => {
    for (const key of ALL_KEYS) {
      for (const shape of ['lowE', 'a'] as const) {
        if (quality === 'sus2' && shape === 'lowE') continue;
        const chord = movableChord(key, quality, 5, shape);
        const allowed = new Set(chordIntervals(quality).map((step) => pitchClass(key + step)));
        expect(pitchClass(chord.notes[0].midi)).toBe(key);
        expect(chord.rootClass).toBe(key);
        for (const pitch of classes(chord.notes)) expect(allowed.has(pitch)).toBe(true);
        expect(classes(chord.notes)).toHaveLength(allowed.size);
        const frets = chord.notes.map((note) => note.fret);
        expect(Math.min(...frets)).toBeGreaterThanOrEqual(1);
        expect(Math.max(...frets) - Math.min(...frets)).toBeLessThanOrEqual(3);
        expect(new Set(chord.notes.map((note) => note.string)).size).toBe(chord.notes.length);
      }
    }
  });

  it('stays near the fret asked for', () => {
    expect(movableChord(0, 'maj', 3).notes[0]).toEqual(fretNote(4, 3)); // C on the A string, not fret 8 on the low E
    expect(movableChord(7, 'maj', 3).notes[0]).toEqual(fretNote(5, 3)); // G on the low E string
  });

  it('names chords the Brazilian way', () => {
    expect(chordName(0, 'maj7')).toBe('C7M');
    expect(chordName(9, 'min')).toBe('Am');
    expect(chordName(11, 'm7b5')).toBe('Bm7(b5)');
    expect(chordName(13, 'maj')).toBe('C#');
  });
});
