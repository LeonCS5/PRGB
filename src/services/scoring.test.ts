import { describe, expect, it } from 'vitest';
import {
  CHORD_WINDOW_MS,
  GOOD_POINTS,
  MAX_MULTIPLIER,
  PERFECT_POINTS,
  accuracyPercent,
  applyJudgement,
  bendTargetMidi,
  canUseAttack,
  comboMultiplier,
  consumeAttack,
  countScorableNotes,
  createAttackLedger,
  createScoreState,
  isScorable,
  judgeNote,
  maxPossibleScore,
  type AttackLedger,
  type Judgement,
  type NoteOutcome,
  type ScoreState
} from './scoring';
import type { NoteEvent } from './songsterrApi';

// A3 on string 3, fret 2
const note = (extra: Partial<NoteEvent> = {}): NoteEvent => ({
  id: 'note-1',
  timeMs: 1000,
  durationMs: 250,
  string: 3,
  fret: 2,
  midiNote: 57,
  freqHz: 220,
  noteName: 'A3',
  ...extra
});

const heard = (midiNote: number, volume = 0.5, attackId = 0) => ({ midiNote, volume, attackId });

const play = (judgements: readonly Judgement[], from: ScoreState = createScoreState()) =>
  judgements.reduce(applyJudgement, from);

// mulberry32: random sequences that are the same on every run
const seededRandom = (seed: number) => {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

describe('comboMultiplier', () => {
  it('goes up every 5 hits in a row and caps at ×4', () => {
    expect([0, 4, 5, 9, 10, 14, 15, 16, 100].map(comboMultiplier)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 4]);
  });
});

describe('applyJudgement', () => {
  it('counts perfect and good hits and grows the combo', () => {
    const first = applyJudgement(createScoreState(), 'perfect');
    expect(first).toEqual({ score: 150, combo: 1, maxCombo: 1, perfect: 1, good: 0, miss: 0 });
    expect(applyJudgement(first, 'good')).toEqual({ score: 250, combo: 2, maxCombo: 2, perfect: 1, good: 1, miss: 0 });
  });

  it('pays each hit with the multiplier of the combo built before it', () => {
    const four = play(['perfect', 'perfect', 'perfect', 'perfect']);
    const fifth = applyJudgement(four, 'perfect');
    expect(fifth.score - four.score).toBe(PERFECT_POINTS); // combo 4: still ×1
    const sixth = applyJudgement(fifth, 'good');
    expect(sixth.score - fifth.score).toBe(GOOD_POINTS * 2); // combo 5: ×2
  });

  it('caps the multiplier at ×4', () => {
    const longCombo = { ...createScoreState(), combo: 40, maxCombo: 40 };
    expect(applyJudgement(longCombo, 'perfect').score).toBe(PERFECT_POINTS * MAX_MULTIPLIER);
  });

  it('breaks the combo on a miss but keeps the score and the max combo', () => {
    const before = play(['perfect', 'good', 'perfect']);
    expect(applyJudgement(before, 'miss')).toEqual({ ...before, combo: 0, maxCombo: 3, miss: 1 });
  });

  it('prices hits landing in the same frame with the current combo', () => {
    // The canvas used to price every hit of a frame with the combo of the last render
    const four = play(['perfect', 'perfect', 'perfect', 'perfect']);
    expect(play(['perfect', 'perfect'], four).score - four.score).toBe(PERFECT_POINTS + PERFECT_POINTS * 2);
    expect(play(Array<Judgement>(6).fill('perfect')).score).toBe(5 * 150 + 300);
  });

  it('never mutates the state it gets', () => {
    const state = Object.freeze(createScoreState());
    expect(() => play(['perfect', 'good', 'miss'], state)).not.toThrow();
    expect(state).toEqual(createScoreState());
  });
});

describe('accuracyPercent', () => {
  it('is 100% before any note is judged', () => {
    expect(accuracyPercent(createScoreState())).toBe(100);
  });

  it('rounds the share of perfect and good hits', () => {
    expect(accuracyPercent(play(['perfect', 'perfect', 'good', 'miss']))).toBe(75);
    expect(accuracyPercent(play(['perfect', 'good', 'miss']))).toBe(67);
    expect(accuracyPercent(play(['good', 'miss', 'miss']))).toBe(33);
  });
});

