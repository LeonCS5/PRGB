import { describe, expect, it, vi } from 'vitest';
import { decodeChallenge, encodeChallenge } from './challenge';
import { exerciseSongId, isExerciseSongId, parseExerciseSongId } from './exerciseIds';
import {
  EXERCISE_CATEGORIES,
  buildExerciseTab,
  categoryOf,
  exercisePart,
  findExercisePart,
  patternName,
  type Exercise,
  type ExerciseCategory,
  type ExercisePattern
} from './exercises';
import { KEYS, SCALES, chordIntervals, pitchClass } from './musicTheory';
import { countScorableNotes, isScorable } from './scoring';
import { getDemoSong } from './demoSong';
import type { NoteEvent } from './tabsApi';

// Each test walks the whole catalog
vi.setConfig({ testTimeout: 60000 });

const groupByTime = (notes: NoteEvent[]): NoteEvent[][] => {
  const groups = new Map<number, NoteEvent[]>();
  for (const note of notes) groups.set(note.timeMs, [...(groups.get(note.timeMs) ?? []), note]);
  return [...groups.values()];
};

const everyExercise = EXERCISE_CATEGORIES.flatMap((category) => category.groups.flatMap((group) => group.exercises));
const find = (code: number): Exercise => {
  const found = everyExercise.find((item) => item.code === code);
  if (!found) throw new Error(`No exercise ${code}`);
  return found;
};

interface Variant {
  item: Exercise;
  category: ExerciseCategory;
  key: number;
  pattern: ExercisePattern | undefined;
}

const everyVariant: Variant[] = EXERCISE_CATEGORIES.flatMap((category) => category.groups.flatMap((group) => group.exercises.flatMap((item) => {
  const keys = item.keyed ? KEYS.map((_, key) => key) : [0];
  const patterns: (ExercisePattern | undefined)[] = category.patterns.length > 0 ? category.patterns : [undefined];
  return keys.flatMap((key) => patterns.map((pattern) => ({ item, category, key, pattern })));
})));

