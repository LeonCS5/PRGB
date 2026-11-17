// Greensleeves (traditional), verse strain in E minor, melody only: 3/4 with a one-beat pickup. D# is the leading
// tone and C# the raised sixth of the closing phrase, so both are declared as accidentals in the catalog.

import type { SongScore } from '../../services/songs';

export const score: SongScore = {
  pickup: [1, 4],
  parts: [{
    code: 0,
    bars: [
      '1:0q',
      // first phrase
      '1:3h 1:5q | 1:7q. 1:8e 1:7q | 1:5h 1:2q | 2:3q. 1:0e 1:2q',
      '1:3h 1:0q | 1:0q. 2:4e 1:0q | 1:2h 2:4q | 2:0h 1:0q',
      // second phrase, closing on E
      '1:3h 1:5q | 1:7q. 1:8e 1:7q | 1:5h 1:2q | 2:3q. 1:0e 1:2q',
      '1:3q. 1:2e 1:0q | 2:4q. 2:2e 2:4q | 1:0h.'
    ]
  }]
};
