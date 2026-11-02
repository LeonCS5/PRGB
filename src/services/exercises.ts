// The exercise library: original practice material generated from music theory, so it plays offline and carries
// no third-party rights. Each exercise is written as a raw tab and goes through the same parser as a song.

import type { GamePart } from '../context/gameSession';
import { exerciseSongId, isExerciseSongId, parseExerciseSongId } from './exerciseIds';
import {
  KEYS,
  SCALES,
  TUNING,
  chordIntervals,
  fretNote,
  movableChord,
  notesPerString,
  openChord,
  pitchClass,
  positionNotes,
  rootFret,
  type ChordQuality,
  type FretNote,
  type OpenChordName,
  type ShapeString,
  type Voicing
} from './musicTheory';
import { TabsApi, type ChordTarget, type NormalizedSongTab, type NoteEvent, type SongMeta } from './tabsApi';

export type ExercisePattern = 'updown' | 'threes' | 'fours' | 'thirds' | 'perString' | 'strum' | 'picked';

// Part of the song id, so they can't change: records and challenge links keep them
const PATTERN_CODES: Record<ExercisePattern, number> = { updown: 0, threes: 1, fours: 2, thirds: 3, perString: 4, strum: 5, picked: 6 };

const PATTERN_NAMES: Record<ExercisePattern, string> = {
  updown: 'Sobe e desce',
  threes: 'Grupos de 3',
  fours: 'Grupos de 4',
  thirds: 'Terças',
  perString: '3 notas por corda',
  strum: 'Batida',
  picked: 'Dedilhado'
};

export type ExerciseLevel = 1 | 2 | 3;

export const LEVEL_NAMES: Record<ExerciseLevel, string> = { 1: 'Iniciante', 2: 'Intermediário', 3: 'Avançado' };

type BuildBeats = (key: number, pattern: ExercisePattern) => RawBeat[];

export interface Exercise {
  code: number; // stable: part of the song id
  title: string;
  description: string;
  level: ExerciseLevel;
  bpm: number;
  keyed: boolean; // plays in the 12 keys; otherwise it has one fixed place on the neck
  minorKey?: boolean; // named after the minor key
  build: BuildBeats;
}

export interface ExerciseGroup {
  title: string;
  exercises: Exercise[];
}

export type ExerciseCategoryId = 'aquecimento' | 'tecnicas' | 'pentatonicas' | 'escalas' | 'arpejos' | 'acordes' | 'progressoes' | 'ritmo' | 'braco';

export interface ExerciseCategory {
  id: ExerciseCategoryId;
  title: string;
  summary: string;
  note?: string; // what the player must know to be judged fairly
  patterns: ExercisePattern[]; // the ones all its exercises can play; empty: only one way to play them
  patternNames?: Partial<Record<ExercisePattern, string>>; // where the usual name would not be true
  groups: ExerciseGroup[];
}

export const patternName = (category: ExerciseCategory, pattern: ExercisePattern): string =>
  category.patternNames?.[pattern] ?? PATTERN_NAMES[pattern];

type Duration = readonly [number, number];

interface RawNote {
  string: number;
  fret: number;
  hp?: boolean;
  slide?: string;
  bend?: { tone: number };
  vibrato?: boolean;
  palmMute?: boolean;
  harmonic?: string;
  // Copied to the parsed note: the parser only keeps what a downloaded tab can carry
  chord?: ChordTarget;
  chordMember?: boolean;
  acceptClasses?: number[];
}

interface RawBeat {
  duration: Duration;
  notes?: RawNote[];
  rest?: boolean;
  tapping?: boolean;
}

const HALF: Duration = [1, 2];
const QUARTER: Duration = [1, 4];
const EIGHTH: Duration = [1, 8];
const SIXTEENTH: Duration = [1, 16];
const SHUFFLE_LONG: Duration = [1, 6];
const TRIPLET: Duration = [1, 12];

const TICKS_PER_BAR = 48;
const ticksOf = ([num, den]: Duration): number => (TICKS_PER_BAR * num) / den;

// Strings as a guitarist counts them: 1 = high E, 6 = low E
const at = (stringNumber: number, fret: number): FretNote => fretNote(stringNumber - 1, fret);
const ALL_STRINGS = [6, 5, 4, 3, 2, 1];

type NoteExtra = Omit<RawNote, 'string' | 'fret'>;

const single = (note: FretNote, duration: Duration, extra: NoteExtra = {}): RawBeat =>
  ({ duration, notes: [{ string: note.string, fret: note.fret, ...extra }] });

const rest = (duration: Duration): RawBeat => ({ duration, rest: true });

const line = (notes: FretNote[], duration: Duration = EIGHTH, extra: NoteExtra = {}): RawBeat[] =>
  notes.map((note) => single(note, duration, extra));

