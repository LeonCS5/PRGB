import { afterEach, describe, expect, it, vi } from 'vitest';
import { normalizeTab } from '../../supabase/functions/_shared/tabNormalizer.ts';
import { rawDemo } from './demoSong';
import { SongsterrApi, midiToNoteName, soundingMidi, type SongsterrMeta } from './songsterrApi';

const STANDARD = [64, 59, 55, 50, 45, 40];

const meta: SongsterrMeta = {
  songId: 1,
  revisionId: 1,
  title: 'Test',
  artist: 'Test',
  image: '',
  tracks: [{ instrumentId: 30, instrument: 'Guitar', name: 'Guitar', tuning: STANDARD, partId: 0 }]
};

// One 4/4 measure at 120 BPM: a quarter note lasts 500 ms
const tab = (beats: unknown[], extra: Record<string, unknown> = {}) => ({
  automations: { tempo: [{ measure: 0, position: 0, bpm: 120, type: 4 }] },
  measures: [{ signature: [4, 4], voices: [{ beats }] }],
  ...extra
});

const parse = (beats: unknown[], extra?: Record<string, unknown>) =>
  SongsterrApi.normalizeTab(tab(beats, extra), meta, 0).notes;

const SoundsterrTabWithMeasures = (measures: unknown[], tempo: unknown[]) =>
  SongsterrApi.normalizeTab({ automations: { tempo }, measures }, meta, 0);

describe('midiToNoteName', () => {
  it('names notes with scientific octave numbers', () => {
    expect(midiToNoteName(40)).toBe('E2');
    expect(midiToNoteName(60)).toBe('C4');
    expect(midiToNoteName(69)).toBe('A4');
  });
});

describe('soundingMidi', () => {
  it('returns the fretted pitch for normal notes', () => {
    expect(soundingMidi(40, 5)).toBe(45);
  });

  it('places natural harmonics on the harmonic series of the open string', () => {
    expect(soundingMidi(40, 12, 'natural')).toBe(52);
    expect(soundingMidi(40, 7, 'natural')).toBe(59);
    expect(soundingMidi(40, 5, 'natural')).toBe(64);
  });

  it('treats artificial/pinch harmonicFret as an offset above the fretted note', () => {
    expect(soundingMidi(55, 7, 'pinch', 12)).toBe(55 + 7 + 12);
    expect(soundingMidi(55, 7, 'artificial', 7)).toBe(55 + 7 + 19);
  });
});

