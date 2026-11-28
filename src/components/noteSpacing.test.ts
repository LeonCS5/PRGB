import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ZOOM_AUTO } from '../context/sessionSettings';
import { SONG_CATALOG } from '../content/songs';
import { EXERCISE_CATEGORIES, buildExerciseTab } from '../services/exercises';
import { loadSong } from '../services/songs';
import { getDemoSong } from '../services/demoSong';
import type { NoteEvent } from '../services/tabsApi';
import {
  DENSE_GAP_MS,
  LOOKAHEAD_MS,
  READABLE_GAP_MS,
  SHORT_NOTE_WIDTH_RATIO,
  MAX_AUTO_ZOOM,
  MIN_AUTO_ZOOM,
  MIN_NOTE_SHRINK,
  RAMP_MS,
  SPARSE_GAP_MS,
  basePixelsPerMs,
  buildScaleMap,
  formatZoomLabel,
  onsetGaps,
  readablePixelsPerMs,
  scaleForGap,
  trackPixelsPerMs,
  worstOverlap,
  type ScaleMetrics
} from './noteSpacing';
import { buildNoteGraphics, hitLineX, layoutLanes, noteHeightFor } from './practiceLanes';
import { installPath2D } from './testCanvas';

beforeAll(installPath2D);
vi.setConfig({ testTimeout: 120000 });

const note = (timeMs: number, string: number, extra: Partial<NoteEvent> = {}): NoteEvent => ({
  id: `n-${timeMs}-${string}`,
  timeMs,
  durationMs: 100,
  string,
  fret: 3,
  midiNote: 60,
  freqHz: 261.6,
  noteName: 'C4',
  ...extra
});

// One note every `gapMs` on one string
const run = (gapMs: number, count = 32, string = 2, from = 0): NoteEvent[] => Array.from({ length: count }, (_, index) => note(from + index * gapMs, string));

// A laptop (1366 px canvas, line at 360 px, notes of 60 px), a QHD screen and a phone
const LAPTOP: ScaleMetrics = { noteWidthPx: 60, pixelsPerMs: basePixelsPerMs(1366, 360) };
const QHD: ScaleMetrics = { noteWidthPx: 72, pixelsPerMs: basePixelsPerMs(2560, 560) };
const PHONE: ScaleMetrics = { noteWidthPx: 40, pixelsPerMs: basePixelsPerMs(390, 110) };

// What the game draws on a screen: the canvas is `width` x `height` (a share of the window), six strings, a note of
// the normal size or the size choice `size`; the metrics are what PracticeGame hands to buildScaleMap
const screenMetrics = (width: number, height: number, size = 1): ScaleMetrics => {
  const [layout] = layoutLanes(height, [6]);
  const noteWidthPx = noteHeightFor(layout, size);
  return { noteWidthPx, pixelsPerMs: trackPixelsPerMs(width, hitLineX(width), noteWidthPx) };
};
const windowMs = (width: number, metrics: ScaleMetrics): number => (width - hitLineX(width)) / metrics.pixelsPerMs;
// Phones (360 and 390 px wide, a canvas of about half the screen) and the screens the floor must leave alone
const PHONES: Array<[string, number, number]> = [['360x290', 360, 290], ['390x330', 390, 330]];
const BIG_SCREENS: Array<[string, number, number]> = [['1366x430', 1366, 430], ['1920x700', 1920, 700], ['2560x900', 2560, 900]];

// A slow ballad on one string with a fast solo on another from 12 s: 24 sixteenths 110 ms apart
const SOLO_FROM = 12_000;
const SOLO_GAP = 110;
const SOLO_END = SOLO_FROM + 24 * SOLO_GAP;
const ballad = (): NoteEvent[] => [...run(500, 60, 2), ...run(SOLO_GAP, 24, 3, SOLO_FROM)];

const samples = (from: number, to: number, step: number): number[] => {
  const times: number[] = [];
  for (let time = from; time <= to; time += step) times.push(time);
  return times;
};

// The steepest the scale may change: from one end of its range to the other in RAMP_MS
const MAX_SLOPE = (MAX_AUTO_ZOOM - MIN_AUTO_ZOOM) / RAMP_MS;