const strum = ({ label, rootClass, toneClasses, notes }: Voicing, duration: Duration): RawBeat => ({
  duration,
  notes: notes.map((note, index) => ({
    string: note.string,
    fret: note.fret,
    ...(index === 0 ? { chord: { label, rootClass, toneClasses } } : { chordMember: true })
  }))
});

// Patterns walk a list of notes up and back down. Every one of them ends on its first note.
const inGroups = <T>(list: T[], size: number): T[] => {
  const walked: T[] = [];
  for (let start = 0; start + size <= list.length; start += 1) walked.push(...list.slice(start, start + size));
  return walked;
};

const inThirds = <T>(list: T[]): T[] => {
  const walked: T[] = [];
  for (let start = 0; start + 2 < list.length; start += 1) walked.push(list[start], list[start + 2]);
  return walked;
};

const walk = <T>(up: T[], pattern: ExercisePattern): T[] => {
  const down = [...up].reverse();
  if (pattern === 'threes') return [...inGroups(up, 3), ...inGroups(down, 3)];
  if (pattern === 'fours') return [...inGroups(up, 4), ...inGroups(down, 4)];
  if (pattern === 'thirds') return [...inThirds(up), ...inThirds(down)];
  return [...up, ...down.slice(1)];
};

const melody = (up: FretNote[], pattern: ExercisePattern, extra: NoteExtra = {}): RawBeat[] => {
  const notes = walk(up, pattern);
  return [...line(notes.slice(0, -1), EIGHTH, extra), single(notes[notes.length - 1], HALF, extra)];
};

const scale = (intervals: readonly number[]): BuildBeats => (key, pattern) =>
  melody(pattern === 'perString' ? notesPerString(key, intervals, 3) : positionNotes(key, intervals), pattern);

const box = (intervals: readonly number[], degree: number): BuildBeats => (key, pattern) =>
  melody(notesPerString(key, intervals, 2, degree), pattern);

const arpeggio = (quality: ChordQuality): BuildBeats => (key) => {
  const intervals = chordIntervals(quality);
  return melody(positionNotes(key, intervals), 'updown', { acceptClasses: intervals.map((interval) => pitchClass(key + interval)) });
};

const picked = ({ toneClasses, notes }: Voicing): RawBeat[] => {
  const order = [...notes.keys(), ...[...notes.keys()].reverse().slice(1, -1)];
  return Array.from({ length: 8 }, (_, index) => single(notes[order[index % order.length]], EIGHTH, { acceptClasses: toneClasses }));
};

// One bar per chord (or `barsEach`), and the last chord rings on to close
const chordBars = (voicings: Voicing[], pattern: ExercisePattern, barsEach = 1): RawBeat[] => [
  ...voicings.flatMap((voicing) => Array.from({ length: barsEach }, () => (
    pattern === 'picked' ? picked(voicing) : [strum(voicing, HALF), strum(voicing, HALF)]
  )).flat()),
  strum(voicings[0], [1, 1])
];

const openChords = (names: OpenChordName[], barsEach = 2): BuildBeats => (_key, pattern) =>
  chordBars(names.map(openChord), pattern, barsEach);

const movableSet = (qualities: ChordQuality[], shape: ShapeString): BuildBeats => (key, pattern) =>
  chordBars(qualities.map((quality) => movableChord(key, quality, 5, shape)), pattern, 2);

// A chord of a progression: semitones above the key, and its quality
type Step = readonly [number, ChordQuality];

const progression = (steps: readonly Step[], barsEach = 1): BuildBeats => (key, pattern) => {
  let near = 5;
  const voicings = steps.map(([degree, quality]) => {
    const chord = movableChord(key + degree, quality, near);
    near = chord.notes[0].fret;
    return chord;
  });
  return chordBars(voicings, pattern, barsEach);
};

const repeatBars = (bar: RawBeat[], times = 4): RawBeat[] => Array.from({ length: times }, () => bar).flat();

const fingerRun = (order: number[], base = 5): RawBeat[] => line([
  ...ALL_STRINGS.flatMap((string) => order.map((offset) => at(string, base + offset))),
  ...[...ALL_STRINGS].reverse().flatMap((string) => [...order].reverse().map((offset) => at(string, base + offset)))
]);

const eachString = (bar: (string: number) => RawBeat[], strings: number[] = ALL_STRINGS): RawBeat[] => strings.flatMap(bar);

const naturalNotes = (string: number): RawBeat[] => {
  const notes: FretNote[] = [];
  for (let fret = 0; fret <= 12; fret += 1) {
    const note = at(string, fret);
    if (KEYS[pitchClass(note.midi)].length === 1) notes.push(note);
  }
  return [...line([...notes, ...[...notes].reverse().slice(1, -1)], QUARTER), single(notes[0], HALF)];
};