describe('SongsterrApi.normalizeTab', () => {
  it('reads raw strings as 0-indexed (string 5 fret 0 is the low E)', () => {
    const [low, high] = parse([
      { duration: [1, 4], notes: [{ string: 5, fret: 0 }] },
      { duration: [1, 4], notes: [{ string: 0, fret: 0 }] }
    ]);
    expect(low).toMatchObject({ string: 6, midiNote: 40, noteName: 'E2' });
    expect(high).toMatchObject({ string: 1, midiNote: 64, noteName: 'E4' });
  });

  it('uses the tab tuning when present', () => {
    const dropD = [64, 59, 55, 50, 45, 38];
    const [note] = parse([{ duration: [1, 4], notes: [{ string: 5, fret: 0 }] }], { tuning: dropD });
    expect(note.midiNote).toBe(38);
  });

  it('times beats from the tempo map and skips rests', () => {
    const notes = parse([
      { duration: [1, 4], notes: [{ string: 0, fret: 0 }] },
      { duration: [1, 4], rest: true, notes: [{ rest: true }] },
      { duration: [1, 8], notes: [{ string: 0, fret: 1 }] },
      { duration: [1, 8], notes: [{ string: 0, fret: 2 }] }
    ]);
    expect(notes.map((n) => [n.timeMs, n.durationMs])).toEqual([
      [0, 500],
      [1000, 250],
      [1250, 250]
    ]);
  });

  it('extends a tied note instead of creating a new hit, keeping a bend written on the tie', () => {
    const notes = parse([
      { duration: [1, 4], notes: [{ string: 1, fret: 7 }] },
      { duration: [1, 4], notes: [{ string: 1, fret: 7, tie: true, bend: { tone: 100 } }] }
    ]);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ timeMs: 0, durationMs: 1000, bendSemitones: 2 });
  });

  it('lays grace runs out before the next beat in written order without shifting it', () => {
    const notes = parse([
      { duration: [1, 4], notes: [{ string: 0, fret: 0 }] },
      { duration: [1, 32], graceNote: 'onBeat', notes: [{ string: 0, fret: 1 }] },
      { duration: [1, 16], graceNote: 'onBeat', notes: [{ string: 0, fret: 2 }] },
      { duration: [1, 4], notes: [{ string: 0, fret: 3 }] }
    ]);
    expect(notes.map((n) => [n.fret, n.timeMs, !!n.grace])).toEqual([
      [0, 0, false],
      [1, 313, true],
      [2, 375, true],
      [3, 500, false]
    ]);
  });

  it('flags techniques and converts bend tone to semitones', () => {
    const [note] = parse([
      {
        duration: [1, 4],
        tapping: true,
        notes: [{ string: 2, fret: 9, dead: true, ghost: true, bend: { tone: 50 }, harmonic: 'pinch', harmonicFret: 12 }]
      }
    ]);
    expect(note).toMatchObject({ dead: true, ghost: true, tapping: true, harmonic: 'pinch', bendSemitones: 1 });
    expect(note.midiNote).toBe(55 + 9 + 12);
  });

  it('builds a beat grid from time signatures and tempo changes, accenting downbeats', () => {
    const quarter = (fret: number) => ({ duration: [1, 4], notes: [{ string: 0, fret }] });
    const eighths = Array.from({ length: 6 }, (_, i) => ({ duration: [1, 8], notes: [{ string: 0, fret: i }] }));
    const result = SoundsterrTabWithMeasures([
      { signature: [4, 4], voices: [{ beats: [quarter(0), quarter(1), quarter(2), quarter(3)] }] },
      { signature: [6, 8], voices: [{ beats: eighths }] }
    ], [{ measure: 0, position: 0, bpm: 120, type: 4 }, { measure: 1, position: 0, bpm: 60, type: 4 }]);
    expect(result.beatGrid.map((b) => [b.timeMs, b.accent])).toEqual([
      [0, true], [500, false], [1000, false], [1500, false],
      // 6/8 at 60 BPM (quarter): eighth pulse = 500 ms
      [2000, true], [2500, false], [3000, false], [3500, false], [4000, false], [4500, false]
    ]);
    expect(result.initialBpm).toBe(120);
  });

  it('aligns a pickup measure to the end of the bar so the grid stays ordered', () => {
    const quarter = (fret: number) => ({ duration: [1, 4], notes: [{ string: 0, fret }] });
    const result = SoundsterrTabWithMeasures([
      { signature: [4, 4], voices: [{ beats: [quarter(0)] }] },
      { voices: [{ beats: [quarter(1), quarter(2), quarter(3), quarter(4)] }] }
    ], [{ measure: 0, position: 0, bpm: 120, type: 4 }]);
    expect(result.beatGrid.map((b) => [b.timeMs, b.accent])).toEqual([
      [0, false],
      [500, true], [1000, false], [1500, false], [2000, false]
    ]);
  });

  it('returns notes sorted by time', () => {
    const notes = parse([
      { duration: [1, 8], notes: [{ string: 0, fret: 0 }] },
      { duration: [1, 16], graceNote: 'onBeat', notes: [{ string: 1, fret: 1 }] },
      { duration: [1, 8], notes: [{ string: 0, fret: 2 }] }
    ]);
    const times = notes.map((n) => n.timeMs);
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });
});

describe('shared tab normalizer (also used by the register-part Edge Function)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is what SongsterrApi.normalizeTab runs', () => {
    expect(SongsterrApi.normalizeTab(rawDemo, meta, 0)).toEqual(normalizeTab(rawDemo, meta, 0));
  });

  it('maps song meta with the same partId and revision fallbacks the server uses', async () => {
    const raw = {
      songId: 7,
      latestRevisionId: 99,
      title: 'Song',
      artist: 'Band',
      image: 'img',
      tracks: [
        { instrumentId: 30, instrument: 'Guitar', name: 'Lead', partId: 4 },
        { instrumentId: 33, instrument: 'Bass', name: 'Bass', tuning: [43, 38, 33, 28] }
      ]
    };
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(raw))));
    const songMeta = await SongsterrApi.getSongMeta(7);
    expect(songMeta).toMatchObject({ songId: 7, revisionId: 99, image: 'img' });
    expect(songMeta.tracks.map((t) => [t.partId, t.tuning])).toEqual([
      [4, STANDARD],
      [1, [43, 38, 33, 28]]
    ]);
  });
});
