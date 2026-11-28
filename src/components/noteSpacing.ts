// How far apart the notes are drawn along the track.
//
// Two parts, kept apart on purpose:
//  - what does not depend on the screen: a scale factor over the song's time. It follows how busy the song is: where
//    the notes come fast the scale FALLS (the track scrolls slower in px/s and more notes are in view at once, so a run
//    can be followed), where they come slowly it RISES (never past MAX_AUTO_ZOOM: a faster track tires the eyes). In
//    between is a dead zone where it stays 1, so an even piece is spread exactly as the plain 1x track;
//  - what does: the conversion to pixels, from the base scale (a fixed window of music across the track, so the
//    scroll feels the same on a laptop and on a QHD screen) and from the size of a note. Where the notes come closer
//    than their size, they shrink (down to MIN_NOTE_SHRINK) and are allowed to overlap a little: the scale is never
//    raised to avoid it.
//
// The track position of a song time t is S(t), the integral of the scale up to t. Everything drawn along the track
// (notes, beat lines, tails, the guide shadow, the empty lane before the first note) is at lineX + S(t) - S(position),
// so the time axis stays linear locally and no two things of the same time ever disagree. The clock, the judging,
// the synth, the metronome and the ranking never see any of this: they run in real time.

import type { NoteEvent } from '../services/tabsApi';
import { ZOOM_AUTO } from '../context/sessionSettings';
import type { NoteScale } from './practiceLanes';
import { follows, isLinkedPair, slideKindOf } from './techniques';

/** Milliseconds of music across the track (from the hit line to the right edge) at scale 1. */
export const LOOKAHEAD_MS = 4000;
const MIN_PIXELS_PER_MS = 0.02; // a canvas that is not laid out yet must not divide by zero

/**
 * The base scale, in px per ms of music: the window of music is the same on every screen.
 * Only the distance between the two ends counts: `endX - startX` pixels hold LOOKAHEAD_MS. In the game the music
 * comes from the right edge to the hit line, so it is `basePixelsPerMs(width, lineX)`. Free Play shows the notes just
 * played running off to the left of its "now" line, so it is `basePixelsPerMs(lineX, 0)`: from the left edge to the line.
 */
export const basePixelsPerMs = (endX: number, startX: number): number => Math.max(MIN_PIXELS_PER_MS, (endX - startX) / LOOKAHEAD_MS);

/** A short note is a circle about this many diameters wide (two-digit frets are a little wider than one-digit). */
export const SHORT_NOTE_WIDTH_RATIO = 1.05;

/**
 * The gap between two notes that must still be readable on any screen: eighths at ~120 BPM. A note and its air take
 * the track distance of this much music at least, so a narrow screen shows a shorter window of music instead of
 * circles on top of each other. A laptop or a QHD screen already gives more than that: the floor never acts there.
 */
export const READABLE_GAP_MS = 250;

/** The least scale, in px per ms of music, at which a note of this size still has its own place after a gap of READABLE_GAP_MS. */
export const readablePixelsPerMs = (noteWidthPx: number): number => (noteWidthPx > 0 ? (SHORT_NOTE_WIDTH_RATIO * noteWidthPx) / READABLE_GAP_MS : 0);

/**
 * The scale the track is drawn at: the window of music across the track, but never less than a note needs to be read.
 * It only converts to pixels, so it depends on the screen and on the note size, never on the song: the scale factor
 * along the song (buildScaleMap) is the same on every screen and in both seats of a duo online.
 */
export const trackPixelsPerMs = (endX: number, startX: number, noteWidthPx: number): number =>
  Math.max(basePixelsPerMs(endX, startX), readablePixelsPerMs(noteWidthPx));
