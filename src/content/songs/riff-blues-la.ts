// Original twelve-bar blues riff in A, with swung eighths (a quarter triplet then an eighth triplet) on strings 5 to 2
// (string 5: 0 A, 3 C; string 4: 0 D, 1 Eb, 2 E; string 3: 0 G, 2 A; string 2: 1 C). Two bars of tag at the end.

import type { SongScore } from '../../services/songs';

const riff = '5:0q3 5:3e3 4:0q3 4:1e3 4:2q 5:3q'; // A C D Eb E C
const riffHigh = '5:0q3 5:3e3 4:0q3 4:1e3 4:2q 4:0q'; // same, ending on D
const down = '4:2q3 4:0e3 5:3q3 5:0e3 5:0h'; // E D C A, landing on A

export const score: SongScore = {
  parts: [{
    code: 0,
    bars: [
      // I
      riff, riffHigh, riff, down,
      // IV
      '4:0q3 3:0e3 3:2q3 3:0e3 4:0q 3:0q', '4:0q3 3:0e3 3:2q3 2:1e3 3:2q 3:0q',
      // I
      riff, down,
      // V, IV, I, turnaround
      '4:2q3 3:0e3 3:2q3 3:0e3 4:2h', '4:0q3 3:0e3 3:2q3 3:0e3 4:0h', riff, '4:2q3 3:0e3 4:2q3 4:0e3 5:3q 5:0q',
      // Tag
      riff, down
    ]
  }]
};
