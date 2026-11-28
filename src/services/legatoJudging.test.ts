import { describe, expect, it } from 'vitest';
import { getDemoSong } from './demoSong';
import { buildExerciseTab, exerciseByCode } from './exercises';
import {
  HIT_EARLY_MS,
  HIT_LATE_MS,
  LEGATO_EXTRA_LATE_MS,
  LEGATO_HELD_FRAMES,
  LEGATO_MAX_GAP_MS,
  PERFECT_LATE_MS,
  buildJudgeContexts,
  classifyAttackRequirement,
  consumeAttack,
  createAttackLedger,
  judgeNote,
  type JudgeContext
} from './scoring';
import type { NoteEvent } from './tabsApi';

const note = (id: string, timeMs: number, midiNote: number, extra: Partial<NoteEvent> = {}): NoteEvent => ({
  id,
  timeMs,
  durationMs: 250,
  string: 3,
  fret: midiNote - 55,
  midiNote,
  freqHz: 440,
  noteName: 'X',
  ...extra
});

const LINKED: JudgeContext = { requirement: 'pitch-change' };
const heard = (midiNote: number, attackId: number, changeId?: number, heldFrames?: number) => ({ midiNote, volume: 0.5, attackId, changeId, heldFrames });

describe('classifyAttackRequirement', () => {
  const first = note('a', 0, 60);

  it('needs a pick for a note with nothing before it, a chord and a plain note', () => {
    expect(classifyAttackRequirement(first, undefined)).toBe('attack');
    expect(classifyAttackRequirement(note('b', 250, 62), first)).toBe('attack');
    expect(classifyAttackRequirement(note('b', 250, 62, { hammerOnOrPullOff: true, chord: { toneClasses: [2], rootClass: 2 } as NoteEvent['chord'] }), first)).toBe('attack');
  });

  it('reaches the marked note of a hammer-on or a pull-off with a change of note, not a pick', () => {
    expect(classifyAttackRequirement(note('b', 250, 62, { hammerOnOrPullOff: true }), first)).toBe('pitch-change');
    expect(classifyAttackRequirement(note('c', 250, 58, { hammerOnOrPullOff: true }), first)).toBe('pitch-change');
  });

  it('reaches the note a slide leads to, whatever kind of slide it is, but not after a slide out or from a slide in', () => {
    expect(classifyAttackRequirement(note('b', 250, 64), { ...first, slide: 'shift' })).toBe('pitch-change');
    expect(classifyAttackRequirement(note('b', 250, 64), { ...first, slide: 'legato' })).toBe('pitch-change');
    expect(classifyAttackRequirement(note('b', 250, 64), { ...first, slide: 'outDown' })).toBe('attack');
    expect(classifyAttackRequirement(note('b', 250, 64), { ...first, slide: 'inBelow' })).toBe('attack');
    // A note that itself begins with a slide in is picked
    expect(classifyAttackRequirement(note('b', 250, 64, { slide: 'inBelow' }), first)).toBe('attack');
  });

  it('needs a pick when nothing links the notes: a rest, the same pitch, a dead note or a chord before it', () => {
    const linked = { hammerOnOrPullOff: true };
    // 250 ms note, then a gap longer than the tolerance
    expect(classifyAttackRequirement(note('b', 250 + LEGATO_MAX_GAP_MS + 1, 62, linked), first)).toBe('attack');
    expect(classifyAttackRequirement(note('b', 250 + LEGATO_MAX_GAP_MS, 62, linked), first)).toBe('pitch-change');
    expect(classifyAttackRequirement(note('b', 250, 60, linked), first)).toBe('attack');
    expect(classifyAttackRequirement(note('b', 250, 62, linked), { ...first, dead: true })).toBe('attack');
    expect(classifyAttackRequirement(note('b', 250, 62, linked), { ...first, chordMember: true })).toBe('attack');
  });

  it('never judges a note that is not scored', () => {
    expect(classifyAttackRequirement(note('b', 250, 62, { dead: true }), first)).toBe('none');
    expect(classifyAttackRequirement(note('b', 250, 62, { grace: true }), first)).toBe('none');
  });
});