// How much of a circle may be under its neighbour in the busiest stretch of a piece, before the track is "too tight":
// what is measured on the bundled catalog (0 on a laptop and on a QHD screen) plus a margin
const MAX_CATALOG_OVERLAP = 0.1;

describe('basePixelsPerMs', () => {
  it('shows the same window of music on every screen', () => {
    for (const [width, lineX] of [[1366, 360], [2560, 360], [1280, 358], [390, 120]]) {
      expect((width - lineX) / basePixelsPerMs(width, lineX)).toBeCloseTo(LOOKAHEAD_MS, 5);
    }
  });

  it('survives a canvas that is not laid out yet', () => {
    expect(basePixelsPerMs(0, 0)).toBeGreaterThan(0);
    expect(basePixelsPerMs(100, 300)).toBeGreaterThan(0);
  });
});

describe('trackPixelsPerMs: a floor so that a note has its place on a narrow screen', () => {
  it('asks no more than the window of music where the screen is wide: a laptop, Full HD and QHD are drawn exactly as before', () => {
    for (const [label, width, height] of BIG_SCREENS) {
      for (const size of [0.8, 1]) {
        const metrics = screenMetrics(width, height, size);
        expect(metrics.pixelsPerMs, `${label} x${size}`).toBe(basePixelsPerMs(width, hitLineX(width)));
        expect(windowMs(width, metrics), `${label} x${size}`).toBeCloseTo(LOOKAHEAD_MS, 5);
      }
    }
    // Even the Large size (150%) leaves a laptop and a QHD screen alone
    for (const [, width, height] of [BIG_SCREENS[0], BIG_SCREENS[2]]) {
      expect(screenMetrics(width, height, 1.5).pixelsPerMs).toBe(basePixelsPerMs(width, hitLineX(width)));
    }
  });

  it('shows a shorter window of music on a phone, instead of notes on top of each other', () => {
    for (const [label, width, height] of PHONES) {
      const metrics = screenMetrics(width, height);
      const window = windowMs(width, metrics);
      expect(window, label).toBeLessThan(LOOKAHEAD_MS);
      expect(window, label).toBeGreaterThan(1000); // still a second or more ahead
      expect(metrics.pixelsPerMs, label).toBeGreaterThan(basePixelsPerMs(width, hitLineX(width)));
    }
  });

  it('gives a note of any size and screen the place of READABLE_GAP_MS of music', () => {
    for (const [label, width, height] of [...PHONES, ['768x480', 768, 480] as [string, number, number], ...BIG_SCREENS]) {
      for (const size of [0.8, 1, 1.25, 1.5]) {
        const metrics = screenMetrics(width, height, size);
        expect(READABLE_GAP_MS * metrics.pixelsPerMs, `${label} x${size}`).toBeGreaterThanOrEqual(SHORT_NOTE_WIDTH_RATIO * metrics.noteWidthPx - 1e-9);
      }
    }
  });

  it('asks for more as the note grows and never less than the window of music', () => {
    let last = 0;
    for (const width of [0.5, 20, 40, 60, 90]) {
      const value = trackPixelsPerMs(390, 110, width);
      expect(value).toBeGreaterThanOrEqual(last);
      expect(value).toBeGreaterThanOrEqual(basePixelsPerMs(390, 110));
      last = value;
    }
  });

  it('is the window of music when the note size is not known yet, and survives a canvas that is not laid out', () => {
    expect(readablePixelsPerMs(0)).toBe(0);
    expect(trackPixelsPerMs(1366, 360, 0)).toBe(basePixelsPerMs(1366, 360));
    expect(trackPixelsPerMs(0, 0, 0)).toBeGreaterThan(0);
  });

  it('is only a conversion to pixels: the scale along the song is the same on a phone and a laptop, so a duo online agrees', () => {
    const notes = ballad();
    const phone = buildScaleMap([notes], ZOOM_AUTO, screenMetrics(360, 290));
    const laptop = buildScaleMap([notes], ZOOM_AUTO, screenMetrics(1366, 430));
    for (const time of samples(0, SOLO_END + 2000, 250)) expect(phone.factorAt(time)).toBeCloseTo(laptop.factorAt(time), 9);
    expect(phone.regions).toEqual(laptop.regions);
  });
});

