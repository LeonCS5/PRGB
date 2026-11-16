// Theme of the last movement of Beethoven's 9th Symphony, melody only, in C major on the two high strings
// (string 1 = high E: 0 E, 1 F, 3 G; string 2 = B: 0 B, 1 C, 3 D; string 3 open = G below).

import type { SongScore } from '../../services/songs';

export const score: SongScore = {
  parts: [{
    code: 0,
    bars: [
      // A
      '1:0q 1:0q 1:1q 1:3q | 1:3q 1:1q 1:0q 2:3q | 2:1q 2:1q 2:3q 1:0q | 1:0q. 2:3e 2:3h',
      // A, ending on C
      '1:0q 1:0q 1:1q 1:3q | 1:3q 1:1q 1:0q 2:3q | 2:1q 2:1q 2:3q 1:0q | 2:3q. 2:1e 2:1h',
      // B
      '2:3q 2:3q 1:0q 2:1q | 2:3q 1:0e 1:1e 1:0q 2:1q | 2:3q 1:0e 1:1e 1:0q 2:3q | 2:1q 2:3q 3:0h',
      // A, ending on C
      '1:0q 1:0q 1:1q 1:3q | 1:3q 1:1q 1:0q 2:3q | 2:1q 2:1q 2:3q 1:0q | 2:3q. 2:1e 2:1h'
    ]
  }]
};
