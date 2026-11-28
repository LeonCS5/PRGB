import { describe, expect, it } from 'vitest';
import { EXERCISE_CATEGORIES, buildExerciseTab, exerciseByCode } from '../services/exercises';
import { getDemoSong } from '../services/demoSong';
import type { NoteEvent } from '../services/tabsApi';
import { analyzeTechniques, bendLabel, isLinkedPair, linkBadge, slideKindOf } from './techniques';

const note = (id: number, timeMs: number, string: number, fret: number, extra: Partial<NoteEvent> = {}): NoteEvent => ({
  id: `n${id}`, timeMs, durationMs: 250, string, fret, midiNote: 40 + fret, freqHz: 100, noteName: 'E', ...extra
});

const exercise = (code: number) => {
  const item = exerciseByCode(code);
  if (!item) throw new Error(`no exercise ${code}`);
  return buildExerciseTab(item, 0).notes;
};

describe('analyzeTechniques', () => {
  it('reads a hammer-on from the destination note: 5 picked, 7 hammered', () => {
    const notes = [note(1, 0, 2, 5), note(2, 250, 2, 7, { hammerOnOrPullOff: true })];
    const { links, destination } = analyzeTechniques(notes);
    expect(links).toEqual([{ kind: 'hammer', from: 0, to: 1, up: true }]);
    expect(destination).toEqual([false, true]);
  });

  it('reads a pull-off from the fret going down', () => {
    const { links } = analyzeTechniques([note(1, 0, 2, 7), note(2, 250, 2, 5, { hammerOnOrPullOff: true })]);
    expect(links).toEqual([{ kind: 'pull', from: 0, to: 1, up: false }]);
    expect(linkBadge(links[0])).toBe('P');
  });

  it('keeps a chain of legato notes as one chain: H, H, P, P', () => {
    const notes = [5, 7, 8, 7, 5].map((fret, index) => note(index, index * 250, 3, fret, { hammerOnOrPullOff: index > 0 }));
    const { links, destination } = analyzeTechniques(notes);
    expect(links.map(linkBadge)).toEqual(['H', 'H', 'P', 'P']);
    expect(links.map((link) => [link.from, link.to])).toEqual([[0, 1], [1, 2], [2, 3], [3, 4]]);
    expect(destination).toEqual([false, true, true, true, true]);
  });

  it('does not join across a rest or onto another string', () => {
    const rest = [note(1, 0, 2, 5), note(2, 1000, 2, 7, { hammerOnOrPullOff: true })];
    expect(analyzeTechniques(rest).links).toEqual([]);
    const other = [note(1, 0, 2, 5), note(2, 250, 3, 7, { hammerOnOrPullOff: true })];
    expect(analyzeTechniques(other).links).toEqual([]);
  });

  it('does not join the same fret twice (a repeated note is a new pick)', () => {
    expect(analyzeTechniques([note(1, 0, 2, 5), note(2, 250, 2, 5, { hammerOnOrPullOff: true })]).links).toEqual([]);
  });

  it('a shift slide joins two picked notes; a legato slide leaves the destination unpicked', () => {
    const shift = analyzeTechniques([note(1, 0, 2, 5, { slide: 'shift' }), note(2, 250, 2, 7)]);
    expect(shift.links).toEqual([{ kind: 'slide', from: 0, to: 1, up: true, slide: 'shift' }]);
    expect(shift.destination).toEqual([false, false]);
    const legato = analyzeTechniques([note(1, 0, 2, 9, { slide: 'legato' }), note(2, 250, 2, 5)]);
    expect(legato.links).toEqual([{ kind: 'slide', from: 0, to: 1, up: false, slide: 'legato' }]);
    expect(legato.destination).toEqual([false, true]);
    expect(linkBadge(legato.links[0])).toBe('\\');
  });

  it('a slide with nothing after it leaves the note (slide out); one named "in" enters it', () => {
    expect(analyzeTechniques([note(1, 0, 2, 5, { slide: 'shift' })]).links).toEqual([{ kind: 'slide', from: 0, to: 0, up: false, slide: 'out' }]);
    expect(analyzeTechniques([note(1, 0, 2, 5, { slide: 'inFromBelow' })]).links).toEqual([{ kind: 'slide', from: 0, to: 0, up: true, slide: 'in' }]);
  });

  it('ignores grace notes and dead notes', () => {
    expect(analyzeTechniques([note(1, 0, 2, 5, { grace: true }), note(2, 250, 2, 7, { hammerOnOrPullOff: true })]).links).toEqual([]);
    expect(analyzeTechniques([note(1, 0, 2, 5, { dead: true }), note(2, 250, 2, 7, { hammerOnOrPullOff: true })]).links).toEqual([]);
  });

  it('isLinkedPair is what the spacing lets touch', () => {
    expect(isLinkedPair(note(1, 0, 2, 5), note(2, 250, 2, 7, { hammerOnOrPullOff: true }))).toBe(true);
    expect(isLinkedPair(note(1, 0, 2, 5), note(2, 250, 2, 7))).toBe(false);
    expect(isLinkedPair(note(1, 0, 2, 5, { slide: 'shift' }), note(2, 250, 2, 7))).toBe(true);
  });
});

