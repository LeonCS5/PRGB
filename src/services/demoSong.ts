// Original practice exercise bundled with the app: playable offline and free of third-party rights.
// Written in Songsterr's raw format (strings 0-indexed, 0 = high E) so it goes through the same parser.

import { SongsterrApi, type NormalizedSongTab, type SongsterrMeta } from './songsterrApi';

export const DEMO_SONG_ID = -1;

const STANDARD_TUNING = [64, 59, 55, 50, 45, 40];

// A minor pentatonic, first box at the 5th fret, as [rawString, fret] pairs from low to high
const BOX_ONE: [number, number][] = [
  [5, 5], [5, 8], [4, 5], [4, 7], [3, 5], [3, 7], [2, 5], [2, 7], [1, 5], [1, 8], [0, 5], [0, 8]
];

const eighth = (string: number, fret: number, extra: Record<string, unknown> = {}) => ({
  duration: [1, 8],
  notes: [{ string, fret, ...extra }]
});

const quarter = (string: number, fret: number, extra: Record<string, unknown> = {}) => ({
  duration: [1, 4],
  notes: [{ string, fret, ...extra }]
});

const measure = (beats: unknown[], signature?: [number, number]) => ({
  ...(signature ? { signature } : {}),
  voices: [{ beats }]
});

const ascending = BOX_ONE.map(([s, f]) => eighth(s, f));
const descending = [...BOX_ONE].reverse().map(([s, f]) => eighth(s, f));

const rawDemo = {
  tuning: STANDARD_TUNING,
  automations: { tempo: [{ measure: 0, position: 0, bpm: 90, type: 4 }] },
  measures: [
    // Warm-up: open low E and A pulses
    measure([quarter(5, 0), quarter(5, 0), quarter(4, 0), quarter(4, 0)], [4, 4]),
    // Box one up and back down (12 + 12 eighths across three bars)
    measure(ascending.slice(0, 8)),
    measure([...ascending.slice(8), ...descending.slice(0, 4)]),
    measure(descending.slice(4, 12)),
    // Phrase with a hammer-on, a slide and a held bend
    measure([eighth(2, 5), eighth(2, 7, { hp: true }), eighth(1, 5), eighth(1, 8), quarter(1, 8, { slide: 'shift' }), quarter(2, 7)]),
    measure([quarter(1, 8, { bend: { tone: 100 } }), quarter(1, 8, { tie: true }), eighth(1, 5), eighth(2, 7), quarter(2, 5)]),
    // Ending on the root with vibrato
    measure([quarter(4, 7), quarter(3, 7), { duration: [1, 2], notes: [{ string: 2, fret: 7, vibrato: true }] }])
  ]
};

const demoMeta: SongsterrMeta = {
  songId: DEMO_SONG_ID,
  revisionId: 0,
  title: 'Pentatônica em Lá menor',
  artist: 'Exercício PRGB',
  image: '',
  tracks: [{ instrumentId: 30, instrument: 'Guitarra', name: 'Exercício', tuning: STANDARD_TUNING, partId: 0 }]
};

/**
 * Build the demo tab. It is regenerated on each call so callers can't share mutable note objects.
 */
export function getDemoSong(): NormalizedSongTab {
  return SongsterrApi.normalizeTab(rawDemo, demoMeta, 0);
}