const sameNote = (key: number): RawBeat[] => {
  const notes = [5, 4, 3, 2, 1, 0].map((string) => fretNote(string, rootFret(key, string, 1)));
  return [...line([...notes, ...[...notes].reverse().slice(1, -1)], QUARTER), single(notes[0], HALF)];
};

const octaves = (key: number): RawBeat[] => {
  const degrees = [0, 2, 4, 5, 7, 5, 4, 2, 0];
  const onLowE = rootFret(key, 5, 1);
  const onA = rootFret(key, 4, 1);
  return line([
    ...degrees.flatMap((degree) => [fretNote(5, onLowE + degree), fretNote(3, onLowE + degree + 2)]),
    ...degrees.flatMap((degree) => [fretNote(4, onA + degree), fretNote(2, onA + degree + 2)])
  ]);
};

const E_MINOR = openChord('Em');
const MUTED_E = at(6, 0);

const exercise = (code: number, title: string, description: string, level: ExerciseLevel, bpm: number, build: BuildBeats, extra: Partial<Exercise> = {}): Exercise =>
  ({ code, title, description, level, bpm, keyed: false, build, ...extra });

const keyedExercise = (code: number, title: string, description: string, level: ExerciseLevel, bpm: number, build: BuildBeats, extra: Partial<Exercise> = {}): Exercise =>
  exercise(code, title, description, level, bpm, build, { keyed: true, ...extra });

const fixed = (beats: RawBeat[]): BuildBeats => () => beats;

// Degrees of the major key, in semitones
const I = 0;
const ii = 2;
const IV = 5;
const V = 7;
const vi = 9;

