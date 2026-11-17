// The bundled repertoire: public-domain pieces with arrangements of our own. A piece is written as text, one
// string per bar, and goes through the same shared normalizer as a downloaded tab, so the server counts its
// notes exactly as the game does.
//
// Notation (whitespace between tokens is free; a bar is one string, and one string may hold several bars
// separated by "|"):
//   note       STRING:FRET + duration    "1:3q"   string 1 = high E ... 6 = low E, frets 0 to 22
//   rest       r + duration              "re"
//   chord      LABEL[S:F S:F ...] + dur  "G[6:3 5:2 4:0]h"  the label's root is what the game judges (a
//                                        strummed chord is read as one pitch); at least two notes
//   tie        "~" before a note         "~1:0q"  holds the note right before it (same string and fret, no
//                                        token in between); it is not a new note to play
//   duration   w whole, h half, q quarter, e eighth, s sixteenth; then optionally "." (dotted, x1.5) or
//              "3" (triplet, x2/3): "q." is a dotted quarter, "e3" an eighth triplet
// Every bar must add up to the time signature exactly. The first bar may be a pickup (anacrusis), declared in
// the score with `pickup`, and then it must add up to that. Every note must belong to the declared key, except
// the accidentals the piece declares. The composer must have died long enough ago to be in the public domain.

import type { GamePart } from '../context/gameSession';
import { SONG_CATALOG } from '../content/songs';
import type { ExerciseLevel } from './exercises';
import { SCALES, TUNING } from './musicTheory';
import { isRepertoireSongId, parseRepertoireSongId, songSongId } from './songIds';
import { TabsApi, type ChordTarget, type NormalizedSongTab, type NoteEvent, type SongMeta } from './tabsApi';

export interface SongPartInfo {
  code: number; // stable: part of the song id
  name: string; // shown as the track name, e.g. "Melodia"
}

export interface SongKey {
  tonic: string; // "C", "F#", "Bb"
  scale: keyof typeof SCALES;
  accidentals?: string[]; // notes outside the scale the piece uses on purpose, e.g. ["F#"]
}

/** Everything about a piece except its notes, so a library can list it without loading them. */
export interface SongInfo {
  code: number; // stable and never reused: part of the song id
  title: string;
  composer: string; // shown as the artist
  composerDeathYear: number | null; // null only for an original work of the PRGB itself (composer ORIGINAL_COMPOSER)
  arranger: string;
  level: ExerciseLevel;
  bpm: number;
  key: SongKey;
  timeSignature: [number, number];
  tuning?: number[]; // standard tuning when missing
  parts: SongPartInfo[];
}

export interface SongScore {
  pickup?: [number, number]; // length of a short first bar, e.g. [1, 4]
  parts: { code: number; bars: string[] }[];
}

export interface SongEntry {
  info: SongInfo;
  load: () => Promise<SongScore>;
}

export interface Song {
  info: SongInfo;
  /** Notes a player has to play in a part: tied notes count once. */
  noteCount: (partCode: number) => number;
  buildTab: (partCode: number) => NormalizedSongTab;
  part: (partCode: number) => GamePart;
}

// Last year of death that is already in the public domain here (70 years after the year of death). It only
// moves forward, one year at a time: raise it when the year changes, never lower it.
export const PUBLIC_DOMAIN_LAST_DEATH_YEAR = 1955;
/** Composer name of the pieces written by the PRGB: they are ours, so there is no death year to check. */
export const ORIGINAL_COMPOSER = 'PRGB';
/** Folk tunes have no known author, hence no death year: the melody is traditional and in the public domain. */
export const TRADITIONAL_COMPOSER = 'Tradicional';

const LAST_FRET = 22;
const TICKS_PER_WHOLE = 192; // fits whole, half, quarter, eighth, sixteenth, dotted and triplets as integers
const BASE_TICKS: Record<string, number> = { w: 192, h: 96, q: 48, e: 24, s: 12 };
const NATURALS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const NOTE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

interface RawPlayed {
  string: number; // raw index: 0 = high E
  fret: number;
  midi: number;
}

interface Beat {
  ticks: number;
  rest: boolean;
  notes: RawPlayed[];
  tied: boolean;
  chord?: ChordTarget;
}

const pitchClass = (value: number): number => ((value % 12) + 12) % 12;