describe('scaleForGap: the scale a typical gap asks for', () => {
  it('is 1 across the dead zone, so an even piece is the plain track', () => {
    for (const gap of [DENSE_GAP_MS, 300, 500, 833, SPARSE_GAP_MS]) expect(scaleForGap(gap)).toBe(1);
  });

  it('falls as the notes come faster, down to the floor and no further', () => {
    const values = [230, 180, 130, 100, 60, 30].map(scaleForGap);
    for (let index = 1; index < values.length; index++) expect(values[index]).toBeLessThanOrEqual(values[index - 1]);
    expect(values[0]).toBeLessThan(1);
    expect(scaleForGap(10)).toBe(MIN_AUTO_ZOOM);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(MIN_AUTO_ZOOM);
  });

  it('rises as the notes come slower, up to the cap and no further', () => {
    const values = [950, 1200, 1600, 2400, 5000, 60_000].map(scaleForGap);
    for (let index = 1; index < values.length; index++) expect(values[index]).toBeGreaterThanOrEqual(values[index - 1]);
    expect(values[0]).toBeGreaterThan(1);
    expect(scaleForGap(1e9)).toBe(MAX_AUTO_ZOOM);
    expect(MAX_AUTO_ZOOM).toBe(1.5); // above that the track tires the eyes
  });

  it('is continuous where the dead zone ends, so nothing jumps', () => {
    expect(Math.abs(scaleForGap(DENSE_GAP_MS - 0.001) - 1)).toBeLessThan(0.001);
    expect(Math.abs(scaleForGap(SPARSE_GAP_MS + 0.001) - 1)).toBeLessThan(0.001);
  });

  it('is 1 for a gap that is not a number', () => {
    for (const gap of [0, -5, NaN]) expect(scaleForGap(gap)).toBe(1);
  });
});

describe('onsetGaps', () => {
  it('is empty with fewer than two attacks', () => {
    expect(onsetGaps([[]])).toEqual([]);
    expect(onsetGaps([[note(0, 1)]])).toEqual([]);
  });

  it('counts a chord as one attack', () => {
    expect(onsetGaps([[note(0, 1), note(0, 2), note(0, 3), note(400, 1), note(400, 2)]])).toEqual([{ startMs: 0, gapMs: 400 }]);
  });

  it('counts every string: the busyness of the song is how often a note comes, whichever string', () => {
    expect(onsetGaps([[note(0, 1), note(125, 2), note(250, 1)]]).map((gap) => gap.gapMs)).toEqual([125, 125]);
  });

  it('leaves out grace notes, tie continuations and flams, which are not a rhythm', () => {
    const gaps = onsetGaps([[note(0, 1), note(10, 1, { grace: true }), note(20, 1, { tie: true }), note(300, 1), note(310, 2)]]);
    expect(gaps.map((gap) => gap.gapMs)).toEqual([300]);
  });

  it('pools every lane', () => {
    expect(onsetGaps([run(400, 3), run(400, 3, 1, 200)]).map((gap) => gap.gapMs)).toEqual([200, 200, 200, 200, 200]);
  });
});

describe('a song with an even, medium pace', () => {
  const even = run(500, 40);

  it('has a constant scale: the track position is the base scale times the time', () => {
    const map = buildScaleMap([even], ZOOM_AUTO, LAPTOP);
    expect(map.regions).toEqual([]);
    for (const time of [-5000, -1, 0, 1, 777, 12_345, 99_999]) {
      expect(map.xOf(time)).toBeCloseTo(LAPTOP.pixelsPerMs * time, 6);
      expect(map.factorAt(time)).toBe(1);
    }
    expect(even.every((each) => map.shrinkOf(each) === 1)).toBe(true);
  });

  it('is exactly what a fixed zoom of 1 draws', () => {
    const auto = buildScaleMap([even], ZOOM_AUTO, LAPTOP);
    const fixed = buildScaleMap([even], 1, LAPTOP);
    for (const time of samples(-5000, 30_000, 250)) expect(auto.xOf(time)).toBeCloseTo(fixed.xOf(time), 6);
  });

  it('has nothing to fit with a handful of notes', () => {
    const map = buildScaleMap([[note(0, 1), note(100, 2), note(200, 3)]], ZOOM_AUTO, LAPTOP);
    expect(map.regions).toEqual([]);
    expect(map.xOf(1000)).toBeCloseTo(LAPTOP.pixelsPerMs * 1000, 6);
  });
});

