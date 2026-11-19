// Catalog entries (metadata only; the notes are lazy chunks). A code is part of the song id (songIds.ts): never renumber
// or reuse one. Codes of this file: 6 to 9.

import type { SongEntry } from '../../services/songs';

export const CLASSIC_CATALOG: readonly SongEntry[] = [
  {
    info: {
      code: 6,
      title: 'Minueto em Sol',
      composer: 'Christian Petzold',
      composerDeathYear: 1733,
      arranger: 'PRGB',
      level: 2,
      bpm: 88,
      key: { tonic: 'G', scale: 'major' },
      timeSignature: [3, 4],
      parts: [{ code: 0, name: 'Melodia' }]
    },
    load: () => import('./minueto-em-sol').then((module) => module.score)
  },
  {
    info: {
      code: 7,
      title: 'Brilha, brilha, estrelinha',
      composer: 'Tradicional',
      composerDeathYear: null,
      arranger: 'PRGB',
      level: 1,
      bpm: 84,
      key: { tonic: 'C', scale: 'major' },
      timeSignature: [4, 4],
      parts: [{ code: 0, name: 'Melodia' }]
    },
    load: () => import('./estrelinha').then((module) => module.score)
  }
];
