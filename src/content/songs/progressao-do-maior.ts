// Original progression in C major, I-vi-IV-V (C Am F G), four times through with the strum getting busier:
// a whole-note chord, then half notes, then quarter-quarter-half, then quarters, closing on C.

import type { SongScore } from '../../services/songs';

const C = 'C[5:3 4:2 3:0 2:1]'; // C E G C
const Am = 'Am[5:0 4:2 3:2 2:1]'; // A E A C
const F = 'F[4:3 3:2 2:1 1:1]'; // F A C F
const G = 'G[6:3 5:2 4:0 3:0]'; // G B D G

const bar = (chord: string, pattern: string): string => pattern.split(' ').map((duration) => `${chord}${duration}`).join(' ');
const pass = (pattern: string): string[] => [C, Am, F, G].map((chord) => bar(chord, pattern));

export const score: SongScore = {
  parts: [{
    code: 0,
    bars: [
      ...pass('w'),
      ...pass('h h'),
      ...pass('q q h'),
      bar(C, 'q q q q'), bar(Am, 'q q q q'), `${F}h ${G}h`, `${C}w`
    ]
  }]
};
