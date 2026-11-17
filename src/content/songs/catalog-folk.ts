// Catalog entries (metadata only; the notes are lazy chunks). A code is part of the song id (songIds.ts): never renumber
// or reuse one. Codes of this file: 2 to 5.

import type { SongEntry } from '../../services/songs';

export const FOLK_CATALOG: readonly SongEntry[] = [
  {
    info: {
      code: 2,
      title: 'Greensleeves',
      composer: 'Tradicional',
      composerDeathYear: null,
      arranger: 'PRGB',
      level: 2,
      bpm: 84,
      key: { tonic: 'E', scale: 'naturalMinor', accidentals: ['D#', 'C#'] },
      timeSignature: [3, 4],
      parts: [{ code: 0, name: 'Melodia' }]
    },
    load: () => import('./greensleeves').then((module) => module.score)
  }
];
