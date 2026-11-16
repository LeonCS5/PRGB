// Catalog of the bundled repertoire: metadata only. The notes of each piece are a separate chunk, loaded with
// import() when somebody opens it. A code is part of the song id (songIds.ts): never renumber or reuse one.

import type { SongEntry } from '../../services/songs';

export const SONG_CATALOG: readonly SongEntry[] = [
  {
    info: {
      code: 1,
      title: 'Ode à Alegria',
      composer: 'Beethoven',
      composerDeathYear: 1827,
      arranger: 'PRGB',
      level: 1,
      bpm: 72,
      key: { tonic: 'C', scale: 'major' },
      timeSignature: [4, 4],
      parts: [{ code: 0, name: 'Melodia' }]
    },
    load: () => import('./ode-a-alegria').then((module) => module.score)
  }
];