describe('isScorable / countScorableNotes', () => {
  it('leaves dead and grace notes out but keeps ghost notes', () => {
    expect(isScorable(note())).toBe(true);
    expect(isScorable(note({ ghost: true }))).toBe(true);
    expect(isScorable(note({ dead: true }))).toBe(false);
    expect(isScorable(note({ grace: true }))).toBe(false);
    expect(countScorableNotes([note(), note({ dead: true }), note({ ghost: true }), note({ grace: true })])).toBe(2);
  });
});

describe('bendTargetMidi', () => {
  it('adds the rounded bend to the written pitch', () => {
    expect(bendTargetMidi(note())).toBe(57);
    expect(bendTargetMidi(note({ bendSemitones: 2 }))).toBe(59);
    expect(bendTargetMidi(note({ bendSemitones: 0.5 }))).toBe(58);
    expect(bendTargetMidi(note({ bendSemitones: 1.4 }))).toBe(58);
  });
});

describe('judgeNote', () => {
  const a3 = note();
  const inTune = heard(57);

  it('is perfect within 55 ms and good within 130 ms, early or late', () => {
    expect([0, 55, -55].map((diff) => judgeNote(a3, diff, inTune))).toEqual(['perfect', 'perfect', 'perfect']);
    expect([56, -56, 130, -130].map((diff) => judgeNote(a3, diff, inTune))).toEqual(['good', 'good', 'good', 'good']);
  });

  it('keeps a note pending before its window opens, even with the right pitch', () => {
    expect(judgeNote(a3, 131, inTune)).toBeNull();
    expect(judgeNote(a3, 5000, inTune)).toBeNull();
  });

  it('misses a note more than 130 ms late, even if the pitch matches now', () => {
    expect(judgeNote(a3, -131, inTune)).toBe('miss');
    expect(judgeNote(a3, -131, null)).toBe('miss');
  });

  it('waits inside the window for a loud enough pitch within a semitone', () => {
    expect(judgeNote(a3, 0, null)).toBeNull();
    expect(judgeNote(a3, 0, heard(57, 0.02))).toBeNull(); // must be louder than MIN_PITCH_VOLUME
    expect(judgeNote(a3, 0, heard(57, 0.021))).toBe('perfect');
    expect([56, 58].map((midi) => judgeNote(a3, 0, heard(midi)))).toEqual(['good', 'good']);
    expect([55, 59].map((midi) => judgeNote(a3, 0, heard(midi)))).toEqual([null, null]);
  });

  it('gives perfect only for the exact note: a semitone off is at most good', () => {
    expect([0, 30, -55].map((diff) => judgeNote(a3, diff, heard(57)))).toEqual(['perfect', 'perfect', 'perfect']);
    expect([0, 30, -55, 100].map((diff) => judgeNote(a3, diff, heard(58)))).toEqual(['good', 'good', 'good', 'good']);
    expect([0, 100].map((diff) => judgeNote(a3, diff, heard(56)))).toEqual(['good', 'good']);
  });

  it('accepts the written pitch or the bend target on bends, perfect only when exact', () => {
    const bend = note({ bendSemitones: 2 }); // A3 bent up to B3
    expect([56, 57, 58, 59, 60].map((midi) => judgeNote(bend, 0, heard(midi))))
      .toEqual(['good', 'perfect', 'good', 'perfect', 'good']);
    expect([55, 61].map((midi) => judgeNote(bend, 0, heard(midi)))).toEqual([null, null]);
  });

  it('scores ghost notes when played and skips them when not', () => {
    const ghost = note({ ghost: true });
    expect(judgeNote(ghost, 0, inTune)).toBe('perfect');
    expect(judgeNote(ghost, 100, inTune)).toBe('good');
    expect(judgeNote(ghost, -130, null)).toBeNull();
    expect(judgeNote(ghost, -131, null)).toBe('skip');
  });

  it('never judges dead or grace notes and skips them once they pass', () => {
    for (const extra of [{ dead: true }, { grace: true }]) {
      const unscored = note(extra);
      expect([500, 0, 55, -130].map((diff) => judgeNote(unscored, diff, inTune))).toEqual([null, null, null, null]);
      expect(judgeNote(unscored, -131, inTune)).toBe('skip');
      expect(judgeNote(unscored, -131, null)).toBe('skip');
    }
  });
});