/** Air kept between two neighbouring notes on a string, in diameters (none between the two notes of a hammer-on or a slide: they touch on purpose). */
export const MIN_NOTE_GAP_RATIO = 0.1;
/** The wedge of a slide in or out, beside its note, in diameters. */
export const SLIDE_WEDGE_RATIO = 1.1;
/** Short notes never shrink below this share of their size: the fret number has to stay readable (buildNoteGraphics keeps a floor in rem as well). */
export const MIN_NOTE_SHRINK = 0.5;
/** Cap of the automatic scale where the song is slow: a track that scrolls faster than this is what makes the eyes tired. */
export const MAX_AUTO_ZOOM = 1.5;
/** Floor of the automatic scale where the song is busy: what does not fit by then shrinks and overlaps a little. */
export const MIN_AUTO_ZOOM = 0.7;
/** Gaps shorter than this are flams and ornaments, not a rhythm someone plays note by note. */
export const MIN_RHYTHM_GAP_MS = 25;

/**
 * How busy a stretch is: a low percentile of the gaps between the attacks around it. Between DENSE_GAP_MS and
 * SPARSE_GAP_MS the scale is 1 (eighths up to ~125 BPM and quarters down to ~67 BPM); faster than that it falls, slower
 * it rises, with DENSITY_GAMMA < 1 so it eases in instead of jumping.
 */
export const DENSE_GAP_MS = 240;
export const SPARSE_GAP_MS = 900;
export const DENSITY_GAMMA = 0.6;
/** The stretch around a moment that is looked at, the share of its gaps that counts (a low one, so a run is not averaged away) and the least gaps it takes. */
export const DENSITY_WINDOW_MS = 2000;
export const DENSITY_PERCENTILE = 0.25;
export const MIN_GAPS_IN_WINDOW = 3;
/** Where the notes are few and far apart the window opens up, to this far on each side of a moment, to find that many gaps. */
export const DENSITY_MAX_REACH_MS = 4000;
/** The scale takes this much music to go from the highest to the lowest value, and it starts before a busy stretch reaches the line. */
export const RAMP_MS = 1500;
const GRID_MS = 100; // the scale is a polyline through knots this far apart
const FACTOR_EPSILON = 0.02; // below this a stretch is not worth a section

export interface ScaleMetrics {
  /** Diameter of a note, in px. */
  noteWidthPx: number;
  /** The base scale, in px per ms of music (basePixelsPerMs of the canvas). */
  pixelsPerMs: number;
}

export interface ScaleRegion {
  startMs: number;
  endMs: number;
  /** The scale furthest from 1 inside the stretch. */
  factor: number;
}

export interface ScaleMap {
  /** Whether the scale follows the song (Auto) or is one number all through. */
  readonly auto: boolean;
  readonly pixelsPerMs: number;
  /** Track position, in px, of a song time. Distances along the track are differences of it. Never allocates. */
  xOf: (timeMs: number) => number;
  /** The scale at a song time: 1 in the dead zone, under 1 where the song is busy, over 1 where it is slow. */
  factorAt: (timeMs: number) => number;
  /** How much of its size a short note keeps (1 = untouched). */
  shrinkOf: (note: NoteEvent) => number;
  /** What buildNoteGraphics needs to draw the notes and their tails. */
  noteScale: NoteScale;
  /** The stretches where the scale is not 1 (empty when it is constant). */
  regions: readonly ScaleRegion[];
}

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/** The scale a typical gap asks for: 1 in the dead zone, eased down below it and up above it. */
export const scaleForGap = (gapMs: number): number => {
  if (!(gapMs > 0)) return 1;
  if (gapMs < DENSE_GAP_MS) return clamp(Math.pow(gapMs / DENSE_GAP_MS, DENSITY_GAMMA), MIN_AUTO_ZOOM, 1);
  if (gapMs > SPARSE_GAP_MS) return clamp(Math.pow(gapMs / SPARSE_GAP_MS, DENSITY_GAMMA), 1, MAX_AUTO_ZOOM);
  return 1;
};

interface Gap {
  startMs: number;
  gapMs: number;
}

/** Gaps between one attack and the next, from every lane at once (a chord is one attack; a duo scrolls together). */
export const onsetGaps = (lanes: readonly (readonly NoteEvent[])[]): Gap[] => {
  const times: number[] = [];
  for (const notes of lanes) for (const note of notes) if (!note.grace && !note.tie) times.push(note.timeMs);
  times.sort((a, b) => a - b);
  const gaps: Gap[] = [];
  let last = -Infinity;
  for (const time of times) {
    if (time - last < MIN_RHYTHM_GAP_MS) continue; // the same attack (a chord) or a flam
    if (last > -Infinity) gaps.push({ startMs: last, gapMs: time - last });
    last = time;
  }
  return gaps;
};