export const EXERCISE_CATEGORIES: ExerciseCategory[] = [
  {
    id: 'aquecimento',
    title: 'Aquecimento',
    summary: 'Dedos soltos e mãos sincronizadas antes de tocar.',
    patterns: [],
    groups: [
      {
        title: 'Cromáticos',
        exercises: [
          exercise(1, 'Cromático 1-2-3-4', 'Um dedo por casa, em todas as cordas, sobe e desce.', 1, 70, fixed(fingerRun([0, 1, 2, 3]))),
          exercise(2, 'Cromático 4-3-2-1', 'A mesma ideia, começando pelo dedo mínimo.', 1, 70, fixed(fingerRun([3, 2, 1, 0]))),
          exercise(3, 'Permutação 1-3-2-4', 'Quebra a ordem natural dos dedos.', 2, 70, fixed(fingerRun([0, 2, 1, 3]))),
          exercise(4, 'Permutação 1-4-2-3', 'Mais independência para o dedo mínimo.', 2, 70, fixed(fingerRun([0, 3, 1, 2]))),
          exercise(5, 'Escada cromática', 'A cada corda, a mão sobe uma casa.', 2, 75, fixed(line(ALL_STRINGS.flatMap((string, index) => [0, 1, 2, 3].map((offset) => at(string, 5 + index + offset)))))),
          exercise(6, 'Abertura dos dedos', 'Grandes distâncias entre os dedos, a partir da casa 7.', 3, 60, fixed(fingerRun([0, 3, 1, 4], 7)))
        ]
      },
      {
        title: 'Palhetada',
        exercises: [
          exercise(7, 'Palhetada alternada', 'Quatro palhetadas em cada nota, para baixo e para cima.', 1, 80, fixed(line(ALL_STRINGS.flatMap((string) => [5, 7].flatMap((fret) => Array.from({ length: 4 }, () => at(string, fret))))))),
          exercise(8, 'Pulo de corda', 'Salta uma corda a cada grupo, sem perder o tempo.', 3, 70, fixed(line([6, 4, 5, 3, 4, 2, 3, 1].flatMap((string) => [0, 1, 2, 3].map((offset) => at(string, 5 + offset))))))
        ]
      }
    ]
  },
  {
    id: 'tecnicas',
    title: 'Técnicas',
    summary: 'Ligados, slides, bends e outros recursos da mão.',
    patterns: [],
    groups: [
      {
        title: 'Ligados',
        exercises: [
          exercise(20, 'Hammer-on', 'Palhete a primeira nota e faça a segunda só com o dedo.', 1, 70, fixed(eachString((string) => repeatBars([single(at(string, 5), EIGHTH), single(at(string, 7), EIGHTH, { hp: true })], 2)))),
          exercise(21, 'Pull-off', 'Puxe a corda ao tirar o dedo, para a nota de baixo soar.', 1, 70, fixed(eachString((string) => repeatBars([single(at(string, 7), EIGHTH), single(at(string, 5), EIGHTH, { hp: true })], 2)))),
          exercise(22, 'Ligados em sequência', 'Uma palhetada para cada grupo de notas.', 2, 75, fixed(eachString((string) => [single(at(string, 5), EIGHTH), single(at(string, 7), EIGHTH, { hp: true }), single(at(string, 8), EIGHTH, { hp: true }), single(at(string, 7), EIGHTH, { hp: true }), single(at(string, 5), EIGHTH, { hp: true }), rest(EIGHTH), rest(QUARTER)]))),
          exercise(23, 'Tapping', 'Bata na casa 12 com a mão da palheta e ligue as outras duas notas.', 3, 80, fixed(eachString((string) => repeatBars([{ duration: EIGHTH, tapping: true, notes: [{ string: at(string, 12).string, fret: 12 }] }, single(at(string, 5), EIGHTH, { hp: true }), single(at(string, 8), EIGHTH, { hp: true })], 2), [3, 2, 1])))
        ]
      },
      {
        title: 'Expressão',
        exercises: [
          exercise(24, 'Slide', 'Deslize da casa 5 à casa 7 sem tirar a pressão do dedo.', 1, 70, fixed(eachString((string) => [single(at(string, 5), QUARTER, { slide: 'shift' }), single(at(string, 7), QUARTER)]))),
          exercise(25, 'Bend de um tom', 'Empurre a corda até soar a nota de duas casas acima.', 2, 60, fixed(repeatBars([single(at(3, 7), HALF, { bend: { tone: 100 } }), single(at(2, 8), HALF, { bend: { tone: 100 } })], 3))),
          exercise(26, 'Bend de meio tom', 'Um bend curto: a nota sobe só uma casa.', 2, 60, fixed(repeatBars([single(at(2, 8), HALF, { bend: { tone: 50 } }), single(at(1, 8), HALF, { bend: { tone: 50 } })], 3))),
          exercise(27, 'Vibrato', 'Notas longas, com a corda oscilando de maneira regular.', 2, 60, fixed(repeatBars([single(at(2, 8), HALF, { vibrato: true }), single(at(1, 7), HALF, { vibrato: true })], 3))),
          exercise(28, 'Harmônicos naturais', 'Encoste o dedo sobre o traste, sem apertar a corda.', 2, 60, fixed([12, 7, 5].flatMap((fret) => line([6, 5, 4, 3].map((string) => at(string, fret)), QUARTER, { harmonic: 'natural' }))))
        ]
      },
      {
        title: 'Abafamento',
        exercises: [
          exercise(29, 'Palm mute', 'A lateral da mão encosta nas cordas, perto da ponte.', 1, 80, fixed(repeatBars([...line(Array.from({ length: 6 }, () => at(6, 0)), EIGHTH, { palmMute: true }), single(at(6, 3), EIGHTH), single(at(6, 5), EIGHTH)], 4)))
        ]
      }
    ]
  },
  {
    id: 'pentatonicas',
    title: 'Pentatônicas',
    summary: 'As cinco posições, para improvisar em qualquer tom.',
    patterns: ['updown', 'threes', 'fours', 'thirds'],
    // A skipped note makes a third in a seven-note scale; here it makes fourths and seconds too
    patternNames: { thirds: 'Notas alternadas' },
    groups: [
      {
        title: 'Pentatônica menor',
        exercises: [0, 1, 2, 3, 4].map((degree) => keyedExercise(40 + degree, `Menor, posição ${degree + 1}`, degree === 0 ? 'A primeira posição, com a tônica na corda 6.' : `A posição ${degree + 1}, emendada com a anterior.`, degree === 0 ? 1 : 2, 80, box(SCALES.minorPentatonic, degree), { minorKey: true }))
      },
      {
        title: 'Pentatônica maior',
        exercises: [0, 1, 2, 3, 4].map((degree) => keyedExercise(45 + degree, `Maior, posição ${degree + 1}`, degree === 0 ? 'A primeira posição, com a tônica na corda 6.' : `A posição ${degree + 1}, emendada com a anterior.`, 2, 80, box(SCALES.majorPentatonic, degree)))
      },
      {
        title: 'Com blue note',
        exercises: [
          keyedExercise(50, 'Blues menor', 'A pentatônica menor com a quinta diminuta.', 2, 80, scale(SCALES.minorBlues), { minorKey: true }),
          keyedExercise(51, 'Blues maior', 'A pentatônica maior com a terça menor de passagem.', 2, 80, scale(SCALES.majorBlues))
        ]
      }
    ]
  },
  {
    id: 'escalas',
    title: 'Escalas',
    summary: 'Duas oitavas na mesma região do braço, em qualquer tom.',
    patterns: ['updown', 'threes', 'fours', 'thirds', 'perString'],
    groups: [
      {
        title: 'Maior e menores',
        exercises: [
          keyedExercise(60, 'Escala maior', 'Tom, tom, semitom, tom, tom, tom, semitom.', 1, 80, scale(SCALES.major)),
          keyedExercise(61, 'Menor natural', 'A escala maior, começando no sexto grau.', 1, 80, scale(SCALES.naturalMinor), { minorKey: true }),
          keyedExercise(62, 'Menor harmônica', 'A sétima maior traz um salto bem marcado.', 2, 75, scale(SCALES.harmonicMinor), { minorKey: true }),
          keyedExercise(63, 'Menor melódica', 'Sexta e sétima maiores sobre a terça menor.', 2, 75, scale(SCALES.melodicMinor), { minorKey: true })
        ]
      },
      {
        title: 'Modos',
        exercises: [
          keyedExercise(64, 'Dórico', 'Menor com a sexta maior.', 2, 80, scale(SCALES.dorian), { minorKey: true }),
          keyedExercise(65, 'Frígio', 'Menor com a segunda menor.', 2, 80, scale(SCALES.phrygian), { minorKey: true }),
          keyedExercise(66, 'Lídio', 'Maior com a quarta aumentada.', 2, 80, scale(SCALES.lydian)),
          keyedExercise(67, 'Mixolídio', 'Maior com a sétima menor.', 2, 80, scale(SCALES.mixolydian)),
          keyedExercise(68, 'Lócrio', 'Menor com a segunda menor e a quinta diminuta.', 3, 75, scale(SCALES.locrian), { minorKey: true })
        ]
      },
      {
        title: 'Simétricas',
        exercises: [
          keyedExercise(69, 'Tons inteiros', 'Todos os intervalos têm um tom.', 3, 70, scale(SCALES.wholeTone)),
          keyedExercise(70, 'Diminuta tom-semitom', 'Tom e semitom alternados.', 3, 70, scale(SCALES.diminishedWholeHalf)),
          keyedExercise(71, 'Diminuta semitom-tom', 'Semitom e tom alternados.', 3, 70, scale(SCALES.diminishedHalfWhole))
        ]
      }
    ]
  },
  {
    id: 'arpejos',
    title: 'Arpejos',
    summary: 'As notas de cada acorde, uma por vez, em duas oitavas.',
    note: 'Toque uma nota por vez e abafe a anterior: com cordas soando juntas, o PRGB ouve o acorde e conta só como Bom.',
    patterns: [],
    groups: [
      {
        title: 'Tríades',
        exercises: [
          keyedExercise(80, 'Maior', 'Tônica, terça maior e quinta.', 1, 70, arpeggio('maj')),
          keyedExercise(81, 'Menor', 'Tônica, terça menor e quinta.', 1, 70, arpeggio('min'), { minorKey: true }),
          keyedExercise(84, 'Suspenso com segunda', 'A segunda no lugar da terça.', 2, 70, arpeggio('sus2')),
          keyedExercise(85, 'Suspenso com quarta', 'A quarta no lugar da terça.', 2, 70, arpeggio('sus4'))
        ]
      },
      {
        title: 'Tétrades',
        exercises: [
          keyedExercise(86, 'Sétima maior (7M)', 'Maior com a sétima maior.', 2, 70, arpeggio('maj7')),
          keyedExercise(87, 'Dominante (7)', 'Maior com a sétima menor.', 2, 70, arpeggio('7')),
          keyedExercise(88, 'Menor com sétima (m7)', 'Menor com a sétima menor.', 2, 70, arpeggio('m7'), { minorKey: true }),
          keyedExercise(89, 'Meio-diminuto (m7(b5))', 'Menor com quinta diminuta e sétima menor.', 3, 65, arpeggio('m7b5'), { minorKey: true }),
          keyedExercise(90, 'Diminuto (°)', 'Terças menores empilhadas.', 3, 65, arpeggio('dim7'), { minorKey: true })
        ]
      }
    ]
  },
  {
    id: 'acordes',
    title: 'Acordes',
    summary: 'Formas abertas, com pestana e power chords, com trocas no tempo.',
    note: 'Na batida, o PRGB confere o tempo e a tônica do acorde, não cada nota: ele não separa A de Am. No dedilhado, cada nota conta.',
    patterns: ['strum', 'picked'],
    groups: [
      {
        title: 'Abertos',
        exercises: [
          exercise(100, 'C, G e D', 'Trocas entre três formas abertas.', 1, 70, openChords(['C', 'G', 'D'])),
          exercise(101, 'A, D e E', 'Os graus I, IV e V do tom de Lá.', 1, 70, openChords(['A', 'D', 'E'])),
          exercise(102, 'Am, Em e Dm', 'Os três menores abertos.', 1, 70, openChords(['Am', 'Em', 'Dm'])),
          exercise(103, 'C, Am, F e G', 'Quatro acordes, com o F com pestana.', 2, 70, openChords(['C', 'Am', 'F', 'G']))
        ]
      },
      {
        title: 'Com sétima',
        exercises: [
          exercise(104, 'A7, D7 e E7', 'As sétimas do blues em Lá.', 1, 70, openChords(['A7', 'D7', 'E7'])),
          exercise(105, 'G7, C7 e B7', 'Trocas mais longas entre as formas.', 2, 70, openChords(['G7', 'C7', 'B7'])),
          exercise(106, 'Am7, Em7 e Dm7', 'As formas menores com sétima.', 2, 70, openChords(['Am7', 'Em7', 'Dm7'])),
          exercise(107, 'C7M, F7M, G7M e D7M', 'Sétimas maiores abertas.', 2, 70, openChords(['C7M', 'F7M', 'G7M', 'D7M']))
        ]
      },
      {
        title: 'Suspensos',
        exercises: [
          exercise(108, 'Asus2, A e Asus4', 'Um dedo muda, a forma fica.', 1, 70, openChords(['Asus2', 'A', 'Asus4'])),
          exercise(109, 'Dsus2, D e Dsus4', 'A mesma ideia em Ré.', 1, 70, openChords(['Dsus2', 'D', 'Dsus4'])),
          exercise(110, 'E e Esus4', 'Uma suspensão e o retorno.', 1, 70, openChords(['E', 'Esus4']))
        ]
      },
      {
        title: 'Móveis, em qualquer tom',
        exercises: [
          keyedExercise(111, 'Pestana na corda 6', 'Maior, menor, com sétima e menor com sétima.', 2, 70, movableSet(['maj', 'min', '7', 'm7'], 'lowE')),
          keyedExercise(112, 'Pestana na corda 5', 'As mesmas quatro formas, com a tônica na corda 5.', 2, 70, movableSet(['maj', 'min', '7', 'm7'], 'a')),
          keyedExercise(113, 'Power chords', 'Tônica e quinta, nas cordas 6 e 5.', 1, 80, (key, pattern) => chordBars([movableChord(key, '5', 5, 'lowE'), movableChord(key, '5', 5, 'a')], pattern, 2))
        ]
      }
    ]
  },
  {
    id: 'progressoes',
    title: 'Progressões',
    summary: 'Sequências de acordes em qualquer tom, nomeadas pelos graus.',
    note: 'Na batida, o PRGB confere o tempo e a tônica do acorde, não cada nota. No dedilhado, cada nota conta.',
    patterns: ['strum', 'picked'],
    groups: [
      {
        title: 'Tom maior',
        exercises: [
          keyedExercise(130, 'I, IV, V e I', 'Tônica, subdominante e dominante.', 1, 75, progression([[I, 'maj'], [IV, 'maj'], [V, 'maj'], [I, 'maj']])),
          keyedExercise(131, 'I, V, vi e IV', 'Da tônica à dominante, passando pelo relativo menor.', 1, 75, progression([[I, 'maj'], [V, 'maj'], [vi, 'min'], [IV, 'maj']])),
          keyedExercise(132, 'vi, IV, I e V', 'A mesma sequência, começando no menor.', 1, 75, progression([[vi, 'min'], [IV, 'maj'], [I, 'maj'], [V, 'maj']])),
          keyedExercise(133, 'I, vi, IV e V', 'O relativo menor logo depois da tônica.', 1, 75, progression([[I, 'maj'], [vi, 'min'], [IV, 'maj'], [V, 'maj']])),
          keyedExercise(134, 'ii, V e I', 'Preparação e resolução, com acordes de sétima.', 2, 75, progression([[ii, 'm7'], [V, '7'], [I, 'maj7']], 2)),
          keyedExercise(135, 'I, vi, ii e V', 'Sequência circular: o V leva de volta ao I.', 2, 75, progression([[I, 'maj7'], [vi, 'm7'], [ii, 'm7'], [V, '7']]))
        ]
      },
      {
        title: 'Tom menor',
        exercises: [
          keyedExercise(140, 'i, iv, v e i', 'Os três graus principais do tom menor.', 1, 75, progression([[0, 'min'], [5, 'min'], [7, 'min'], [0, 'min']]), { minorKey: true }),
          keyedExercise(141, 'i, VI, III e VII', 'Do menor para os três acordes maiores do tom.', 1, 75, progression([[0, 'min'], [8, 'maj'], [3, 'maj'], [10, 'maj']]), { minorKey: true }),
          keyedExercise(142, 'i, VII, VI e V', 'A cadência andaluza.', 2, 75, progression([[0, 'min'], [10, 'maj'], [8, 'maj'], [7, 'maj']]), { minorKey: true }),
          keyedExercise(143, 'i, iv, VII e III', 'Caminha pelo círculo de quartas.', 2, 75, progression([[0, 'min'], [5, 'min'], [10, 'maj'], [3, 'maj']]), { minorKey: true }),
          keyedExercise(144, 'ii°, V e i', 'Preparação e resolução em tom menor.', 3, 75, progression([[2, 'm7b5'], [7, '7'], [0, 'm7']], 2), { minorKey: true })
        ]
      },
      {
        title: 'Blues',
        exercises: [
          keyedExercise(150, 'Blues de 12 compassos', 'A forma tradicional, com acordes de sétima.', 2, 80, progression([[I, '7'], [I, '7'], [I, '7'], [I, '7'], [IV, '7'], [IV, '7'], [I, '7'], [I, '7'], [V, '7'], [IV, '7'], [I, '7'], [V, '7']])),
          keyedExercise(151, 'Blues com troca rápida', 'O IV já aparece no segundo compasso.', 2, 80, progression([[I, '7'], [IV, '7'], [I, '7'], [I, '7'], [IV, '7'], [IV, '7'], [I, '7'], [I, '7'], [V, '7'], [IV, '7'], [I, '7'], [V, '7']])),
          keyedExercise(152, 'Blues menor', 'A forma de 12 compassos em tom menor.', 2, 80, progression([[0, 'm7'], [0, 'm7'], [0, 'm7'], [0, 'm7'], [5, 'm7'], [5, 'm7'], [0, 'm7'], [0, 'm7'], [8, '7'], [7, '7'], [0, 'm7'], [7, '7']]), { minorKey: true })
        ]
      }
    ]
  },
  {
    id: 'ritmo',
    title: 'Ritmo',
    summary: 'Batidas e levadas para tocar sempre em cima do tempo.',
    note: 'Nas batidas, o PRGB confere o tempo e a tônica do acorde, não cada nota. Ligue o metrônomo para treinar a contagem.',
    patterns: [],
    groups: [
      {
        title: 'Batidas com acorde',
        exercises: [
          exercise(160, 'Semínimas', 'Uma batida por tempo.', 1, 80, fixed(repeatBars(Array.from({ length: 4 }, () => strum(E_MINOR, QUARTER))))),
          exercise(161, 'Colcheias', 'Duas batidas por tempo: para baixo e para cima.', 1, 80, fixed(repeatBars(Array.from({ length: 8 }, () => strum(E_MINOR, EIGHTH))))),
          exercise(162, 'Contratempo', 'A batida cai entre os tempos.', 2, 80, fixed(repeatBars(Array.from({ length: 4 }, () => [rest(EIGHTH), strum(E_MINOR, EIGHTH)]).flat()))),
          exercise(163, 'Síncope', 'Acento antes do tempo forte.', 2, 80, fixed(repeatBars([strum(E_MINOR, EIGHTH), strum(E_MINOR, QUARTER), strum(E_MINOR, EIGHTH), strum(E_MINOR, QUARTER), strum(E_MINOR, QUARTER)]))),
          exercise(164, 'Levada popular', 'Baixo, baixo-cima, cima-baixo-cima.', 2, 85, fixed(repeatBars([strum(E_MINOR, QUARTER), strum(E_MINOR, EIGHTH), strum(E_MINOR, QUARTER), strum(E_MINOR, EIGHTH), strum(E_MINOR, EIGHTH), strum(E_MINOR, EIGHTH)])))
        ]
      },
      {
        title: 'Levadas com uma nota',
        exercises: [
          exercise(165, 'Shuffle', 'A colcheia longa-curta do blues.', 2, 80, fixed(repeatBars(Array.from({ length: 4 }, () => [single(MUTED_E, SHUFFLE_LONG, { palmMute: true }), single(MUTED_E, TRIPLET, { palmMute: true })]).flat()))),
          exercise(166, 'Tercinas', 'Três notas iguais em cada tempo.', 2, 70, fixed(repeatBars(line(Array.from({ length: 12 }, () => MUTED_E), TRIPLET, { palmMute: true })))),
          exercise(167, 'Galope', 'Uma colcheia e duas semicolcheias.', 3, 80, fixed(repeatBars(Array.from({ length: 4 }, () => [single(MUTED_E, EIGHTH, { palmMute: true }), single(MUTED_E, SIXTEENTH, { palmMute: true }), single(MUTED_E, SIXTEENTH, { palmMute: true })]).flat()))),
          exercise(168, 'Semicolcheias', 'Quatro notas iguais em cada tempo.', 3, 70, fixed(repeatBars(line(Array.from({ length: 16 }, () => MUTED_E), SIXTEENTH, { palmMute: true }))))
        ]
      }
    ]
  },
  {
    id: 'braco',
    title: 'Braço',
    summary: 'Encontre as notas em todas as cordas.',
    patterns: [],
    groups: [
      {
        title: 'Notas naturais',
        exercises: ALL_STRINGS.map((string, index) => exercise(180 + index, `Corda ${string}`, `As notas sem sustenido nem bemol até a casa 12 da corda ${string}.`, 1, 60, fixed(naturalNotes(string))))
      },
      {
        title: 'Em qualquer tom',
        exercises: [
          keyedExercise(186, 'Mesma nota em todas as cordas', 'Uma nota só, em cada corda.', 1, 60, (key) => sameNote(key)),
          keyedExercise(187, 'Oitavas', 'A mesma nota, duas cordas adiante, subindo e descendo.', 2, 70, (key) => octaves(key))
        ]
      }
    ]
  }
];