const classOfName = (name: string): number | null => {
  const match = /^([A-G])([#b]?)$/.exec(name);
  if (!match) return null;
  return pitchClass(NATURALS[match[1]] + (match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0));
};

const durationTicks = (letter: string, modifier: string | undefined): number => {
  const base = BASE_TICKS[letter];
  if (modifier === '.') return (base * 3) / 2;
  if (modifier === '3') return (base * 2) / 3;
  return base;
};

// A chord token has spaces inside its brackets, so split on whitespace outside them
const tokensOf = (bar: string): string[] => bar.match(/[^\s[]*\[[^\]]*\][^\s]*|[^\s]+/g) ?? [];

const DURATION = '([whqes])(\\.|3)?';
const NOTE = /^([1-9]):(\d{1,2})$/;
const NOTE_TOKEN = new RegExp(`^(~)?([1-9]):(\\d{1,2})${DURATION}$`);
const REST_TOKEN = new RegExp(`^r${DURATION}$`);
const CHORD_TOKEN = new RegExp(`^([^\\s[\\]]+)\\[([^\\]]*)\\]${DURATION}$`);

const parseNote = (text: string, tuning: number[]): RawPlayed => {
  const match = NOTE.exec(text);
  if (!match) throw new Error(`nota "${text}" inválida: use CORDA:CASA, como 3:2`);
  const stringNumber = Number(match[1]);
  const fret = Number(match[2]);
  if (stringNumber > tuning.length) throw new Error(`corda ${stringNumber} não existe (1 a ${tuning.length})`);
  if (fret > LAST_FRET) throw new Error(`casa ${fret} fora do braço (0 a ${LAST_FRET})`);
  return { string: stringNumber - 1, fret, midi: tuning[stringNumber - 1] + fret };
};

// Throws a short reason; the caller adds the piece, the bar and the token
function parseBeat(token: string, tuning: number[], previous: Beat | undefined): Beat {
  const rest = REST_TOKEN.exec(token);
  if (rest) return { ticks: durationTicks(rest[1], rest[2]), rest: true, notes: [], tied: false };

  const single = NOTE_TOKEN.exec(token);
  if (single) {
    const note = parseNote(`${single[2]}:${single[3]}`, tuning);
    const tied = single[1] === '~';
    if (tied) {
      const held = previous && !previous.rest && previous.notes.length === 1 ? previous.notes[0] : undefined;
      if (!held || held.string !== note.string || held.fret !== note.fret) {
        throw new Error('a ligadura "~" precisa vir logo depois da mesma nota (mesma corda e casa)');
      }
    }
    return { ticks: durationTicks(single[4], single[5]), rest: false, notes: [note], tied };
  }

  const chord = CHORD_TOKEN.exec(token);
  if (chord) {
    const rootMatch = /^[A-G][#b]?/.exec(chord[1]);
    const rootClass = rootMatch ? classOfName(rootMatch[0]) : null;
    if (rootClass === null) throw new Error(`o rótulo do acorde "${chord[1]}" precisa começar por uma nota (A a G, com # ou b)`);
    const notes = chord[2].trim().split(/\s+/).filter(Boolean).map((text) => parseNote(text, tuning));
    if (notes.length < 2) throw new Error('um acorde precisa de pelo menos duas notas');
    if (new Set(notes.map((note) => note.string)).size !== notes.length) throw new Error('duas notas na mesma corda do acorde');
    const toneClasses = [...new Set(notes.map((note) => pitchClass(note.midi)))];
    return {
      ticks: durationTicks(chord[3], chord[4]),
      rest: false,
      notes,
      tied: false,
      chord: { label: chord[1], rootClass, toneClasses }
    };
  }

  if (/^~?[1-9]:\d+$/.test(token)) throw new Error('falta a duração (w, h, q, e ou s), como em 3:2q');
  if (/^~?[1-9]:\d+[^\d]/.test(token) || /^r./.test(token)) throw new Error('duração inválida: use w, h, q, e ou s, com "." ou "3" opcional');
  throw new Error('token não reconhecido');
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

const fractionOf = (ticks: number): [number, number] => {
  const divisor = gcd(ticks, TICKS_PER_WHOLE);
  return [ticks / divisor, TICKS_PER_WHOLE / divisor];
};

const barTicks = ([num, den]: [number, number]): number => (TICKS_PER_WHOLE * num) / den;

function parsePart(info: SongInfo, score: SongScore, partCode: number): Beat[][] {
  const partInfo = info.parts.find((item) => item.code === partCode);
  const partScore = score.parts.find((item) => item.code === partCode);
  if (!partInfo || !partScore) throw new Error(`${info.title}: a parte ${partCode} não existe`);
  const tuning = info.tuning ?? TUNING;
  const bars: Beat[][] = [];
  const written = partScore.bars.flatMap((text) => text.split('|'));
  written.forEach((text, index) => {
    const where = `${info.title} (${partInfo.name}), compasso ${index + 1}`;
    const beats: Beat[] = [];
    let previous: Beat | undefined = bars[index - 1]?.[bars[index - 1].length - 1];
    for (const token of tokensOf(text)) {
      try {
        const beat = parseBeat(token, tuning, previous);
        beats.push(beat);
        previous = beat;
      } catch (error) {
        throw new Error(`${where}, token "${token}": ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    const expected = index === 0 && score.pickup ? barTicks(score.pickup) : barTicks(info.timeSignature);
    const total = beats.reduce((sum, beat) => sum + beat.ticks, 0);
    if (total !== expected) {
      throw new Error(`${where}: compasso ${total < expected ? 'curto' : 'longo'}, soma ${total}/${TICKS_PER_WHOLE} da semibreve e deveria somar ${expected}/${TICKS_PER_WHOLE}`);
    }
    bars.push(beats);
  });
  if (bars.length === 0) throw new Error(`${info.title} (${partInfo.name}): sem compassos`);
  return bars;
}

// Returns the pitch classes the piece may use
function checkInfo(info: SongInfo): Set<number> {
  const where = info.title || `código ${info.code}`;
  if (!info.title.trim() || !info.composer.trim() || !info.arranger.trim()) throw new Error(`${where}: título, compositor e arranjador são obrigatórios`);
  if (info.composerDeathYear === null) {
    if (info.composer !== ORIGINAL_COMPOSER && info.composer !== TRADITIONAL_COMPOSER) {
      throw new Error(`${where}: sem ano de falecimento só vale obra original do ${ORIGINAL_COMPOSER} ou tradicional`);
    }
  } else if (info.composerDeathYear > PUBLIC_DOMAIN_LAST_DEATH_YEAR) {
    throw new Error(`${where}: ${info.composer} morreu em ${info.composerDeathYear}; só entra obra de quem morreu até ${PUBLIC_DOMAIN_LAST_DEATH_YEAR}`);
  }
  if (![1, 2, 3].includes(info.level)) throw new Error(`${where}: nível deve ser 1, 2 ou 3`);
  if (!(info.bpm >= 30 && info.bpm <= 240)) throw new Error(`${where}: andamento fora de 30 a 240`);
  if (!(info.timeSignature[0] > 0 && [1, 2, 4, 8, 16].includes(info.timeSignature[1]))) throw new Error(`${where}: fórmula de compasso inválida`);
  if (info.parts.length === 0 || new Set(info.parts.map((item) => item.code)).size !== info.parts.length) throw new Error(`${where}: partes vazias ou com código repetido`);
  for (const part of info.parts) songSongId(info.code, part.code); // throws on an invalid code
  const tonic = classOfName(info.key.tonic);
  const scale: readonly number[] | undefined = SCALES[info.key.scale];
  if (tonic === null || !scale) throw new Error(`${where}: tonalidade inválida`);
  const allowed = new Set<number>(scale.map((interval) => pitchClass(tonic + interval)));
  for (const name of info.key.accidentals ?? []) {
    const pc = classOfName(name);
    if (pc === null) throw new Error(`${where}: alteração "${name}" inválida`);
    allowed.add(pc);
  }
  return allowed;
}

/** Validates a piece (throws naming the piece, bar and token on the first mistake) and returns it ready to play. */
export function defineSong(info: SongInfo, score: SongScore): Song {
  const allowed = checkInfo(info);
  const declared = info.parts.map((part) => part.code).sort((a, b) => a - b).join();
  if (score.parts.map((part) => part.code).sort((a, b) => a - b).join() !== declared) {
    throw new Error(`${info.title}: as partes da notação não são as declaradas`);
  }
  const parsed = new Map(info.parts.map((part) => [part.code, parsePart(info, score, part.code)]));

  for (const part of info.parts) {
    const bad: string[] = [];
    parsed.get(part.code)?.forEach((bar, index) => bar.forEach((beat) => beat.notes.forEach((note) => {
      if (!allowed.has(pitchClass(note.midi))) bad.push(`${NOTE_NAMES[pitchClass(note.midi)]} no compasso ${index + 1}`);
    })));
    if (bad.length > 0) throw new Error(`${info.title} (${part.name}): notas fora da tonalidade: ${bad.join(', ')}`);
  }

  const written = (partCode: number): Beat[] => (parsed.get(partCode) ?? []).flat();

  const buildTab = (partCode: number): NormalizedSongTab => {
    const partInfo = info.parts.find((item) => item.code === partCode);
    const bars = parsed.get(partCode);
    if (!partInfo || !bars) throw new Error(`${info.title}: a parte ${partCode} não existe`);
    const tuning = info.tuning ?? TUNING;
    const meta: SongMeta = {
      songId: songSongId(info.code, partCode),
      revisionId: 0,
      title: info.title,
      artist: info.composer,
      image: '',
      tracks: [{ instrumentId: 30, instrument: 'Guitarra', name: partInfo.name, tuning, partId: 0 }]
    };
    const raw = {
      tuning,
      automations: { tempo: [{ measure: 0, position: 0, bpm: info.bpm, type: 4 }] },
      measures: bars.map((bar, index) => ({
        ...(index === 0 ? { signature: info.timeSignature } : {}),
        voices: [{
          beats: bar.map((beat) => (beat.rest
            ? { duration: fractionOf(beat.ticks), rest: true }
            : { duration: fractionOf(beat.ticks), notes: beat.notes.map((note) => ({ string: note.string, fret: note.fret, ...(beat.tied ? { tie: true } : {}) })) }))
        }]
      }))
    };
    const tab = TabsApi.normalizeTab(raw, meta, 0);
    // Notes come out in the written order (no grace notes, and a tie only extends the previous note)
    const played = written(partCode).filter((beat) => !beat.tied).flatMap((beat) =>
      beat.notes.map((_, index) => ({ chord: index === 0 ? beat.chord : undefined, member: !!beat.chord && index > 0 })));
    tab.notes.forEach((note: NoteEvent, index) => {
      if (played[index].chord) note.chord = played[index].chord;
      if (played[index].member) note.chordMember = true;
    });
    return tab;
  };

  return {
    info,
    noteCount: (partCode) => written(partCode).reduce((sum, beat) => sum + (beat.tied ? 0 : beat.notes.length), 0),
    buildTab,
    part: (partCode) => ({ tab: buildTab(partCode), partId: 0, revisionId: null })
  };
}

const loaded = new Map<number, Promise<Song>>();

/** Loads a piece's notes on demand: they are a separate chunk, fetched only when somebody asks for the piece. */
export function loadSong(code: number): Promise<Song | null> {
  const entry = SONG_CATALOG.find((item) => item.info.code === code);
  if (!entry) return Promise.resolve(null);
  let song = loaded.get(code);
  if (!song) {
    song = entry.load().then((score) => defineSong(entry.info, score));
    // A failed load (offline, a replaced chunk) must be retried, not remembered
    song.catch(() => loaded.delete(code));
    loaded.set(code, song);
  }
  return song;
}

/** The metadata behind a repertoire id, with no notes loaded; null if there is no such piece or part. */
export function findSongInfo(songId: number): { info: SongInfo; part: SongPartInfo } | null {
  if (!isRepertoireSongId(songId)) return null;
  const { code, partCode } = parseRepertoireSongId(songId);
  const info = SONG_CATALOG.find((item) => item.info.code === code)?.info;
  const part = info?.parts.find((item) => item.code === partCode);
  return info && part ? { info, part } : null;
}

/** The part behind a repertoire id, as found in a record or a challenge link; null if it doesn't exist. */
export async function findSongPart(songId: number, partId: number): Promise<GamePart | null> {
  if (partId !== 0) return null;
  const found = findSongInfo(songId);
  if (!found) return null;
  try {
    const song = await loadSong(found.info.code);
    return song ? song.part(found.part.code) : null;
  } catch {
    return null;
  }
}
