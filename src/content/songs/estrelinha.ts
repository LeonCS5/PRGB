// Twinkle, Twinkle, Little Star (the French tune Mozart wrote variations on), melody only, in C major on the
// two high strings (string 1 = high E: 0 E, 1 F, 3 G, 5 A; string 2 = B: 1 C, 3 D).

import type { SongScore } from '../../services/songs';

const A = '2:1q 2:1q 1:3q 1:3q | 1:5q 1:5q 1:3h';
const B = '1:1q 1:1q 1:0q 1:0q | 2:3q 2:3q 2:1h';
const C = '1:3q 1:3q 1:1q 1:1q | 1:0q 1:0q 2:3h';

export const score: SongScore = {
  parts: [{ code: 0, bars: [A, B, C, C, A, B] }]
};