describe('buildJudgeContexts', () => {
  it('follows each string on its own, and ignores grace notes as the note before', () => {
    const notes = [
      note('a', 0, 60),
      note('b', 0, 50, { string: 4 }),
      note('c', 250, 62, { hammerOnOrPullOff: true }),
      note('d', 250, 52, { string: 4 }),
      note('g', 400, 70, { grace: true }),
      note('e', 500, 64, { hammerOnOrPullOff: true })
    ];
    const contexts = buildJudgeContexts(notes);
    expect(notes.map((one) => contexts.get(one.id)?.requirement)).toEqual(['attack', 'attack', 'pitch-change', 'attack', 'none', 'pitch-change']);
  });

  it('lets the origin of a slide count the pitches it passes, and nothing else', () => {
    const notes = [note('a', 0, 60, { slide: 'shift' }), note('b', 250, 66), note('c', 500, 60)];
    const contexts = buildJudgeContexts(notes);
    expect(contexts.get('a')?.slideRange).toEqual([60, 66]);
    expect(contexts.get('b')).toEqual({ requirement: 'pitch-change' });
    expect(contexts.get('c')?.requirement).toBe('attack');
  });
});

describe('judgeNote for a note reached without a pick', () => {
  const target = note('b', 1000, 62, { hammerOnOrPullOff: true });

  it('hits on the change of note even though the attack of the pick before it is spent', () => {
    let ledger = createAttackLedger();
    ledger = consumeAttack(ledger, 4, 750, 10);
    // Same attack, but the note changed since the last hit: only a note reached without a pick is judged like that
    expect(judgeNote(target, 0, heard(62, 4, 11, 4), ledger)).toBeNull();
    expect(judgeNote(target, 0, heard(62, 4, 11, 4), ledger, LINKED)).toBe('perfect');
  });

  it('is not hit by the note still ringing from the hit before it', () => {
    const ledger = consumeAttack(createAttackLedger(), 4, 750, 10);
    // Nothing changed since the last hit: the pitch one fret under or over it is the old note, not this one
    expect(judgeNote(target, 0, heard(61, 4, 10, 9), ledger, LINKED)).toBeNull();
    expect(judgeNote(target, 0, heard(62, 4, 10, 9), ledger, LINKED)).toBeNull();
  });

  it('wants the note itself: a semitone off never hits it, though it would hit a note that is picked', () => {
    const ledger = createAttackLedger();
    expect(judgeNote(target, 0, heard(63, 4, 11, 4), ledger, LINKED)).toBeNull();
    expect(judgeNote(target, 0, heard(61, 4, 11, 4), ledger, LINKED)).toBeNull();
    expect(judgeNote({ ...target, hammerOnOrPullOff: false }, 0, heard(63, 5), ledger)).toBe('good');
    // An octave off still counts as Good, as for any note
    expect(judgeNote(target, 0, heard(74, 4, 11, 4), ledger, LINKED)).toBe('good');
  });

  it('does not hit on a pitch that has not held for a few readings', () => {
    const ledger = createAttackLedger();
    expect(judgeNote(target, 0, heard(62, 4, 11, LEGATO_HELD_FRAMES - 1), ledger, LINKED)).toBeNull();
    expect(judgeNote(target, 0, heard(62, 4, 11, LEGATO_HELD_FRAMES), ledger, LINKED)).toBe('perfect');
  });

  it('gives it more time after the line, but only Good beyond the Perfect window', () => {
    const ledger = createAttackLedger();
    const late = -(HIT_LATE_MS + LEGATO_EXTRA_LATE_MS);
    expect(judgeNote(target, -PERFECT_LATE_MS, heard(62, 4, 11, 4), ledger, LINKED)).toBe('perfect');
    expect(judgeNote(target, -PERFECT_LATE_MS - 1, heard(62, 4, 11, 4), ledger, LINKED)).toBe('good');
    expect(judgeNote(target, late, heard(62, 4, 11, 4), ledger, LINKED)).toBe('good');
    expect(judgeNote(target, late - 1, heard(62, 4, 11, 4), ledger, LINKED)).toBe('miss');
    // A picked note keeps the window it always had
    expect(judgeNote({ ...target, hammerOnOrPullOff: false }, -HIT_LATE_MS - 1, heard(62, 4, 11, 4), ledger)).toBe('miss');
    expect(judgeNote(target, HIT_EARLY_MS + 1, heard(62, 4, 11, 4), ledger, LINKED)).toBeNull();
  });

  it('falls back to a fresh attack when the pitch carries no count of changes', () => {
    const ledger = consumeAttack(createAttackLedger(), 4, 750);
    expect(judgeNote(target, 0, heard(62, 4), ledger, LINKED)).toBeNull();
    expect(judgeNote(target, 0, heard(62, 5), ledger, LINKED)).toBe('perfect');
  });

  it('leaves a note without context judged exactly as before', () => {
    const ledger = consumeAttack(createAttackLedger(), 4, 750, 10);
    expect(judgeNote(target, 0, heard(62, 4, 11, 4), ledger, undefined)).toBeNull();
    expect(judgeNote(target, 0, heard(62, 5, 11, 4), ledger, { requirement: 'attack' })).toBe('perfect');
  });
});