/** The low percentile of a list of gaps (it sorts the list). */
const percentileOf = (values: number[], share: number): number => {
  values.sort((a, b) => a - b);
  return values[Math.min(values.length - 1, Math.floor(values.length * share))];
};

/**
 * The scale of every moment, from the song's own gaps. Raw it is a step per stretch; the two passes at the end make it
 * a lower envelope with a limited slope: it reaches the low value exactly where a busy stretch begins (it starts
 * falling RAMP_MS before) and rises back as slowly, and a slow stretch rises from the dead zone the same way, so the
 * scroll speed in px/s never has a step.
 */
export const scaleCurve = (lanes: readonly (readonly NoteEvent[])[]): { times: Float64Array; factors: Float64Array } | null => {
  const gaps = onsetGaps(lanes);
  if (gaps.length < MIN_GAPS_IN_WINDOW) return null;
  const endMs = gaps[gaps.length - 1].startMs + gaps[gaps.length - 1].gapMs;
  const count = Math.ceil(endMs / GRID_MS) + 2;
  const raw = new Float64Array(count).fill(NaN);
  let first = 0;
  let last = 0;
  for (let index = 0; index < count; index++) {
    const time = index * GRID_MS;
    while (first < gaps.length && gaps[first].startMs < time - DENSITY_WINDOW_MS / 2) first++;
    while (last < gaps.length && gaps[last].startMs <= time + DENSITY_WINDOW_MS / 2) last++;
    // A slow stretch has few gaps in a window of this size: it opens up, one gap at a time (the nearer side first)
    let low = first;
    let high = last;
    while (high - low < MIN_GAPS_IN_WINDOW) {
      const behind = low > 0 ? time - gaps[low - 1].startMs : Infinity;
      const ahead = high < gaps.length ? gaps[high].startMs - time : Infinity;
      if (Math.min(behind, ahead) > DENSITY_MAX_REACH_MS) break;
      if (behind <= ahead) low--;
      else high++;
    }
    if (high - low < MIN_GAPS_IN_WINDOW) continue;
    raw[index] = scaleForGap(percentileOf(gaps.slice(low, high).map((gap) => gap.gapMs), DENSITY_PERCENTILE));
  }
  // A moment with too few gaps around it (a rest, a long note) keeps the scale of the nearest moment that has them
  let carried = NaN;
  for (let index = 0; index < count; index++) {
    if (Number.isNaN(raw[index])) raw[index] = carried;
    else carried = raw[index];
  }
  carried = NaN;
  for (let index = count - 1; index >= 0; index--) {
    if (Number.isNaN(raw[index])) raw[index] = carried;
    else carried = raw[index];
  }
  const slope = ((MAX_AUTO_ZOOM - MIN_AUTO_ZOOM) / RAMP_MS) * GRID_MS; // per grid step
  for (let index = 1; index < count; index++) raw[index] = Math.min(raw[index], raw[index - 1] + slope);
  for (let index = count - 2; index >= 0; index--) raw[index] = Math.min(raw[index], raw[index + 1] + slope);
  const times = new Float64Array(count);
  for (let index = 0; index < count; index++) times[index] = index * GRID_MS;
  return { times, factors: raw };
};

/** The stretches where the curve is not 1: what a report or a test wants to see. */
const regionsOf = (times: Float64Array, factors: Float64Array): ScaleRegion[] => {
  const regions: ScaleRegion[] = [];
  let open: ScaleRegion | null = null;
  for (let index = 0; index < times.length; index++) {
    const away = Math.abs(factors[index] - 1) > FACTOR_EPSILON;
    if (away && !open) open = { startMs: times[index], endMs: times[index], factor: factors[index] };
    if (open && away) {
      open.endMs = times[index];
      if (Math.abs(factors[index] - 1) > Math.abs(open.factor - 1)) open.factor = factors[index];
    }
    if (open && !away) {
      regions.push(open);
      open = null;
    }
  }
  if (open) regions.push(open);
  return regions;
};