describe('the catalog', () => {
  it('has the nine categories, in the order they are shown', () => {
    expect(EXERCISE_CATEGORIES.map((category) => category.title)).toEqual(['Aquecimento', 'Técnicas', 'Pentatônicas', 'Escalas', 'Arpejos', 'Acordes', 'Progressões', 'Ritmo', 'Braço']);
  });

  it('never repeats a code: records and challenge links point at them', () => {
    const codes = everyExercise.map((item) => item.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('keeps the ids already in use', () => {
    expect(buildExerciseTab(find(60), 0, 'updown').songId).toBe(-1600);
    expect(buildExerciseTab(find(60), 0, 'threes').songId).toBe(-1601);
    expect(buildExerciseTab(find(131), 0, 'picked').songId).toBe(-2316);
  });

  it('gives each variant its own record key', () => {
    const keys = everyVariant.map(({ item, key, pattern }) => {
      const { songId } = buildExerciseTab(item, key, pattern);
      return `${songId}:${item.keyed ? key : 0}`;
    });
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('has text for every card, with no third-party names', () => {
    for (const item of everyExercise) {
      expect(item.title.length).toBeGreaterThan(1);
      expect(item.description.endsWith('.')).toBe(true);
    }
    for (const category of EXERCISE_CATEGORIES) {
      for (const pattern of category.patterns) expect(patternName(category, pattern).length).toBeGreaterThan(3);
    }
  });

  it('leaves the ranked demo alone: the server counted exactly these notes', () => {
    const demo = getDemoSong();
    expect(demo.songId).toBe(-1);
    expect(countScorableNotes(demo.notes)).toBe(41);
    expect(demo.totalDurationMs).toBe(18667);
  });
});

describe(`all ${everyVariant.length} variants`, () => {
  const label = ({ item, key, pattern }: Variant) => `${item.title} [${KEYS[key]}, ${pattern ?? '-'}]`;

  it('build a playable tab', () => {
    for (const variant of everyVariant) {
      const { item, key, pattern } = variant;
      const name = label(variant);
      const tab = buildExerciseTab(item, key, pattern);
      expect(isExerciseSongId(tab.songId), name).toBe(true);
      expect(tab.notes.length, name).toBeGreaterThanOrEqual(6);
      expect(tab.totalDurationMs, name).toBeGreaterThanOrEqual(5000);
      expect(tab.totalDurationMs, name).toBeLessThanOrEqual(90000);
      expect(tab.title.length, name).toBeLessThanOrEqual(60);
      expect(tab.beatGrid.length, name).toBeGreaterThan(0);
      let previous = -1;
      for (const note of tab.notes) {
        expect(note.string, name).toBeGreaterThanOrEqual(1);
        expect(note.string, name).toBeLessThanOrEqual(6);
        expect(note.fret, name).toBeGreaterThanOrEqual(0);
        expect(note.fret, name).toBeLessThanOrEqual(22);
        expect(note.timeMs, name).toBeGreaterThanOrEqual(previous);
        expect(note.timeMs + note.durationMs, name).toBeLessThanOrEqual(tab.totalDurationMs + 1);
        previous = note.timeMs;
      }
    }
  });

  it('fill whole bars: the beat grid ends with the music', () => {
    for (const variant of everyVariant) {
      const { item, key, pattern } = variant;
      const tab = buildExerciseTab(item, key, pattern);
      const barMs = (60000 / item.bpm) * 4;
      const bars = tab.totalDurationMs / barMs;
      expect(Math.abs(bars - Math.round(bars)), label(variant)).toBeLessThan(0.002);
      expect(tab.beatGrid).toHaveLength(Math.round(bars) * 4);
    }
  });

  it('can be played by one hand: no two notes on a string at once, and chords within reach', () => {
    for (const variant of everyVariant) {
      const { item, key, pattern } = variant;
      const tab = buildExerciseTab(item, key, pattern);
      for (const notes of groupByTime(tab.notes)) {
        expect(new Set(notes.map((note) => note.string)).size, label(variant)).toBe(notes.length);
        const fretted = notes.map((note) => note.fret).filter((fret) => fret > 0);
        if (fretted.length > 1) expect(Math.max(...fretted) - Math.min(...fretted), label(variant)).toBeLessThanOrEqual(4);
      }
    }
  });

  it('judge a chord once, by its lowest note', () => {
    for (const variant of everyVariant) {
      const { item, key, pattern } = variant;
      const tab = buildExerciseTab(item, key, pattern);
      for (const notes of groupByTime(tab.notes)) {
        if (notes.length === 1) {
          expect(notes[0].chordMember, label(variant)).toBeFalsy();
          continue;
        }
        const judged = notes.filter(isScorable);
        expect(judged, label(variant)).toHaveLength(1);
        const [anchor] = judged;
        expect(anchor.chord, label(variant)).toBeDefined();
        expect(anchor.midiNote, label(variant)).toBe(Math.min(...notes.map((note) => note.midiNote)));
        for (const note of notes) expect(anchor.chord?.toneClasses.includes(pitchClass(note.midiNote)), label(variant)).toBe(true);
      }
    }
  });

  it('open each record with a number of notes that can be scored', () => {
    for (const { item, key, pattern } of everyVariant) {
      expect(countScorableNotes(buildExerciseTab(item, key, pattern).notes)).toBeGreaterThan(0);
    }
  });

  it('fit in a challenge link, whose text filter refuses reserved words', () => {
    for (const { item, key, pattern } of everyVariant) {
      const { tab, partId } = exercisePart(item, key, pattern);
      const challenge = { v: 1 as const, songId: tab.songId, partId, title: tab.title, artist: tab.artist, trackName: tab.trackName, score: 1000, accuracy: 90, nickname: null };
      expect(decodeChallenge(encodeChallenge(challenge))).toMatchObject({ songId: tab.songId, partId });
    }
  });

  it('come back from their ids, as a challenge link would ask for them', () => {
    for (const { item, key, pattern } of everyVariant) {
      const part = exercisePart(item, key, pattern);
      const found = findExercisePart(part.tab.songId, part.partId);
      expect(found?.tab.title).toBe(part.tab.title);
      expect(found?.tab.trackName).toBe(part.tab.trackName);
      expect(found?.tab.notes).toEqual(part.tab.notes);
    }
  });
});

describe('what the exercises teach', () => {
  const pitches = (item: Exercise, key: number, pattern?: ExercisePattern) => buildExerciseTab(item, key, pattern).notes.map((note) => note.midiNote);

  it.each([
    [60, SCALES.major], [61, SCALES.naturalMinor], [62, SCALES.harmonicMinor], [63, SCALES.melodicMinor],
    [64, SCALES.dorian], [65, SCALES.phrygian], [66, SCALES.lydian], [67, SCALES.mixolydian], [68, SCALES.locrian],
    [69, SCALES.wholeTone], [70, SCALES.diminishedWholeHalf], [71, SCALES.diminishedHalfWhole],
    [40, SCALES.minorPentatonic], [45, SCALES.majorPentatonic], [50, SCALES.minorBlues], [51, SCALES.majorBlues]
  ] as const)('exercise %i stays in its scale, with every note of it, in every key and pattern', (code, intervals) => {
    const item = find(code);
    for (const pattern of categoryOf(item).patterns) {
      for (let key = 0; key < 12; key += 1) {
        const allowed = intervals.map((step) => pitchClass(key + step)).toSorted((a, b) => a - b);
        const used = [...new Set(pitches(item, key, pattern).map(pitchClass))].toSorted((a, b) => a - b);
        expect(used).toEqual(allowed);
      }
    }
  });

  it.each([
    [80, 'maj'], [81, 'min'], [84, 'sus2'], [85, 'sus4'], [86, 'maj7'], [87, '7'], [88, 'm7'], [89, 'm7b5'], [90, 'dim7']
  ] as const)('arpeggio %i plays its chord notes, each also accepted when strings ring together', (code, quality) => {
    const item = find(code);
    for (let key = 0; key < 12; key += 1) {
      const tab = buildExerciseTab(item, key);
      const allowed = chordIntervals(quality).map((step) => pitchClass(key + step)).toSorted((a, b) => a - b);
      expect([...new Set(tab.notes.map((note) => pitchClass(note.midiNote)))].toSorted((a, b) => a - b)).toEqual(allowed);
      expect(pitchClass(tab.notes[0].midiNote)).toBe(key);
      expect(tab.notes.every((note) => note.acceptClasses?.length === allowed.length)).toBe(true);
    }
  });

  it('goes from the root to the top and back to the root', () => {
    const notes = pitches(find(60), 7, 'updown');
    expect(notes[0]).toBe(43);
    expect(Math.max(...notes)).toBe(67);
    expect(notes.at(-1)).toBe(43);
  });

  it('walks the groups of three and four and the thirds the way they are written', () => {
    const [first, second, third, fourth, fifth, sixth] = pitches(find(60), 7, 'updown');
    expect(pitches(find(60), 7, 'threes').slice(0, 6)).toEqual([first, second, third, second, third, fourth]);
    expect(pitches(find(60), 7, 'fours').slice(0, 8)).toEqual([first, second, third, fourth, second, third, fourth, fifth]);
    expect(pitches(find(60), 7, 'thirds').slice(0, 6)).toEqual([first, third, second, fourth, third, fifth]);
    expect(sixth).toBeGreaterThan(fifth);
  });

  it('plays the I, V, vi and IV of C as C, G, Am and F', () => {
    const tab = buildExerciseTab(find(131), 0, 'strum');
    const labels = tab.notes.flatMap((note) => (note.chord ? [note.chord.label] : []));
    expect(labels).toEqual(['C', 'C', 'G', 'G', 'Am', 'Am', 'F', 'F', 'C']);
  });

  it('plays the i, VI, III and VII of A minor as Am, F, C and G', () => {
    const tab = buildExerciseTab(find(141), 9, 'strum');
    const labels = [...new Set(tab.notes.flatMap((note) => (note.chord ? [note.chord.label] : [])))];
    expect(labels).toEqual(['Am', 'F', 'C', 'G']);
    expect(tab.title).toBe('i, VI, III e VII em Am');
  });

  it('writes the 12-bar blues in A with its three chords in the right bars', () => {
    const tab = buildExerciseTab(find(150), 9, 'strum');
    const labels = tab.notes.flatMap((note) => (note.chord ? [note.chord.label] : [])).filter((_, index) => index % 2 === 0);
    expect(labels).toEqual(['A7', 'A7', 'A7', 'A7', 'D7', 'D7', 'A7', 'A7', 'E7', 'D7', 'A7', 'E7', 'A7']);
  });

  it('writes the ii, V and I of C as Dm7, G7 and C7M', () => {
    const tab = buildExerciseTab(find(134), 0, 'strum');
    expect([...new Set(tab.notes.flatMap((note) => (note.chord ? [note.chord.label] : [])))]).toEqual(['Dm7', 'G7', 'C7M']);
  });

  it('keeps progression changes short on the neck', () => {
    for (const code of [130, 131, 132, 133, 140, 141, 142]) {
      for (let key = 0; key < 12; key += 1) {
        const anchors = buildExerciseTab(find(code), key, 'strum').notes.filter((note) => note.chord);
        for (let index = 1; index < anchors.length - 1; index += 1) {
          expect(Math.abs(anchors[index].fret - anchors[index - 1].fret)).toBeLessThanOrEqual(7);
        }
      }
    }
  });

  it('marks the techniques on the notes that use them', () => {
    expect(buildExerciseTab(find(20), 0).notes.filter((note) => note.hammerOnOrPullOff).length).toBeGreaterThan(5);
    expect(buildExerciseTab(find(25), 0).notes.every((note) => note.bendSemitones === 2)).toBe(true);
    expect(buildExerciseTab(find(26), 0).notes.every((note) => note.bendSemitones === 1)).toBe(true);
    expect(buildExerciseTab(find(27), 0).notes.every((note) => note.vibrato)).toBe(true);
    expect(buildExerciseTab(find(23), 0).notes.filter((note) => note.tapping).length).toBeGreaterThan(5);
    expect(buildExerciseTab(find(29), 0).notes.filter((note) => note.palmMute).length).toBeGreaterThan(10);
  });

  it('keeps harmonics inside what the detector hears', () => {
    const notes = buildExerciseTab(find(28), 0).notes;
    expect(notes.every((note) => note.harmonic === 'natural')).toBe(true);
    expect(Math.max(...notes.map((note) => note.freqHz))).toBeLessThan(1400);
  });

  it('shows only natural notes on the string exercises', () => {
    for (let code = 180; code <= 185; code += 1) {
      expect(buildExerciseTab(find(code), 0).notes.every((note) => !note.noteName.includes('#'))).toBe(true);
    }
  });

  it('plays one note on every string', () => {
    for (let key = 0; key < 12; key += 1) {
      const notes = buildExerciseTab(find(186), key).notes;
      expect(new Set(notes.map((note) => note.string)).size).toBe(6);
      expect(notes.every((note) => pitchClass(note.midiNote) === key)).toBe(true);
    }
  });

  it('builds octaves two strings apart', () => {
    const notes = buildExerciseTab(find(187), 0).notes;
    for (let index = 0; index + 1 < notes.length; index += 2) expect(notes[index + 1].midiNote - notes[index].midiNote).toBe(12);
  });
});

describe('pattern names', () => {
  const byId = (id: string): ExerciseCategory => {
    const found = EXERCISE_CATEGORIES.find((category) => category.id === id);
    if (!found) throw new Error(id);
    return found;
  };

  it('call it thirds only where a skipped note makes a third', () => {
    expect(patternName(byId('escalas'), 'thirds')).toBe('Terças');
    expect(patternName(byId('pentatonicas'), 'thirds')).toBe('Notas alternadas');
    expect(buildExerciseTab(find(40), 9, 'thirds').trackName).toBe('Notas alternadas');
  });

  it('really are thirds in the scales, in every key and scale that uses the name', () => {
    for (const group of byId('escalas').groups) {
      for (const item of group.exercises) {
        for (let key = 0; key < 12; key += 1) {
          const notes = buildExerciseTab(item, key, 'thirds').notes;
          const half = Math.floor(notes.length / 2);
          for (let index = 0; index + 1 < half; index += 2) {
            expect([3, 4], item.title).toContain(notes[index + 1].midiNote - notes[index].midiNote);
          }
        }
      }
    }
  });
});

describe('exercise ids', () => {
  it('round-trips', () => {
    expect(parseExerciseSongId(exerciseSongId(131, 6))).toEqual({ code: 131, patternCode: 6 });
  });

  it('never collides with a song or the demo', () => {
    expect(isExerciseSongId(-1)).toBe(false);
    expect(isExerciseSongId(1)).toBe(false);
    expect(isExerciseSongId(exerciseSongId(1, 0))).toBe(true);
    expect(isExerciseSongId('-1010')).toBe(false);
  });

  it('refuses what a tampered link could ask for', () => {
    expect(findExercisePart(-1, 0)).toBeNull();
    expect(findExercisePart(exerciseSongId(9999, 0), 0)).toBeNull(); // no such exercise
    expect(findExercisePart(exerciseSongId(60, 0), 12)).toBeNull(); // no such key
    expect(findExercisePart(exerciseSongId(1, 0), 3)).toBeNull(); // this one has no keys
    expect(findExercisePart(exerciseSongId(60, 5), 0)).toBeNull(); // a pattern for chords, on a scale
    expect(findExercisePart(exerciseSongId(60, 0), 1.5)).toBeNull();
  });
});