describe('judgeNote at the start of a slide', () => {
  const origin = note('a', 1000, 60, { slide: 'shift' });
  const context: JudgeContext = { requirement: 'attack', slideRange: [60, 66] };

  it('counts a pitch the slide has already reached as Good, never Perfect, and not one past its end', () => {
    expect(judgeNote(origin, 0, heard(60, 1), undefined, context)).toBe('perfect');
    expect(judgeNote(origin, 0, heard(63, 1), undefined, context)).toBe('good');
    expect(judgeNote(origin, 0, heard(66, 1), undefined, context)).toBe('good');
    expect(judgeNote(origin, 0, heard(67, 1), undefined, context)).toBeNull();
    expect(judgeNote(origin, 0, heard(63, 1), undefined, { requirement: 'attack' })).toBeNull();
  });
});

describe('the attack ledger and changes of note', () => {
  it('keeps the latest change it has seen, and the old shape when it has seen none', () => {
    expect(consumeAttack(createAttackLedger(), 1, 100)).toEqual({ attackId: 1, noteTimeMs: 100 });
    const seen = consumeAttack(createAttackLedger(), 1, 100, 5);
    expect(seen.changeId).toBe(5);
    expect(consumeAttack(seen, 2, 400, 3).changeId).toBe(5);
    expect(consumeAttack(seen, 2, 400).changeId).toBe(5);
    expect(consumeAttack(seen, 2, 400, 8).changeId).toBe(8);
  });
});

describe('what reaches the judge from the notes of the game', () => {
  const tabOf = (code: number) => {
    const item = exerciseByCode(code);
    expect(item).not.toBeNull();
    return buildExerciseTab(item!, 0).notes.filter((one) => !one.grace);
  };
  const requirements = (notes: NoteEvent[]) => {
    const contexts = buildJudgeContexts(notes);
    return notes.map((one) => contexts.get(one.id)?.requirement);
  };

  it('marks the second note of the hammer-on and of the pull-off exercises, on every string, as the linked one', () => {
    for (const code of [20, 21]) {
      const notes = tabOf(code);
      const kinds = requirements(notes);
      expect(notes.length).toBeGreaterThan(0);
      notes.forEach((one, index) => {
        // The exercise plays first the picked note, then the linked one, over and over
        const linked = !!one.hammerOnOrPullOff;
        expect(kinds[index]).toBe(linked ? 'pitch-change' : 'attack');
      });
      expect(kinds.filter((kind) => kind === 'pitch-change').length).toBe(notes.filter((one) => one.hammerOnOrPullOff).length);
    }
  });

  it('keeps one pick for a group of linked notes in the exercise made of them', () => {
    const notes = tabOf(22);
    const kinds = requirements(notes);
    // Every group is one pick and four linked notes; the notes of one group stay on one string
    const picks = kinds.filter((kind) => kind === 'attack').length;
    const linked = kinds.filter((kind) => kind === 'pitch-change').length;
    expect(linked).toBe(picks * 4);
  });

  it('reaches the note a slide leads to, in the slide exercises', () => {
    for (const notes of [tabOf(24), tabOf(31), tabOf(32)]) {
      const contexts = buildJudgeContexts(notes);
      const slides = notes.filter((one) => one.slide);
      expect(slides.length).toBeGreaterThan(0);
      expect(slides.some((one) => contexts.get(one.id)?.slideRange)).toBe(true);
    }
    // The slide exercise: from fret 5 to fret 7 on the same string, so the second note is the linked one
    const kinds = requirements(tabOf(24));
    expect(kinds.slice(0, 2)).toEqual(['attack', 'pitch-change']);
  });

  it('leaves a slide that leads to another string, as in the demo, to be judged like any picked note', () => {
    const demo = getDemoSong().notes;
    const contexts = buildJudgeContexts(demo);
    const slide = demo.find((one) => one.slide);
    expect(slide).toBeDefined();
    expect(contexts.get(slide!.id)?.slideRange).toBeUndefined();
    // The demo has a hammer-on too: its marked note is the linked one
    const hammer = demo.find((one) => one.hammerOnOrPullOff);
    expect(hammer && contexts.get(hammer.id)?.requirement).toBe('pitch-change');
  });

  it('judges no note of the game as not scorable by accident, and the count the server checks is unchanged', () => {
    for (const code of [20, 21, 22, 24, 31, 32]) {
      const notes = tabOf(code);
      const kinds = requirements(notes);
      notes.forEach((one, index) => expect(kinds[index] === 'none').toBe(!!one.dead || !!one.grace));
    }
  });
});
