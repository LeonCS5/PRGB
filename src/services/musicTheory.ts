// Guitar theory the exercises are generated from: scales, positions on the neck and chord voicings. Pure data
// and functions, in standard tuning. Strings use the raw tab index: 0 = high E, 5 = low E.

export const TUNING = [64, 59, 55, 50, 45, 40];

// A key is a pitch class, 0 = C
export const KEYS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

const LOW_E = 5;
const A_STRING = 4;
const LAST_FRET = 22;

export interface FretNote {
  string: number;
  fret: number;
  midi: number;
}

const mod12 = (value: number): number => ((value % 12) + 12) % 12;

export const pitchClass = mod12;

export const fretNote = (string: number, fret: number): FretNote => ({ string, fret, midi: TUNING[string] + fret });

/** Fret of a key on a string, from `lowest` up. From fret 3 up there is room for the frets under the root. */
export const rootFret = (key: number, string: number = LOW_E, lowest = 3): number =>
  lowest + mod12(key - TUNING[string] - lowest);

// Semitones above the root
export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  naturalMinor: [0, 2, 3, 5, 7, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  melodicMinor: [0, 2, 3, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
  minorPentatonic: [0, 3, 5, 7, 10],
  majorPentatonic: [0, 2, 4, 7, 9],
  minorBlues: [0, 3, 5, 6, 7, 10],
  majorBlues: [0, 2, 3, 4, 7, 9],
  wholeTone: [0, 2, 4, 6, 8, 10],
  diminishedWholeHalf: [0, 2, 3, 5, 6, 8, 9, 11],
  diminishedHalfWhole: [0, 1, 3, 4, 6, 7, 9, 10]
} as const satisfies Record<string, readonly number[]>;

// The notes of a scale or chord from the root on the low E string up two octaves, in one position: a five-fret
// window with the first finger one fret under the root. A note reachable on two strings stays on the lower one.
export function positionNotes(key: number, intervals: readonly number[]): FretNote[] {
  const root = rootFret(key);
  const classes = new Set(intervals.map((interval) => mod12(key + interval)));
  const lowest = TUNING[LOW_E] + root;
  const highest = lowest + 24;
  const notes: FretNote[] = [];
  let last = lowest - 1;
  for (let string = LOW_E; string >= 0; string -= 1) {
    for (let fret = root - 1; fret <= root + 3; fret += 1) {
      const midi = TUNING[string] + fret;
      if (midi > last && midi <= highest && classes.has(mod12(midi))) {
        notes.push({ string, fret, midi });
        last = midi;
      }
    }
  }
  return notes;
}

const fitToNeck = (notes: FretNote[]): FretNote[] =>
  notes.some((note) => note.fret > LAST_FRET)
    ? notes.map((note) => ({ ...note, fret: note.fret - 12, midi: note.midi - 12 }))
    : notes;

// The same count of notes on each string, walking up the scale from one of its degrees on the low E string. Two
// per string on a pentatonic gives its five boxes; three per string on a seven-note scale, its three-note patterns.
export function notesPerString(key: number, intervals: readonly number[], perString: number, startDegree = 0): FretNote[] {
  const classes = new Set(intervals.map((interval) => mod12(key + interval)));
  let midi = TUNING[LOW_E] + rootFret(key) + intervals[startDegree];
  const notes: FretNote[] = [];
  for (let string = LOW_E; string >= 0; string -= 1) {
    for (let count = 0; count < perString; count += 1) {
      notes.push({ string, fret: midi - TUNING[string], midi });
      midi += 1;
      while (!classes.has(mod12(midi))) midi += 1;
    }
  }
  return fitToNeck(notes);
}

export type ChordQuality = 'maj' | 'min' | '7' | 'm7' | 'maj7' | 'm7b5' | 'dim7' | '5' | 'sus2' | 'sus4';

type Frets = readonly (number | null)[]; // low E to high E; null = not played

interface QualityShape {
  suffix: string;
  intervals: readonly number[];
  onLowE?: Frets; // frets above the root, with the root on the low E string
  onA?: Frets; // the same, with the root on the A string
}

// Movable shapes. Brazilian chord names: 7M for a major seventh.
const QUALITIES: Record<ChordQuality, QualityShape> = {
  maj: { suffix: '', intervals: [0, 4, 7], onLowE: [0, 2, 2, 1, 0, 0], onA: [null, 0, 2, 2, 2, 0] },
  min: { suffix: 'm', intervals: [0, 3, 7], onLowE: [0, 2, 2, 0, 0, 0], onA: [null, 0, 2, 2, 1, 0] },
  7: { suffix: '7', intervals: [0, 4, 7, 10], onLowE: [0, 2, 0, 1, 0, 0], onA: [null, 0, 2, 0, 2, 0] },
  m7: { suffix: 'm7', intervals: [0, 3, 7, 10], onLowE: [0, 2, 0, 0, 0, 0], onA: [null, 0, 2, 0, 1, 0] },
  maj7: { suffix: '7M', intervals: [0, 4, 7, 11], onLowE: [0, null, 1, 1, 0, null], onA: [null, 0, 2, 1, 2, 0] },
  m7b5: { suffix: 'm7(b5)', intervals: [0, 3, 6, 10], onLowE: [0, null, 0, 0, -1, null], onA: [null, 0, 1, 0, 1, null] },
  dim7: { suffix: '°', intervals: [0, 3, 6, 9], onLowE: [0, null, -1, 0, -1, null], onA: [null, 0, 1, -1, 1, null] },
  5: { suffix: '5', intervals: [0, 7], onLowE: [0, 2, 2, null, null, null], onA: [null, 0, 2, 2, null, null] },
  sus2: { suffix: 'sus2', intervals: [0, 2, 7], onA: [null, 0, 2, 2, 0, 0] },
  sus4: { suffix: 'sus4', intervals: [0, 5, 7], onLowE: [0, 2, 2, 2, 0, 0], onA: [null, 0, 2, 2, 3, 0] }
};

export const chordIntervals = (quality: ChordQuality): readonly number[] => QUALITIES[quality].intervals;

export const chordName = (root: number, quality: ChordQuality): string => `${KEYS[mod12(root)]}${QUALITIES[quality].suffix}`;

export interface Voicing {
  label: string;
  rootClass: number;
  toneClasses: number[];
  notes: FretNote[]; // lowest first
}

const voicing = (root: number, quality: ChordQuality, frets: Frets): Voicing => ({
  label: chordName(root, quality),
  rootClass: mod12(root),
  toneClasses: QUALITIES[quality].intervals.map((interval) => mod12(root + interval)),
  notes: frets.flatMap((fret, index) => (fret === null ? [] : [fretNote(LOW_E - index, fret)]))
});

const atFret = (shape: Frets, root: number): Frets => shape.map((fret) => (fret === null ? null : fret + root));

export type ShapeString = 'lowE' | 'a';

/** A barre or movable voicing. Without `shape`, the one nearest to `nearFret`, so changes stay short. */
export function movableChord(root: number, quality: ChordQuality, nearFret = 5, shape?: ShapeString): Voicing {
  const { onLowE, onA } = QUALITIES[quality];
  // Fret 2 up, since some shapes reach one fret under the root
  const lowFret = rootFret(root, LOW_E, 2);
  const aFret = rootFret(root, A_STRING, 2);
  const useLowE = shape === 'lowE'
    || (shape !== 'a' && onLowE !== undefined && (onA === undefined || Math.abs(lowFret - nearFret) <= Math.abs(aFret - nearFret)));
  const frets = useLowE ? onLowE : onA;
  if (!frets) throw new Error(`Shape not available: ${quality}`);
  return voicing(root, quality, atFret(frets, useLowE ? lowFret : aFret));
}

const OPEN_CHORDS = {
  C: [0, 'maj', [null, 3, 2, 0, 1, 0]],
  A: [9, 'maj', [null, 0, 2, 2, 2, 0]],
  G: [7, 'maj', [3, 2, 0, 0, 0, 3]],
  E: [4, 'maj', [0, 2, 2, 1, 0, 0]],
  D: [2, 'maj', [null, null, 0, 2, 3, 2]],
  F: [5, 'maj', [1, 3, 3, 2, 1, 1]],
  Am: [9, 'min', [null, 0, 2, 2, 1, 0]],
  Em: [4, 'min', [0, 2, 2, 0, 0, 0]],
  Dm: [2, 'min', [null, null, 0, 2, 3, 1]],
  A7: [9, '7', [null, 0, 2, 0, 2, 0]],
  B7: [11, '7', [null, 2, 1, 2, 0, 2]],
  C7: [0, '7', [null, 3, 2, 3, 1, 0]],
  D7: [2, '7', [null, null, 0, 2, 1, 2]],
  E7: [4, '7', [0, 2, 0, 1, 0, 0]],
  G7: [7, '7', [3, 2, 0, 0, 0, 1]],
  Am7: [9, 'm7', [null, 0, 2, 0, 1, 0]],
  Em7: [4, 'm7', [0, 2, 0, 0, 0, 0]],
  Dm7: [2, 'm7', [null, null, 0, 2, 1, 1]],
  'C7M': [0, 'maj7', [null, 3, 2, 0, 0, 0]],
  'D7M': [2, 'maj7', [null, null, 0, 2, 2, 2]],
  'F7M': [5, 'maj7', [null, null, 3, 2, 1, 0]],
  'G7M': [7, 'maj7', [3, 2, 0, 0, 0, 2]],
  Asus2: [9, 'sus2', [null, 0, 2, 2, 0, 0]],
  Asus4: [9, 'sus4', [null, 0, 2, 2, 3, 0]],
  Dsus2: [2, 'sus2', [null, null, 0, 2, 3, 0]],
  Dsus4: [2, 'sus4', [null, null, 0, 2, 3, 3]],
  Esus4: [4, 'sus4', [0, 2, 2, 2, 0, 0]],
  E5: [4, '5', [0, 2, 2, null, null, null]],
  A5: [9, '5', [null, 0, 2, 2, null, null]]
} as const satisfies Record<string, readonly [number, ChordQuality, Frets]>;

export type OpenChordName = keyof typeof OPEN_CHORDS;

export const OPEN_CHORD_NAMES = Object.keys(OPEN_CHORDS) as OpenChordName[];

export const openChord = (name: OpenChordName): Voicing => {
  const [root, quality, frets] = OPEN_CHORDS[name];
  return voicing(root, quality, frets);
};