describe('a slow song', () => {
  it('spreads the notes, up to the cap and never past it', () => {
    const map = buildScaleMap([run(2400, 24)], ZOOM_AUTO, LAPTOP);
    for (const time of samples(8000, 40_000, 250)) {
      expect(map.factorAt(time)).toBeLessThanOrEqual(MAX_AUTO_ZOOM);
      expect(map.factorAt(time)).toBeCloseTo(MAX_AUTO_ZOOM, 6);
    }
    expect(map.regions.length).toBe(1);
    expect(map.regions[0].factor).toBeCloseTo(MAX_AUTO_ZOOM, 6);
  });

  it('spreads less where it is only a little slow', () => {
    const map = buildScaleMap([run(1300, 30)], ZOOM_AUTO, LAPTOP);
    const middle = map.factorAt(20_000);
    expect(middle).toBeGreaterThan(1.1);
    expect(middle).toBeLessThan(MAX_AUTO_ZOOM);
    expect(middle).toBeCloseTo(scaleForGap(1300), 6);
  });
});

describe('a busy song', () => {
  const busy = run(110, 80);

  it('brings the notes closer, down to the floor and no further, and shrinks them', () => {
    const map = buildScaleMap([busy], ZOOM_AUTO, LAPTOP);
    for (const time of samples(2000, 7000, 100)) {
      expect(map.factorAt(time)).toBeGreaterThanOrEqual(MIN_AUTO_ZOOM);
      expect(map.factorAt(time)).toBeLessThan(0.8);
    }
    for (const each of busy) {
      expect(map.shrinkOf(each)).toBeGreaterThanOrEqual(MIN_NOTE_SHRINK);
      expect(map.shrinkOf(each)).toBeLessThan(1);
    }
  });

  it('scrolls slower in px per second than the plain track would', () => {
    const map = buildScaleMap([busy], ZOOM_AUTO, LAPTOP);
    const plain = buildScaleMap([busy], 1, LAPTOP);
    const speed = (target: ReturnType<typeof buildScaleMap>) => target.xOf(6000) - target.xOf(5000);
    expect(speed(map)).toBeLessThan(speed(plain) * 0.8);
  });

  it('lets a little overlap through instead of widening the track: the scale is never raised for it', () => {
    const map = buildScaleMap([busy], ZOOM_AUTO, LAPTOP);
    const overlap = worstOverlap(busy, map, LAPTOP);
    expect(overlap).toBeGreaterThan(0); // 110 ms apart at the floor: the circles do come under one another
    expect(overlap).toBeLessThan(0.5); // ...but by less than half a circle
    expect(Math.max(...samples(0, 9000, 50).map((time) => map.factorAt(time)))).toBeLessThanOrEqual(1);
  });
});