describe('attack ledger', () => {
  it('starts with no attack spent', () => {
    expect(createAttackLedger()).toEqual({ attackId: -1, noteTimeMs: -Infinity });
    expect(canUseAttack(createAttackLedger(), 0, 0)).toBe(true);
  });

  it('lets a spent attack hit only the notes of the same chord', () => {
    const ledger: AttackLedger = { attackId: 7, noteTimeMs: 1000 };
    expect(CHORD_WINDOW_MS).toBe(30);
    expect(canUseAttack(ledger, 8, 1150)).toBe(true); // new attack
    expect([1000, 1030, 970].map((time) => canUseAttack(ledger, 7, time))).toEqual([true, true, true]);
    expect([1031, 969, 1150].map((time) => canUseAttack(ledger, 7, time))).toEqual([false, false, false]);
  });

  it('records a hit in a new ledger and keeps the chord anchored at its first note', () => {
    const start = Object.freeze(createAttackLedger());
    const first = consumeAttack(start, 3, 1000);
    expect(first).toEqual({ attackId: 3, noteTimeMs: 1000 });
    expect(start).toEqual(createAttackLedger());
    const sameChord = consumeAttack(Object.freeze(first), 3, 1020);
    expect(sameChord).toEqual({ attackId: 3, noteTimeMs: 1000 });
    // Notes 20 ms apart can't chain one attack through a run of notes
    expect(canUseAttack(sameChord, 3, 1040)).toBe(false);
    expect(consumeAttack(sameChord, 4, 1040)).toEqual({ attackId: 4, noteTimeMs: 1040 });
  });
});

describe('judgeNote with an attack ledger', () => {
  const E2 = 40;

  /**
   * Plays notes the way the game loop does: every 16 ms frame, each pending note is judged against the
   * pitch heard, and each hit spends its attack. Returns the outcome of every note.
   */
  const play = (
    notes: NoteEvent[],
    pitchAt: (timeMs: number) => ReturnType<typeof heard> | null,
    withLedger = true
  ): (NoteOutcome | undefined)[] => {
    const outcomes = new Map<string, NoteOutcome>();
    let ledger = createAttackLedger();
    const end = Math.max(...notes.map((current) => current.timeMs)) + 300;
    for (let time = 0; time <= end; time += 16) {
      const pitch = pitchAt(time);
      for (const current of notes) {
        if (outcomes.has(current.id)) continue;
        const outcome = judgeNote(current, current.timeMs - time, pitch, withLedger ? ledger : undefined);
        if (!outcome) continue;
        outcomes.set(current.id, outcome);
        if (pitch && (outcome === 'perfect' || outcome === 'good')) {
          ledger = consumeAttack(ledger, pitch.attackId, current.timeMs);
        }
      }
    }
    return notes.map((current) => outcomes.get(current.id));
  };

  // The E2 riff of Creeping Death: the same note picked over and over, 150 ms apart
  const riff = Array.from({ length: 8 }, (_, i) =>
    note({ id: `note-${i}`, timeMs: 1000 + i * 150, string: 6, fret: 0, midiNote: E2, noteName: 'E2' }));

  it('does not let one held note hit the repeated notes after it', () => {
    const held = (time: number) => (time >= 950 ? heard(E2, 0.5, 1) : null);
    expect(play(riff, held)).toEqual(['perfect', ...Array(7).fill('miss')]);
    // Without a ledger the old behavior stays: holding the note hits them all
    expect(play(riff, held, false).every((outcome) => outcome === 'perfect' || outcome === 'good')).toBe(true);
  });

  it('hits every repeated note that is picked again', () => {
    // A new attack 50 ms before each note
    const picked = (time: number) => (time >= 950 ? heard(E2, 0.5, Math.floor((time - 950) / 150) + 1) : null);
    expect(play(riff, picked)).toEqual(Array(8).fill('perfect'));
  });

  it('hits the notes of a chord (same time) with one attack', () => {
    const chord = [
      note({ id: 'note-1', timeMs: 1000, string: 6, fret: 0, midiNote: E2 }),
      note({ id: 'note-2', timeMs: 1000, string: 5, fret: 0, midiNote: E2 + 1 }), // a semitone off: good
      note({ id: 'note-3', timeMs: 1000 + CHORD_WINDOW_MS, string: 4, fret: 0, midiNote: E2 }), // strummed
      note({ id: 'note-4', timeMs: 1300, string: 6, fret: 0, midiNote: E2 }) // the next beat, not picked again
    ];
    const once = (time: number) => (time >= 990 ? heard(E2, 0.5, 5) : null);
    expect(play(chord, once)).toEqual(['perfect', 'good', 'perfect', 'miss']);
  });

  it('still never judges dead or grace notes, and lets ghost notes pass unplayed', () => {
    const spent: AttackLedger = { attackId: 2, noteTimeMs: 500 };
    expect(judgeNote(note({ dead: true }), 0, heard(57, 0.5, 2), spent)).toBeNull();
    expect(judgeNote(note({ ghost: true }), 0, heard(57, 0.5, 2), spent)).toBeNull();
    expect(judgeNote(note({ ghost: true }), -131, heard(57, 0.5, 2), spent)).toBe('skip');
    expect(judgeNote(note(), -131, heard(57, 0.5, 2), spent)).toBe('miss');
    expect(judgeNote(note(), 0, heard(57, 0.5, 3), spent)).toBe('perfect');
  });
});