const BY_CODE = new Map(EXERCISE_CATEGORIES.flatMap((category) => category.groups.flatMap((group) =>
  group.exercises.map((item) => [item.code, { exercise: item, category }] as const))));

const patternFor = (category: ExerciseCategory, pattern?: ExercisePattern): ExercisePattern =>
  pattern && category.patterns.includes(pattern) ? pattern : category.patterns[0] ?? 'updown';

export const categoryOf = (item: Exercise): ExerciseCategory => {
  const found = BY_CODE.get(item.code);
  if (!found) throw new Error(`Unknown exercise: ${item.code}`);
  return found.category;
};

const toMeasures = (beats: RawBeat[]): { voices: { beats: RawBeat[] }[]; signature?: [number, number] }[] => {
  const bars: RawBeat[][] = [[]];
  let used = 0;
  for (const beat of beats) {
    const ticks = ticksOf(beat.duration);
    if (used + ticks > TICKS_PER_BAR) {
      // Whatever doesn't fit waits for the next bar, so a long closing note lands on the downbeat
      bars[bars.length - 1].push(rest([TICKS_PER_BAR - used, TICKS_PER_BAR]));
      bars.push([]);
      used = 0;
    }
    bars[bars.length - 1].push(beat);
    used += ticks;
    if (used === TICKS_PER_BAR) {
      bars.push([]);
      used = 0;
    }
  }
  if (used > 0) bars[bars.length - 1].push(rest([TICKS_PER_BAR - used, TICKS_PER_BAR]));
  if (bars[bars.length - 1].length === 0) bars.pop();
  return bars.map((barBeats, index) => ({ ...(index === 0 ? { signature: [4, 4] as [number, number] } : {}), voices: [{ beats: barBeats }] }));
};

