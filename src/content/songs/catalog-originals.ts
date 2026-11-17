// Catalog entries (metadata only; the notes are lazy chunks). A code is part of the song id (songIds.ts): never renumber
// or reuse one. Codes of this file: 10 to 15.

import type { SongEntry } from '../../services/songs';

export const ORIGINALS_CATALOG: readonly SongEntry[] = [
  {
    info: {
      code: 10,
      title: 'Riff de rock em Mi menor',
      composer: 'Original',
      composerDeathYear: null,
      arranger: 'PRGB',
      level: 2,
      bpm: 100,
      key: { tonic: 'E', scale: 'minorPentatonic' },
      timeSignature: [4, 4],
      parts: [{ code: 0, name: 'Melodia' }]
    },
    load: () => import('./riff-rock-mi-menor').then((module) => module.score)
  },
  {
    info: {
      code: 11,
      title: 'Riff de blues em Lá',
      composer: 'Original',
      composerDeathYear: null,
      arranger: 'PRGB',
      level: 2,
      bpm: 84,
      key: { tonic: 'A', scale: 'minorBlues' },
      timeSignature: [4, 4],
      parts: [{ code: 0, name: 'Melodia' }]
    },
    load: () => import('./riff-blues-la').then((module) => module.score)
  },
  {
    info: {
      code: 12,
      title: 'Riff funk em Ré menor',
      composer: 'Original',
      composerDeathYear: null,
      arranger: 'PRGB',
      level: 3,
      bpm: 92,
      key: { tonic: 'D', scale: 'minorPentatonic' },
      timeSignature: [4, 4],
      parts: [{ code: 0, name: 'Melodia' }]
    },
    load: () => import('./riff-funk-re-menor').then((module) => module.score)
  },
  {
    info: {
      code: 13,
      title: 'Riff com saltos de oitava em Sol',
      composer: 'Original',
      composerDeathYear: null,
      arranger: 'PRGB',
      level: 3,
      bpm: 112,
      key: { tonic: 'G', scale: 'major' },
      timeSignature: [4, 4],
      parts: [{ code: 0, name: 'Melodia' }]
    },
    load: () => import('./riff-saltos-sol').then((module) => module.score)
  },
  {
    info: {
      code: 14,
      title: 'Progressão em Dó maior (I-vi-IV-V)',
      composer: 'Original',
      composerDeathYear: null,
      arranger: 'PRGB',
      level: 1,
      bpm: 76,
      key: { tonic: 'C', scale: 'major' },
      timeSignature: [4, 4],
      parts: [{ code: 0, name: 'Acordes' }]
    },
    load: () => import('./progressao-do-maior').then((module) => module.score)
  },
  {
    info: {
      code: 15,
      title: 'Progressão em Lá menor (i-VI-III-VII)',
      composer: 'Original',
      composerDeathYear: null,
      arranger: 'PRGB',
      level: 2,
      bpm: 88,
      key: { tonic: 'A', scale: 'naturalMinor' },
      timeSignature: [4, 4],
      parts: [{ code: 0, name: 'Acordes' }]
    },
    load: () => import('./progressao-la-menor').then((module) => module.score)
  }
];