describe('a slow ballad with one fast solo', () => {
  const notes = ballad();
  const map = buildScaleMap([notes], ZOOM_AUTO, LAPTOP);

  it('is 1 well before and well after the solo, and lower inside it', () => {
    expect(map.factorAt(2000)).toBe(1);
    expect(map.factorAt(SOLO_FROM - RAMP_MS - 2500)).toBe(1);
    expect(map.factorAt(SOLO_FROM + 1500)).toBeLessThan(0.8);
    expect(map.factorAt(SOLO_FROM + 1500)).toBeGreaterThanOrEqual(MIN_AUTO_ZOOM);
    expect(map.factorAt(SOLO_END + RAMP_MS + 2500)).toBe(1);
  });

  it('falls before the solo reaches the line and rises after it, without a step', () => {
    const before = samples(SOLO_FROM - 4000, SOLO_FROM + 1500, 50).map((time) => map.factorAt(time));
    // It starts to fall ahead of the solo ...
    expect(map.factorAt(SOLO_FROM - 600)).toBeLessThan(1);
    // ... and never changes faster than the ramp allows
    for (let index = 1; index < before.length; index++) expect(Math.abs(before[index] - before[index - 1])).toBeLessThanOrEqual(MAX_SLOPE * 50 + 1e-9);
    const after = samples(SOLO_END - 500, SOLO_END + 5000, 50).map((time) => map.factorAt(time));
    for (let index = 1; index < after.length; index++) expect(Math.abs(after[index] - after[index - 1])).toBeLessThanOrEqual(MAX_SLOPE * 50 + 1e-9);
    expect(after[after.length - 1]).toBe(1);
  });

  it('has a section for the solo and none for the ballad', () => {
    expect(map.regions.length).toBe(1);
    expect(map.regions[0].factor).toBeLessThan(0.8);
    expect(map.regions[0].startMs).toBeGreaterThan(SOLO_FROM - 3 * RAMP_MS);
    expect(map.regions[0].endMs).toBeLessThan(SOLO_END + 3 * RAMP_MS);
  });

  it('keeps the ballad notes at full size and shrinks only the solo', () => {
    expect(notes.slice(0, 60).every((each) => map.shrinkOf(each) === 1)).toBe(true);
    expect(notes.slice(60).some((each) => map.shrinkOf(each) < 1)).toBe(true);
  });
});

describe('the scale is a clean curve', () => {
  const notes = [...run(1600, 8), ...ballad().map((each) => note(each.timeMs + 14_000, each.string)), ...run(2400, 10, 4, 40_000)];

  it('has a track position that always moves forward and whose speed stays inside the range of the scale', () => {
    const map = buildScaleMap([notes], ZOOM_AUTO, LAPTOP);
    let last = map.xOf(-3000);
    for (const time of samples(-2950, 60_000, 50)) {
      const x = map.xOf(time);
      const speed = (x - last) / 50 / LAPTOP.pixelsPerMs; // the scale, as the track moves
      expect(speed).toBeGreaterThan(MIN_AUTO_ZOOM - 1e-6);
      expect(speed).toBeLessThan(MAX_AUTO_ZOOM + 1e-6);
      last = x;
    }
  });

  it('depends on the song alone: two screens ask for the same scale, so a duo online agrees', () => {
    const laptop = buildScaleMap([notes], ZOOM_AUTO, LAPTOP);
    const qhd = buildScaleMap([notes], ZOOM_AUTO, QHD);
    for (const time of samples(0, 60_000, 250)) expect(laptop.factorAt(time)).toBeCloseTo(qhd.factorAt(time), 9);
  });

  it('never touches the notes or their times: the clock, the judging and the ranking run in real time', () => {
    const before = JSON.stringify(notes);
    buildScaleMap([notes], ZOOM_AUTO, LAPTOP);
    buildScaleMap([notes], 1.25, LAPTOP);
    expect(JSON.stringify(notes)).toBe(before);
  });

  it('keeps the lead-in linear: before the first knot the scale is the one at the start', () => {
    const map = buildScaleMap([busyThenSlow()], ZOOM_AUTO, LAPTOP);
    expect(map.xOf(-4000)).toBeCloseTo(map.xOf(0) - 4000 * map.factorAt(0) * LAPTOP.pixelsPerMs, 6);
  });
});

function busyThenSlow(): NoteEvent[] {
  return [...run(110, 40), ...run(2400, 8, 2, 8000)];
}

describe('a fixed zoom', () => {
  it('is that scale all through, and only the notes that still do not fit shrink', () => {
    const notes = run(110, 40);
    const map = buildScaleMap([notes], 1.25, LAPTOP);
    expect(map.auto).toBe(false);
    expect(map.regions).toEqual([]);
    for (const time of [0, 777, 5000]) {
      expect(map.factorAt(time)).toBe(1.25);
      expect(map.xOf(time)).toBeCloseTo(1.25 * LAPTOP.pixelsPerMs * time, 6);
    }
    expect(notes.some((each) => map.shrinkOf(each) < 1)).toBe(true);
  });
});

