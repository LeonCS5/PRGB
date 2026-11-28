// Which notes of a lane are joined by a technique, and how: pure logic, shared by the drawing, the spacing and the
// tests. It only reads the fields the tab parser fills (hammerOnOrPullOff, slide, vibrato, palmMute, bendSemitones),
// so the judging and the parser stay as they are.
//
// How the fields arrive (checked against the parser and the exercises of the app):
//  - hammerOnOrPullOff sits on the DESTINATION note: the one that is not picked ("5, 7 hp" = 5 picked, 7 hammered on).
//    H or P is told from the fret: higher than the note before it on the string is a hammer-on, lower a pull-off.
//  - slide sits on the ORIGIN note and is a string ("shift", "legato", or a slide in/out); the destination is the next
//    note on the same string. A shift slide picks the destination again, a legato slide does not.
//  - a tie never gets here: the parser joins it to the note before.

import type { NoteEvent } from '../services/tabsApi';

export type SlideKind = 'shift' | 'legato' | 'in' | 'out';

export interface TechniqueLink {
  /** hammer-on or pull-off (a legato link), or a slide between two notes, or a slide that only enters or leaves one. */
  kind: 'hammer' | 'pull' | 'slide';
  /** Indexes into the lane's notes: the origin, and the destination (the same note for a slide in or out). */
  from: number;
  to: number;
  /** The destination is higher on the neck than the origin (for a slide in or out: it comes from below / goes up). */
  up: boolean;
  slide?: SlideKind;
}

/** Notes joined one after another on a string (5-6-5, 6-8-6-8, a slide and what follows): drawn as ONE block, a segment per note. */
export interface TechniqueBlock {
  /** Indexes into the lane's notes, in time order: one segment each. */
  indexes: number[];
  /** `links[i]` joins `indexes[i]` to `indexes[i + 1]`. */
  links: TechniqueLink[];
}

/** Consecutive notes under a palm mute: one bracket over the whole stretch, not a tag per note. */
export interface PalmMuteRun {
  first: number;
  last: number;
  /** The highest string of the stretch (1 = top): the bracket goes over it. */
  topString: number;
}

export interface TechniqueAnalysis {
  links: TechniqueLink[];
  /** Per note index: reached by a link without being picked (hammer-on, pull-off, legato slide). */
  destination: boolean[];
  /** The groups of notes joined by a link (two or more notes each). */
  blocks: TechniqueBlock[];
  /** Slides that only enter or leave a note: a short wedge beside it. */
  alone: TechniqueLink[];
  palmMuteRuns: PalmMuteRun[];
}

/** A palm mute with a longer silence than this in the middle is two stretches. */
export const PALM_MUTE_GAP_MS = 1500;

/** Two notes of a string are joined only when the second starts about when the first ends (a rest in between breaks it). */
export const LINK_SLACK_MS = 120;

export const slideKindOf = (raw: string | undefined, hasNext: boolean): SlideKind | null => {
  if (!raw) return null;
  const text = String(raw).toLowerCase();
  if (text.includes('legato')) return hasNext ? 'legato' : 'out';
  if (text.includes('shift')) return hasNext ? 'shift' : 'out';
  if (text.includes('out')) return 'out';
  if (text.includes('in')) return 'in';
  return hasNext ? 'shift' : 'out';
};

/** Slides that enter or leave a note say where from or to in their name ("below", "above", "up", "down"). */
const slideGoesUp = (raw: string, kind: SlideKind): boolean => {
  const text = raw.toLowerCase();
  if (text.includes('below') || text.includes('up')) return true;
  if (text.includes('above') || text.includes('down')) return false;
  return kind === 'in'; // by default a slide in climbs to the note and a slide out falls away from it
};

/** Notes of the lane by string, in time order, without the ornaments that take no time (grace). Indexes are of `notes`. */
const indexesByString = (notes: readonly NoteEvent[]): number[][] => {
  const byString = new Map<number, number[]>();
  notes.forEach((note, index) => {
    if (note.grace) return;
    const list = byString.get(note.string);
    if (list) list.push(index);
    else byString.set(note.string, [index]);
  });
  const lists = [...byString.values()];
  for (const list of lists) list.sort((a, b) => notes[a].timeMs - notes[b].timeMs || a - b);
  return lists;
};

export const follows = (before: NoteEvent, after: NoteEvent): boolean => after.timeMs > before.timeMs && after.timeMs <= before.timeMs + before.durationMs + LINK_SLACK_MS;

