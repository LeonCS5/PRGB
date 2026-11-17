// Original funk riff in D minor pentatonic, sixteenth-note syncopation with rests (string 4: 0 D, 3 F; string 3:
// 0 G, 2 A; string 2: 1 C, 3 D; string 1: 1 F, 3 G, 5 A; string 5: 0 A, 3 C; string 6: 3 G). The riff calls, a
// lower answer replies, a high section on eighths moves the line up, and the riff returns for the close.

import type { SongScore } from '../../services/songs';

const call = '4:0s rs 4:0s 4:3s rs 4:0s 3:0s rs 4:0s rs 4:0s 4:3s 3:0s 3:2s rs 4:0s';
const answer = '5:0s rs 5:0s 5:3s rs 5:0s 5:3s rs 4:0s rs 5:3s 5:0s 6:3s rs 5:0s rs';
const callEnd = '4:0s rs 4:0s 4:3s rs 4:0s 3:0s rs 4:3e 4:0e 5:3e 5:0e';
const high = '2:3e 2:1s 2:3s 1:1e 2:3e 2:1e 3:2e 3:0e 4:0e';
const higher = '1:3e 1:1s 1:3s 1:5e 1:3e 1:1e 2:3e 2:1e 3:2e';

export const score: SongScore = {
  parts: [{
    code: 0,
    bars: [
      call, answer, call, callEnd,
      high, higher, high, '1:1e 2:3e 2:1e 3:2e 3:0e 4:3e 4:0e re',
      call, answer, call, callEnd,
      call, answer, call, '4:0q re 5:0e 4:0h'
    ]
  }]
};