describe('slideKindOf and bendLabel', () => {
  it('names the kinds', () => {
    expect(slideKindOf('shift', true)).toBe('shift');
    expect(slideKindOf('legato', true)).toBe('legato');
    expect(slideKindOf('outDown', true)).toBe('out');
    expect(slideKindOf('inAbove', true)).toBe('in');
    expect(slideKindOf(undefined, true)).toBeNull();
  });
  it('writes the bend in tones', () => {
    expect([0.5, 1, 1.5, 2, 3, 4, 0, undefined].map(bendLabel)).toEqual(['¼', '½', '¾', '1', '1½', '2', '', '']);
  });
});

describe('the techniques of the bundled exercises', () => {
  it('Hammer-on (20): every second note is a hammer-on', () => {
    const notes = exercise(20);
    const { links } = analyzeTechniques(notes);
    expect(links.length).toBeGreaterThan(5);
    expect(links.every((link) => link.kind === 'hammer')).toBe(true);
  });

  it('Pull-off (21): every link is a pull-off', () => {
    const { links } = analyzeTechniques(exercise(21));
    expect(links.length).toBeGreaterThan(5);
    expect(links.every((link) => link.kind === 'pull')).toBe(true);
  });

  it('Ligados em sequência (22): a chain of H, H, P, P per string', () => {
    const { links } = analyzeTechniques(exercise(22));
    expect(links.length).toBeGreaterThan(0);
    expect(links.length % 4).toBe(0);
    expect(links.slice(0, 4).map(linkBadge)).toEqual(['H', 'H', 'P', 'P']);
  });

  it('Slide (24): a shift slide to the next note', () => {
    const { links } = analyzeTechniques(exercise(24));
    expect(links.length).toBeGreaterThan(0);
    expect(links.every((link) => link.kind === 'slide' && link.slide === 'shift' && link.up)).toBe(true);
  });

  it('Slide e ligado (32): a slide, then two hammer-ons and pull-offs joined to it', () => {
    const { links } = analyzeTechniques(exercise(32));
    expect(links.slice(0, 4).map((link) => link.kind)).toEqual(['slide', 'hammer', 'pull', 'pull']);
  });

  it('every bundled exercise and the demo analyze without a link to nowhere', () => {
    const all = [...EXERCISE_CATEGORIES.flatMap((category) => category.groups.flatMap((group) => group.exercises.map((item) => buildExerciseTab(item, 0).notes))), getDemoSong().notes];
    for (const notes of all) {
      const { links, destination } = analyzeTechniques(notes);
      for (const link of links) {
        expect(link.from).toBeGreaterThanOrEqual(0);
        expect(link.to).toBeLessThan(notes.length);
        expect(notes[link.from].string).toBe(notes[link.to].string);
        if (link.slide !== 'in' && link.slide !== 'out') expect(notes[link.to].timeMs).toBeGreaterThan(notes[link.from].timeMs);
        if (link.kind !== 'slide' || link.slide === 'legato') expect(destination[link.to]).toBe(true);
      }
    }
  });
});