describe('maxPossibleScore', () => {
  it('matches the naive sum of perfect hits for 0 to 200 notes', () => {
    let naive = 0;
    for (let n = 0; n <= 200; n++) {
      expect(maxPossibleScore(n)).toBe(naive);
      naive += PERFECT_POINTS * comboMultiplier(n);
    }
  });

  it('is the score of a full perfect run', () => {
    expect([0, 5, 6, 16, 100].map(maxPossibleScore)).toEqual([0, 750, 1050, 5100, 55500]);
    expect(play(Array<Judgement>(37).fill('perfect')).score).toBe(maxPossibleScore(37));
  });

  it('throws RangeError for a count that is not a whole, non-negative, safe number', () => {
    for (const count of [-1, -3, 6.9, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY,
      Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => maxPossibleScore(count), String(count)).toThrow(RangeError);
    }
    expect(maxPossibleScore(-0)).toBe(0);
    expect(Number.isFinite(maxPossibleScore(Number.MAX_SAFE_INTEGER))).toBe(true);
  });

  it('is never beaten by any sequence of judgements over n scorable notes', () => {
    const random = seededRandom(0x5eed);
    // Weighted towards perfect so runs get close to the ceiling; null = ghost note left unplayed
    const outcomes: (Judgement | null)[] = ['perfect', 'perfect', 'perfect', 'perfect', 'good', 'miss', null];
    for (let trial = 0; trial < 1000; trial++) {
      const n = Math.floor(random() * 120);
      let state = createScoreState();
      for (let i = 0; i < n; i++) {
        const judgement = outcomes[Math.floor(random() * outcomes.length)];
        if (judgement) state = applyJudgement(state, judgement);
      }
      expect(state.score).toBeLessThanOrEqual(maxPossibleScore(n));
    }
  });

  it('bounds what judgeNote can award, whatever the notes and the pitches heard', () => {
    const random = seededRandom(42);
    for (let trial = 0; trial < 300; trial++) {
      const notes = Array.from({ length: Math.floor(random() * 80) }, () =>
        note({
          dead: random() < 0.15,
          grace: random() < 0.15,
          ghost: random() < 0.15,
          bendSemitones: random() < 0.2 ? 2 : undefined
        })
      );
      let state = createScoreState();
      for (const current of notes) {
        // Sweep the song past the note; each note is settled by its first outcome, as in the game
        for (let diff = 200; diff >= -200; diff -= 10) {
          const outcome = judgeNote(current, diff, heard(55 + Math.floor(random() * 7)));
          if (!outcome) continue;
          if (outcome !== 'skip') state = applyJudgement(state, outcome);
          break;
        }
      }
      expect(state.score).toBeLessThanOrEqual(maxPossibleScore(countScorableNotes(notes)));
    }
  });
});
