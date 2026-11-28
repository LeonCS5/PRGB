import { describe, expect, it } from 'vitest';
import type { NoteEvent } from '../services/tabsApi';
import { clearPlayed, createSynthLane, dueNotes, unmarkAfter, unmarkPlayed, type SynthLane } from './synthSchedule';

const note = (id: number, timeMs: number, extra: Partial<NoteEvent> = {}): NoteEvent => ({
  id: `note-${id}`,
  timeMs,
  durationMs: 200,
  string: 1,
  fret: 0,
  midiNote: 64,
  freqHz: 330,
  noteName: 'E4',
  ...extra
});

const take = (lane: SynthLane, at: number, lap = 1, lookahead = 120, grace = 60): number[] => {
  const count = dueNotes(lane, at, lap, lookahead, grace);
  return Array.from(lane.due.subarray(0, count));
};

describe('dueNotes', () => {
  const notes = [note(0, 1000), note(1, 1500), note(2, 2000), note(3, 2500)];

  it('takes a note from `lookahead` ahead of the line until `grace` after it', () => {
    const lane = createSynthLane(notes);
    expect(take(lane, 879)).toEqual([]); // 121 ms ahead
    expect(take(lane, 880)).toEqual([0]); // 120 ms ahead
    expect(take(lane, 880)).toEqual([]); // never twice
    expect(take(lane, 1000)).toEqual([]);
    const late = createSynthLane(notes);
    expect(take(late, 1060)).toEqual([0]); // 60 ms past it: a late frame still plays it
    const tooLate = createSynthLane(notes);
    expect(take(tooLate, 1061)).toEqual([]); // 61 ms past it: gone
  });

  it('plays a chord (the same time) all at once, and skips the dead notes', () => {
    const lane = createSynthLane([note(0, 500), note(1, 500), note(2, 500, { dead: true }), note(3, 500)]);
    expect(take(lane, 450).sort()).toEqual([0, 1, 3]);
  });

  it('does not depend on the notes being in time order', () => {
    const lane = createSynthLane([note(0, 2000), note(1, 1000), note(2, 1500)]);
    expect(take(lane, 1000)).toEqual([1]);
    expect(take(lane, 1500)).toEqual([2]);
    expect(take(lane, 2000)).toEqual([0]);
  });

  it('keeps the laps apart: right after a lap turns the old and the new one are both in the window', () => {
    const lane = createSynthLane([note(0, 30), note(1, 3980)]);
    expect(take(lane, 10, 2)).toEqual([0]); // lap 2, the first note
    expect(take(lane, 10 + 4000, 1)).toEqual([1]); // the lap before, on the old clock
    expect(take(lane, 10, 2)).toEqual([]);
    expect(take(lane, 10 + 4000, 1)).toEqual([]);
    expect(take(lane, 10, 3)).toEqual([0]); // the next lap plays the same note again
  });

  it('a note shorter than a lap in both windows plays once for each lap, and never flaps', () => {
    const lane = createSynthLane([note(0, 100)]);
    for (let frame = 0; frame < 5; frame++) {
      const first = take(lane, 100, 2);
      const second = take(lane, 100, 1);
      expect(first).toEqual(frame === 0 ? [0] : []);
      expect(second).toEqual(frame === 0 ? [0] : []);
    }
  });
});

describe('taking a note back', () => {
  const notes = [note(0, 1000), note(1, 2000), note(2, 3000)];

  it('lets a note taken back from the audio clock be handed over again', () => {
    const lane = createSynthLane(notes);
    expect(take(lane, 1000)).toEqual([0]);
    unmarkPlayed(lane, 0, 1);
    expect(take(lane, 1000)).toEqual([0]);
  });

  it('only unmarks the lap it is told', () => {
    const lane = createSynthLane(notes);
    take(lane, 1000, 2);
    unmarkPlayed(lane, 0, 1); // another lap: nothing to undo
    expect(take(lane, 1000, 2)).toEqual([]);
  });

  it('after a seek, the notes later than the new position sound again and the earlier ones do not', () => {
    const lane = createSynthLane(notes);
    take(lane, 1000);
    take(lane, 2000);
    take(lane, 3000);
    unmarkAfter(lane, 2000, 1); // the song goes back to 2000: what is later than that is ahead again
    expect(take(lane, 1000)).toEqual([]); // before the position: stays played
    expect(take(lane, 2000)).toEqual([]); // at the position: stays played
    expect(take(lane, 3000)).toEqual([2]);
  });

  it('clearPlayed starts everything over', () => {
    const lane = createSynthLane(notes);
    take(lane, 1000);
    clearPlayed(lane);
    expect(take(lane, 1000)).toEqual([0]);
  });
});

// The scheduling this replaced: every note, every pass, a text key per note and lap
const reference = (all: readonly NoteEvent[], frames: { at: number; lap: number }[], lookahead: number, grace: number) => {
  const played = new Set<string>();
  const scheduled: string[] = [];
  for (const { at, lap } of frames) {
    for (const [index, n] of all.entries()) {
      if (n.dead) continue;
      const ahead = n.timeMs - at;
      const key = `${lap}:${index}`;
      if (ahead <= lookahead && ahead >= -grace && !played.has(key)) {
        played.add(key);
        scheduled.push(key);
      }
    }
  }
  return scheduled.sort();
};

describe('equivalence with scanning every note', () => {
  it('schedules exactly the same notes, once each, over a whole run at several frame rates', () => {
    let seed = 7;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    const all: NoteEvent[] = [];
    for (let index = 0; index < 120; index++) all.push(note(index, Math.round(random() * 20000), { dead: random() < 0.1 }));
    for (const step of [8, 16.7, 33, 120]) {
      const frames: { at: number; lap: number }[] = [];
      for (let at = -500; at < 21000; at += step) frames.push({ at, lap: 1 });
      const lane = createSynthLane(all);
      const got: string[] = [];
      for (const { at, lap } of frames) for (const index of take(lane, at, lap)) got.push(`${lap}:${index}`);
      expect(got.sort()).toEqual(reference(all, frames, 120, 60));
    }
  });
});