describe('blocks: notes joined one after another are one piece', () => {
  it('turns a chain of hammer-ons and pull-offs into one block with a link per division', () => {
    const notes = [5, 7, 8, 7, 5].map((fret, index) => note(index, index * 250, 3, fret, { hammerOnOrPullOff: index > 0 }));
    const { blocks, alone } = analyzeTechniques(notes);
    expect(blocks.length).toBe(1);
    expect(blocks[0].indexes).toEqual([0, 1, 2, 3, 4]);
    expect(blocks[0].links.map(linkBadge)).toEqual(['H', 'H', 'P', 'P']);
    expect(alone).toEqual([]);
  });

  it('keeps 5-6-5 and 6-8-6-8 as two blocks, one per string, even when played together', () => {
    const notes = [
      note(0, 0, 1, 5), note(1, 250, 1, 6, { hammerOnOrPullOff: true }), note(2, 500, 1, 5, { hammerOnOrPullOff: true }),
      note(3, 1000, 2, 6), note(4, 1250, 2, 8, { hammerOnOrPullOff: true }), note(5, 1500, 2, 6, { hammerOnOrPullOff: true }), note(6, 1750, 2, 8, { hammerOnOrPullOff: true })
    ];
    const { blocks } = analyzeTechniques(notes);
    expect(blocks.map((block) => block.indexes)).toEqual([[0, 1, 2], [3, 4, 5, 6]]);
  });

  it('puts a slide and what follows it in the same block, with the slash on the first division', () => {
    const { blocks, alone } = analyzeTechniques(exercise(32));
    expect(blocks[0].indexes.length).toBe(5);
    expect(blocks[0].links.map(linkBadge)).toEqual(['/', 'H', 'P', 'P']);
    expect(alone).toEqual([]);
  });

  it('leaves a slide in or out as a wedge beside its note, not a block', () => {
    const { blocks, alone } = analyzeTechniques([note(1, 0, 2, 5, { slide: 'out' })]);
    expect(blocks).toEqual([]);
    expect(alone.length).toBe(1);
  });

  it('draws no block for notes that are not joined', () => {
    expect(analyzeTechniques([note(1, 0, 2, 5), note(2, 250, 2, 7)]).blocks).toEqual([]);
  });
});

describe('palm mute runs: one bracket per stretch, never a tag per note', () => {
  it('joins consecutive palm-muted notes, whatever the string', () => {
    const notes = [note(1, 0, 6, 0, { palmMute: true }), note(2, 250, 6, 0, { palmMute: true }), note(3, 500, 5, 2, { palmMute: true })];
    const { palmMuteRuns } = analyzeTechniques(notes);
    expect(palmMuteRuns).toEqual([{ first: 0, last: 2, topString: 5 }]);
  });

  it('is broken by a note without it, and by a long silence', () => {
    const notes = [
      note(1, 0, 6, 0, { palmMute: true }), note(2, 250, 6, 0, { palmMute: true }), note(3, 500, 6, 0),
      note(4, 750, 6, 0, { palmMute: true }), note(5, 6000, 6, 0, { palmMute: true })
    ];
    expect(analyzeTechniques(notes).palmMuteRuns.map((run) => [run.first, run.last])).toEqual([[0, 1], [3, 3], [4, 4]]);
  });

  it('counts a chord as one stretch', () => {
    const notes = [note(1, 0, 6, 0, { palmMute: true }), note(2, 0, 5, 2, { palmMute: true }), note(3, 0, 4, 2, { palmMute: true })];
    expect(analyzeTechniques(notes).palmMuteRuns).toEqual([{ first: 0, last: 2, topString: 4 }]);
  });

  it('finds the stretches of the Palm mute exercise', () => {
    const notes = exercise(29);
    const { palmMuteRuns } = analyzeTechniques(notes);
    expect(palmMuteRuns.length).toBeGreaterThan(0);
    expect(palmMuteRuns.length).toBeLessThan(notes.filter((each) => each.palmMute).length);
  });
});
