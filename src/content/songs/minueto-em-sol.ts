// Minuet in G (Petzold), first strain written twice, melody only, an octave below the usual piano score so it
// sits on the open and low frets (string 3 open = G, string 2 = B, string 1 = high E).

import type { SongScore } from '../../services/songs';

const STRAIN = [
  '2:3q 3:0e 3:2e 2:0e 2:1e | 2:3q 3:0q 3:0q',
  '1:0q 2:1e 2:3e 1:0e 1:2e | 1:3q 3:0q 3:0q',
  '2:1q 2:3e 2:1e 2:0e 3:2e | 2:0q 2:1e 2:0e 3:2e 3:0e',
  '3:2q 2:0e 3:2e 3:0e 4:4e | 3:0h.'
];

export const score: SongScore = {
  parts: [{ code: 0, bars: [...STRAIN, ...STRAIN] }]
};