/**
 * What two neighbouring notes of a string need besides their circles. The two notes of a hammer-on, a pull-off or a
 * slide are one piece (`linkedTouch`): they may touch, and the badge of the link sits above the bridge, not beside a
 * note. A slide in or out has a wedge beside its note, and that is room the notes next to it cannot take.
 */
const pairNeeds = (before: NoteEvent, after: NoteEvent, linkedTouch: boolean): { extra: number; air: number } => {
  let extra = 0;
  if (slideKindOf(before.slide, follows(before, after)) === 'out') extra += SLIDE_WEDGE_RATIO;
  if (slideKindOf(after.slide, true) === 'in') extra += SLIDE_WEDGE_RATIO;
  return { extra, air: linkedTouch && isLinkedPair(before, after) ? 0 : MIN_NOTE_GAP_RATIO };
};

const attacksByString = (notes: readonly NoteEvent[]): NoteEvent[][] => {
  const byString = new Map<number, NoteEvent[]>();
  for (const note of notes) {
    if (note.grace || note.tie) continue; // not attacks of their own
    const list = byString.get(note.string);
    if (list) list.push(note);
    else byString.set(note.string, [note]);
  }
  const lists = [...byString.values()];
  for (const list of lists) list.sort((a, b) => a.timeMs - b.timeMs);
  return lists;
};

/** The share of its size a short note keeps when the next one is `gapMs` away at scale `factor` (all in ms of music at scale 1). */
const shrinkFor = ({ noteWidthPx, pixelsPerMs }: ScaleMetrics, gapMs: number, factor: number, extra: number, air: number): number => {
  const msOf = (ratio: number) => (noteWidthPx * ratio) / pixelsPerMs;
  return clamp((gapMs * factor - msOf(extra + air)) / msOf(SHORT_NOTE_WIDTH_RATIO), MIN_NOTE_SHRINK, 1);
};

const CONSTANT_REGIONS: readonly ScaleRegion[] = [];

/**
 * The scale map of a song. `zoom` is the player's choice: ZOOM_AUTO follows the song, a number is that scale all
 * through (and only the short notes that still do not fit shrink). `lanes` are the notes of every player: the scale
 * is the one the song's busiest moments ask for, so a duo scrolls together; it depends on the song alone, never on the
 * screen, so two players on different screens agree. `linkedTouch` lets the notes of a hammer-on or a slide touch.
 */
