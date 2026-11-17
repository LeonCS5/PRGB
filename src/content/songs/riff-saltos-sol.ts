// Original riff in G major built on octave jumps: a low note on string 3 or 4 answered by the same note an octave
// up on string 1 or 2 (G3-G4: 3:0 and 1:3; A3-A4: 3:2 and 1:5; B3-B4: 2:0 and 1:7; D3-D4: 4:0 and 2:3;
// E3-E4: 4:2 and 1:0). The jumps run through G-A, B-G and D-E, with a quarter-note bridge before the return.

import type { SongScore } from '../../services/songs';

const ga = '3:0e 1:3e 3:0e 1:3e 3:2e 1:5e 3:2e 1:5e';
const bg = '2:0e 1:7e 2:0e 1:7e 3:0e 1:3e 3:0e 1:3e';
const de = '4:0e 2:3e 4:0e 2:3e 4:2e 1:0e 4:2e 1:0e';

export const score: SongScore = {
  parts: [{
    code: 0,
    bars: [
      // Phrase 1: question, ending on D
      ga, bg, ga, '3:0e 1:3e 3:0e 1:3e 4:0h',
      // Phrase 2: answer, ending on G
      de, bg, ga, '3:2e 1:5e 4:0e 2:3e 3:0h',
      // Phrase 3: the bridge, on quarter notes
      '1:3q 3:0q 1:5q 3:2q', '1:7q 2:0q 1:5q 3:2q', '1:3q. 3:0e 1:3q 3:0q', '2:3q 4:0q 4:2q 4:0q',
      // Phrase 4: return and close on a high G
      ga, bg, de, '3:0e 1:3e 3:0q 1:3h'
    ]
  }]
};
