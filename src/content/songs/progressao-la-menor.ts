// Original progression in A minor, i-VI-III-VII (Am F C G), with a 3-3-2 strum (dotted quarter, dotted quarter,
// quarter). The third time through, the last bar splits its final beat; the end resolves on Am.

import type { SongScore } from '../../services/songs';

const Am = 'Am[5:0 4:2 3:2 2:1]'; // A E A C
const F = 'F[4:3 3:2 2:1 1:1]'; // F A C F
const C = 'C[5:3 4:2 3:0 2:1]'; // C E G C
const G = 'G[6:3 5:2 4:0 3:0]'; // G B D G

const bar = (chord: string, pattern: string): string => pattern.split(' ').map((duration) => `${chord}${duration}`).join(' ');
const strum = (chord: string): string => bar(chord, 'q. q. q');

export const score: SongScore = {
  parts: [{
    code: 0,
    bars: [
      strum(Am), strum(F), strum(C), strum(G),
      strum(Am), strum(F), strum(C), strum(G),
      strum(Am), strum(F), strum(C), bar(G, 'q. q. e e'),
      strum(Am), strum(F), `${C}h ${G}h`, `${Am}w`
    ]
  }]
};