export const buildScaleMap = (lanes: readonly (readonly NoteEvent[])[], zoom: number, metrics: ScaleMetrics, linkedTouch: boolean = true): ScaleMap => {
  const auto = zoom === ZOOM_AUTO;
  const { pixelsPerMs } = metrics;
  const usable = metrics.noteWidthPx > 0 && pixelsPerMs > 0;

  let times: Float64Array = new Float64Array([0]);
  let factors: Float64Array = new Float64Array([auto ? 1 : zoom]);
  let regions: readonly ScaleRegion[] = CONSTANT_REGIONS;
  if (auto) {
    const curve = scaleCurve(lanes);
    if (curve) {
      const found = regionsOf(curve.times, curve.factors);
      if (found.length > 0) {
        ({ times, factors } = curve);
        regions = found;
      }
    }
  }
  const count = times.length;
  // Scaled time at each knot: the area under the polyline, exact because the scale is linear between knots
  const area = new Float64Array(count);
  for (let index = 1; index < count; index++) area[index] = area[index - 1] + ((factors[index - 1] + factors[index]) / 2) * (times[index] - times[index - 1]);

  // The knot at or before `time`; callers handle the ends
  const knotBefore = (time: number): number => {
    let low = 0;
    let high = count - 1;
    while (high - low > 1) {
      const mid = (low + high) >> 1;
      if (times[mid] <= time) low = mid;
      else high = mid;
    }
    return low;
  };
  const factorAt = (timeMs: number): number => {
    if (timeMs <= times[0]) return factors[0];
    if (timeMs >= times[count - 1]) return factors[count - 1];
    const k = knotBefore(timeMs);
    const along = (timeMs - times[k]) / (times[k + 1] - times[k]);
    return factors[k] + (factors[k + 1] - factors[k]) * along;
  };
  // Scaled time: before the first knot and after the last the scale is that knot's, so the lead-in is linear
  const scaledAt = (timeMs: number): number => {
    if (timeMs <= times[0]) return factors[0] * (timeMs - times[0]);
    if (timeMs >= times[count - 1]) return area[count - 1] + factors[count - 1] * (timeMs - times[count - 1]);
    const k = knotBefore(timeMs);
    const dt = timeMs - times[k];
    const slope = (factors[k + 1] - factors[k]) / (times[k + 1] - times[k]);
    return area[k] + factors[k] * dt + 0.5 * slope * dt * dt;
  };
  const xOf = (timeMs: number): number => pixelsPerMs * scaledAt(timeMs);

  // How much of its size each short note keeps: from its own neighbours on the string, at the scale of its moment
  const shrinks = new Map<NoteEvent, number>();
  if (usable) {
    for (const notes of lanes) {
      for (const list of attacksByString(notes)) {
        for (let index = 0; index < list.length; index++) {
          const factor = factorAt(list[index].timeMs);
          // Against each neighbour; the tightest one decides how much of its size the note keeps
          let shrink = 1;
          for (const neighbour of [index - 1, index + 1]) {
            if (neighbour < 0 || neighbour >= list.length) continue;
            const [earlier, later] = neighbour < index ? [list[neighbour], list[index]] : [list[index], list[neighbour]];
            const gap = later.timeMs - earlier.timeMs;
            if (gap < MIN_RHYTHM_GAP_MS) continue;
            const { extra, air } = pairNeeds(earlier, later, linkedTouch);
            shrink = Math.min(shrink, shrinkFor(metrics, gap, factor, extra, air));
          }
          if (shrink < 0.999) shrinks.set(list[index], shrink);
        }
      }
    }
  }
  const shrinkOf = (note: NoteEvent): number => shrinks.get(note) ?? 1;

  return {
    auto,
    pixelsPerMs,
    xOf,
    factorAt,
    shrinkOf,
    noteScale: { spanPx: (timeMs, durationMs) => xOf(timeMs + durationMs) - xOf(timeMs), shrink: shrinkOf },
    regions
  };
};

/**
 * How much of its diameter a short note covers of the next one on its string, in the worst case of a lane (0 = they do
 * not touch, 0.3 = a third of a circle is under the neighbour). What a report and the tests measure; the game never
 * raises the scale to avoid it.
 */
export const worstOverlap = (lane: readonly NoteEvent[], map: ScaleMap, metrics: ScaleMetrics, linkedTouch: boolean = true): number => {
  let worst = 0;
  for (const list of attacksByString(lane)) {
    for (let index = 1; index < list.length; index++) {
      const before = list[index - 1];
      const after = list[index];
      if (linkedTouch && isLinkedPair(before, after)) continue; // joined on purpose
      const gapPx = map.xOf(after.timeMs) - map.xOf(before.timeMs);
      const width = (note: NoteEvent) => metrics.noteWidthPx * SHORT_NOTE_WIDTH_RATIO * map.shrinkOf(note);
      const halves = (width(before) + width(after)) / 2;
      const diameter = Math.min(width(before), width(after)) / SHORT_NOTE_WIDTH_RATIO;
      if (diameter > 0) worst = Math.max(worst, (halves - gapPx) / diameter);
    }
  }
  return Math.max(0, worst);
};

/** Auto shows what the stretch under the line asks for, e.g. "Auto ×0,8" or "Auto ×1,3"; in the dead zone it just says "Auto". */
export const formatZoomLabel = (setting: number, factor: number): string => {
  if (setting !== ZOOM_AUTO) return setting.toLocaleString('pt-BR') + '×';
  return Math.abs(factor - 1) >= 0.05 ? `Auto ×${(Math.round(factor * 10) / 10).toLocaleString('pt-BR')}` : 'Auto';
};