describe('notes joined by a technique', () => {
  // Eighths a little faster than the dead zone: they shrink, and a link needs no air between its notes
  const chain = [5, 7, 8, 7, 5, 7, 8].map((fret, index) => note(index * 200, 3, { fret, durationMs: 200, hammerOnOrPullOff: index > 0 }));

  it('may touch: a hammer-on is one piece, so it shrinks less and does not count as overlap', () => {
    const touching = buildScaleMap([chain], ZOOM_AUTO, LAPTOP, true);
    const apart = buildScaleMap([chain], ZOOM_AUTO, LAPTOP, false);
    expect(chain.some((each) => touching.shrinkOf(each) > apart.shrinkOf(each))).toBe(true);
    expect(chain.every((each) => touching.shrinkOf(each) >= apart.shrinkOf(each))).toBe(true);
    expect(worstOverlap(chain, touching, LAPTOP, true)).toBe(0); // joined on purpose: nothing counts
  });

  it('leaves room for the wedge of a slide out beside its note', () => {
    const plain = [note(0, 2), note(400, 2)];
    const wedge = [note(0, 2, { slide: 'out' }), note(400, 2)];
    const withPlain = buildScaleMap([plain], 1, LAPTOP);
    const withWedge = buildScaleMap([wedge], 1, LAPTOP);
    expect(withWedge.shrinkOf(wedge[0])).toBeLessThan(withPlain.shrinkOf(plain[0]) + 1e-9);
  });
});

describe('formatZoomLabel', () => {
  it('says Auto in the dead zone and the scale where the song asks for another', () => {
    expect(formatZoomLabel(ZOOM_AUTO, 1)).toBe('Auto');
    expect(formatZoomLabel(ZOOM_AUTO, 1.02)).toBe('Auto');
    expect(formatZoomLabel(ZOOM_AUTO, 0.8)).toBe('Auto ×0,8');
    expect(formatZoomLabel(ZOOM_AUTO, 1.3)).toBe('Auto ×1,3');
    expect(formatZoomLabel(ZOOM_AUTO, 1.5)).toBe('Auto ×1,5');
  });

  it('shows a fixed zoom as it is', () => {
    expect(formatZoomLabel(1.25, 1)).toBe('1,25×');
  });
});

describe('with the notes drawn', () => {
  it('takes the shrink of each note from the map', () => {
    const notes = [...run(110, 6), note(9000, 2)];
    const map = buildScaleMap([notes], 1, LAPTOP);
    const graphics = buildNoteGraphics(notes, 60, 'classic', map.noteScale);
    expect(graphics[2].height).toBeLessThan(60);
    expect(graphics[2].height).toBeCloseTo(60 * map.shrinkOf(notes[2]), 5);
    expect(graphics[6].height).toBe(60); // a note with room all around keeps its size
  });

  it('draws a tail as long as the stretch of the track the note covers', () => {
    const long = [note(0, 2, { durationMs: 2000 })];
    const wide = buildScaleMap([long], 1.5, LAPTOP);
    const narrow = buildScaleMap([long], 1, LAPTOP);
    const [wideGraphic] = buildNoteGraphics(long, 46, 'classic', wide.noteScale);
    const [narrowGraphic] = buildNoteGraphics(long, 46, 'classic', narrow.noteScale);
    expect(wideGraphic.note).toBe(long[0]);
    expect(wide.noteScale.spanPx(0, 2000)).toBeCloseTo(1.5 * narrow.noteScale.spanPx(0, 2000), 6);
    expect(narrowGraphic.height).toBe(46);
  });
});

