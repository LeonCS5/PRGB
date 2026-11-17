// Original rock riff in E minor pentatonic on the low strings (string 6 = low E: 0 E, 3 G; string 5: 0 A, 2 B;
// string 4: 0 D, 2 E). A motive (E E G E A B), answered an octave up, then a rising run to the final cadence.

import type { SongScore } from '../../services/songs';

const motive = '6:0e 6:0e 6:3q 6:0e 5:0e 5:2q';
const motiveDown = '6:0e 6:0e 6:3q 6:0e 5:0e 6:3q';

export const score: SongScore = {
  parts: [{
    code: 0,
    bars: [
      // Phrase 1: motive twice, a variant, then a descent to E
      motive, motiveDown, motive, '5:2e 5:0e 6:3e 6:0e 6:0h',
      // Phrase 2: the answer, an octave above
      '4:2e 4:2e 4:0q 5:2e 5:2e 5:0q', '4:2e 4:2e 4:0q 5:2e 5:0e 6:3q', '5:0e 5:2e 4:0e 4:2e 4:0q 5:2q', '5:0q 6:3q 6:0h',
      // Phrase 3: the motive again, closing on a rest
      motive, motiveDown, motive, '5:0e 6:3e 6:0q 6:0q rq',
      // Phrase 4: rising run and the final cadence
      '6:0e 6:3e 5:0e 5:2e 4:0e 4:2e 4:0e 5:2e', '5:0e 6:3e 6:0e 6:3e 5:0e 6:3e 6:0q', '4:2q 4:0q 5:2q 5:0q', '6:3q 5:0q 6:0h'
    ]
  }]
};