export const analyzeTechniques = (notes: readonly NoteEvent[]): TechniqueAnalysis => {
  const links: TechniqueLink[] = [];
  const destination: boolean[] = new Array<boolean>(notes.length).fill(false);
  for (const list of indexesByString(notes)) {
    for (let position = 0; position < list.length; position++) {
      const index = list[position];
      const note = notes[index];
      const previousIndex = position > 0 ? list[position - 1] : -1;
      const previous = previousIndex >= 0 ? notes[previousIndex] : null;
      const nextIndex = position < list.length - 1 ? list[position + 1] : -1;
      const next = nextIndex >= 0 ? notes[nextIndex] : null;
      const joinedToNext = !!next && follows(note, next) && !note.dead && !next.dead;

      // A slide leaves this note: to the next one on the string, or away from the string when there is none
      const slide = slideKindOf(note.slide, joinedToNext);
      if (slide) {
        if ((slide === 'shift' || slide === 'legato') && next) {
          links.push({ kind: 'slide', from: index, to: nextIndex, up: next.fret > note.fret, slide });
          if (slide === 'legato') destination[nextIndex] = true;
        } else if (slide === 'in') {
          links.push({ kind: 'slide', from: index, to: index, up: slideGoesUp(String(note.slide), 'in'), slide });
        } else {
          links.push({ kind: 'slide', from: index, to: index, up: slideGoesUp(String(note.slide), 'out'), slide: 'out' });
        }
      }

      // A hammer-on or pull-off arrives at this note; a slide that already joins the two takes its place
      if (note.hammerOnOrPullOff && previous && follows(previous, note) && previous.fret !== note.fret && !previous.dead && !(previous.slide && slideKindOf(previous.slide, true) !== 'out')) {
        const up = note.fret > previous.fret;
        links.push({ kind: up ? 'hammer' : 'pull', from: previousIndex, to: index, up });
        destination[index] = true;
      }
    }
  }
  links.sort((a, b) => notes[a.from].timeMs - notes[b.from].timeMs || a.from - b.from);

  // The links that join two notes make chains: each note is the end of one link and the start of the next
  const joins = links.filter((link) => link.from !== link.to);
  const byFrom = new Map<number, TechniqueLink>();
  const targets = new Set<number>();
  for (const link of joins) {
    byFrom.set(link.from, link);
    targets.add(link.to);
  }
  const blocks: TechniqueBlock[] = [];
  for (const head of joins) {
    if (targets.has(head.from)) continue; // not the start of a chain
    const indexes = [head.from];
    const chain: TechniqueLink[] = [];
    for (let link: TechniqueLink | undefined = head; link; link = byFrom.get(link.to)) {
      chain.push(link);
      indexes.push(link.to);
    }
    blocks.push({ indexes, links: chain });
  }
  const alone = links.filter((link) => link.from === link.to);

  // Palm mute: runs of consecutive notes (a chord counts as consecutive notes), broken by a note without it or a long silence
  const palmMuteRuns: PalmMuteRun[] = [];
  let open: PalmMuteRun | null = null;
  let endMs = 0;
  notes.forEach((note, index) => {
    if (note.grace) return;
    if (note.palmMute && open && note.timeMs - endMs <= PALM_MUTE_GAP_MS) {
      open.last = index;
      open.topString = Math.min(open.topString, note.string);
      endMs = Math.max(endMs, note.timeMs + note.durationMs);
    } else if (note.palmMute) {
      open = { first: index, last: index, topString: note.string };
      palmMuteRuns.push(open);
      endMs = note.timeMs + note.durationMs;
    } else {
      open = null;
    }
  });
  return { links, destination, blocks, alone, palmMuteRuns };
};

/** The note of a link is joined to the one before it (so the two touch on purpose and are not "overlapping"). */
export const isLinkedPair = (before: NoteEvent, after: NoteEvent): boolean =>
  follows(before, after) && !before.dead && !after.dead && before.string === after.string
  && (!!after.hammerOnOrPullOff && before.fret !== after.fret
    || (slideKindOf(before.slide, true) === 'shift' || slideKindOf(before.slide, true) === 'legato'));

/** The bend, as the tab writes it: ¼, ½, ¾, 1, 1½, 2 tones (the parser keeps semitones). */
export const bendLabel = (semitones: number | undefined): string => {
  if (!semitones || semitones <= 0) return '';
  const tones = Math.round(semitones * 2) / 4; // quarter-tone steps
  const whole = Math.floor(tones);
  const rest = tones - whole;
  const fraction = rest === 0.25 ? '¼' : rest === 0.5 ? '½' : rest === 0.75 ? '¾' : '';
  if (whole === 0) return fraction || '¼';
  return `${whole}${fraction}`;
};

/** The letter in the badge of a link: tab's own H and P, and the slashes of a slide. */
export const linkBadge = (link: TechniqueLink): string => (link.kind === 'hammer' ? 'H' : link.kind === 'pull' ? 'P' : link.up ? '/' : '\\');