describe('the bundled catalog', () => {
  const tabs: Array<{ name: string; notes: NoteEvent[]; duration: number }> = [];

  beforeAll(async () => {
    const demo = getDemoSong();
    tabs.push({ name: 'demo', notes: demo.notes, duration: demo.totalDurationMs });
    for (const entry of SONG_CATALOG) {
      const song = (await loadSong(entry.info.code))!;
      for (const part of entry.info.parts) {
        const tab = song.buildTab(part.code);
        tabs.push({ name: `${entry.info.title} / ${part.name}`, notes: tab.notes, duration: tab.totalDurationMs });
      }
    }
    for (const category of EXERCISE_CATEGORIES) {
      for (const group of category.groups) {
        for (const item of group.exercises) {
          const patterns = category.patterns.length > 0 ? category.patterns : [undefined];
          const keys = item.keyed ? Array.from({ length: 12 }, (_, key) => key) : [0];
          for (const pattern of patterns) {
            for (const key of keys) {
              const tab = buildExerciseTab(item, key, pattern);
              tabs.push({ name: `${item.title} [${key}, ${pattern ?? '-'}]`, notes: tab.notes, duration: tab.totalDurationMs });
            }
          }
        }
      }
    }
  });

  it('never leaves the range of the scale, nor shrinks a note past the floor, on a laptop, a QHD screen or a phone', () => {
    expect(tabs.length).toBeGreaterThan(3000);
    for (const metrics of [LAPTOP, QHD, PHONE]) {
      for (const { name, notes, duration } of tabs) {
        const map = buildScaleMap([notes], ZOOM_AUTO, metrics);
        for (const time of samples(0, duration, 250)) {
          expect(map.factorAt(time), name).toBeLessThanOrEqual(MAX_AUTO_ZOOM + 1e-9);
          expect(map.factorAt(time), name).toBeGreaterThanOrEqual(MIN_AUTO_ZOOM - 1e-9);
        }
        for (const each of notes) expect(map.shrinkOf(each), name).toBeGreaterThanOrEqual(MIN_NOTE_SHRINK);
      }
    }
  });

  it('keeps the even, slow pieces at scale 1 all through, with every note at full size', () => {
    const slow = ['Ode à Alegria / Melodia', 'Greensleeves / Melodia', 'Minueto em Sol / Melodia', 'demo'];
    for (const metrics of [LAPTOP, QHD]) {
      for (const name of slow) {
        const tab = tabs.find((entry) => entry.name === name);
        expect(tab, name).toBeDefined();
        const map = buildScaleMap([tab!.notes], ZOOM_AUTO, metrics);
        expect(map.regions, name).toEqual([]);
        expect(map.xOf(5000), name).toBeCloseTo(metrics.pixelsPerMs * 5000, 6);
        expect(tab!.notes.every((each) => map.shrinkOf(each) === 1), name).toBe(true);
      }
    }
  });

  it('keeps every circle clear of its neighbour on a laptop or a QHD screen (the worst overlap of the whole catalog stays tiny)', () => {
    for (const metrics of [LAPTOP, QHD]) {
      const tight = tabs
        .map(({ name, notes }) => ({ name, overlap: worstOverlap(notes, buildScaleMap([notes], ZOOM_AUTO, metrics), metrics) }))
        .filter(({ overlap }) => overlap > MAX_CATALOG_OVERLAP);
      expect(tight).toEqual([]);
    }
  });

  it('keeps every circle clear of its neighbour on a phone too, now that the floor gives a note its place', () => {
    for (const [label, width, height] of PHONES) {
      const metrics = screenMetrics(width, height);
      const tight = tabs
        .map(({ name, notes }) => ({ name, overlap: worstOverlap(notes, buildScaleMap([notes], ZOOM_AUTO, metrics), metrics) }))
        .filter(({ overlap }) => overlap > MAX_CATALOG_OVERLAP);
      expect(tight, label).toEqual([]);
    }
  });

  it('keeps the welcome exercise and the slow pieces clear on a phone, also with the zoom fixed at 0.75', () => {
    const names = ['demo', 'Ode à Alegria / Melodia', 'Greensleeves / Melodia', 'Minueto em Sol / Melodia'];
    for (const [label, width, height] of PHONES) {
      const metrics = screenMetrics(width, height);
      for (const name of names) {
        const tab = tabs.find((entry) => entry.name === name);
        expect(tab, name).toBeDefined();
        for (const zoom of [ZOOM_AUTO, 1, 0.75]) {
          const map = buildScaleMap([tab!.notes], zoom, metrics);
          expect(worstOverlap(tab!.notes, map, metrics), `${label} ${name} zoom ${zoom}`).toBeLessThanOrEqual(MAX_CATALOG_OVERLAP);
        }
      }
    }
  });

  it('has a section in very few pieces', () => {
    const withSections = tabs.filter(({ notes }) => buildScaleMap([notes], ZOOM_AUTO, LAPTOP).regions.length > 0);
    expect(withSections.length / tabs.length).toBeLessThan(0.15);
  });
});