export function buildExerciseTab(item: Exercise, key: number, requested?: ExercisePattern): NormalizedSongTab {
  const category = categoryOf(item);
  const pattern = patternFor(category, requested);
  const place = item.keyed ? key : 0;
  const beats = item.build(place, pattern);
  const keyName = `${KEYS[place]}${item.minorKey ? 'm' : ''}`;
  const trackName = category.patterns.length > 0 ? patternName(category, pattern) : category.title;
  const meta: SongMeta = {
    songId: exerciseSongId(item.code, PATTERN_CODES[pattern]),
    revisionId: 0,
    title: item.keyed ? `${item.title} em ${keyName}` : item.title,
    artist: 'Exercício original', // not the brand name: it is a reserved word, so challenge links would refuse it
    image: '',
    tracks: [{ instrumentId: 30, instrument: 'Guitarra', name: trackName, tuning: TUNING, partId: place }]
  };
  const raw = { tuning: TUNING, automations: { tempo: [{ measure: 0, position: 0, bpm: item.bpm, type: 4 }] }, measures: toMeasures(beats) };
  const tab = TabsApi.normalizeTab(raw, meta, 0);
  // Notes keep the written order: exercises have no grace notes or ties, which are all the parser reorders or merges
  const written = beats.flatMap((beat) => beat.notes ?? []);
  tab.notes.forEach((note: NoteEvent, index) => {
    const { chord, chordMember, acceptClasses } = written[index];
    if (chord) note.chord = chord;
    if (chordMember) note.chordMember = true;
    if (acceptClasses) note.acceptClasses = acceptClasses;
  });
  return tab;
}

export const exercisePart = (item: Exercise, key: number, pattern?: ExercisePattern): GamePart => ({
  tab: buildExerciseTab(item, key, pattern),
  partId: item.keyed ? key : 0,
  revisionId: null
});

/** The part behind an exercise id, as found in a record or a challenge link; null if it doesn't exist. */
export function findExercisePart(songId: number, partId: number): GamePart | null {
  if (!isExerciseSongId(songId)) return null;
  const { code, patternCode } = parseExerciseSongId(songId);
  const found = BY_CODE.get(code);
  if (!found || !Number.isInteger(partId) || partId < 0 || partId > (found.exercise.keyed ? 11 : 0)) return null;
  const pattern = (Object.keys(PATTERN_CODES) as ExercisePattern[]).find((id) => PATTERN_CODES[id] === patternCode);
  const expected = found.category.patterns.length > 0 ? found.category.patterns : ['updown'];
  if (!pattern || !expected.includes(pattern)) return null;
  return exercisePart(found.exercise, partId, pattern);
}

export const exerciseCount = (category: ExerciseCategory): number =>
  category.groups.reduce((total, group) => total + group.exercises.length, 0);
