// The canvas has no fixed pixel sizes: what is not a share of the note follows the root font size, and what belongs to
// the note follows the note. These tests pin that down: at a 16 px root nothing changes, at a bigger root it all scales.

import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_STRINGS } from '../appearance/defaults';
import { drawPulseRing, GameEffects } from './gameEffects';
import { buildNoteKit, drawNoteGraphic } from './noteStyles';
import {
  buildNoteGraphics,
  depthAlphaAt,
  MAX_NOTE_HEIGHT,
  depthScaleAt,
  drawLaneBackground,
  hitLineX,
  layoutLanes,
  noteScaleOf,
  playHitFeedback,
  remScale,
  type HitEffects
} from './practiceLanes';
import { createRecorder, installPath2D, ORIGINAL_PALETTE } from './testCanvas';
import type { NoteEvent } from '../services/tabsApi';

beforeAll(installPath2D);

const numbersOf = (log: string[], prefix: string): number[] =>
  log.filter((line) => line.startsWith(prefix)).map((line) => Number(line.slice(prefix.length).split(',')[0].replace(/[^\d.-]/g, '')));

describe('remScale', () => {
  it('is 1 at the default root and follows a bigger one', () => {
    expect(remScale()).toBe(1);
    expect(remScale(16)).toBe(1);
    expect(remScale(20)).toBeCloseTo(1.25, 6);
    expect(remScale(24)).toBeCloseTo(1.5, 6);
  });
});

describe('hitLineX limits are in rem', () => {
  it('keeps 7.5 rem clear of the labels on a narrow canvas and 22.5 rem as the ceiling, whatever the root', () => {
    expect(hitLineX(400)).toBe(120); // 7.5 rem at 16 px
    expect(hitLineX(400, 20)).toBe(150); // 7.5 rem at 20 px
    expect(hitLineX(4000)).toBe(360); // 22.5 rem at 16 px
    expect(hitLineX(4000, 20)).toBe(450); // 22.5 rem at 20 px
  });

  it('is the same share of the canvas in between, so a screen of any size puts it at the same place', () => {
    expect(hitLineX(1000)).toBe(280);
    expect(hitLineX(1000, 20)).toBe(280);
  });

  it('never goes past 40% of a canvas that is narrow for its root', () => {
    expect(hitLineX(500, 32)).toBe(200);
  });
});

describe('layoutLanes', () => {
  it('lets the top margin of a tall lane grow with the root', () => {
    const [small] = layoutLanes(1200, [6], 16);
    const [big] = layoutLanes(1200, [6], 20);
    expect(small.topMargin).toBe(70);
    expect(big.topMargin).toBe(87.5);
  });

  it('is the layout it always was at the default root', () => {
    expect(layoutLanes(400, [6])).toEqual(layoutLanes(400, [6], 16));
  });
});

describe('depthScaleAt and depthAlphaAt', () => {
  it('fade over the distance they are given, so the whole track reads the same on every screen', () => {
    expect(depthScaleAt(100 + 400, 100, 400)).toBeCloseTo(depthScaleAt(100 + 1000, 100, 1000), 9);
    expect(depthAlphaAt(100 + 400, 100, 400)).toBeCloseTo(depthAlphaAt(100 + 1000, 100, 1000), 9);
    expect(depthScaleAt(100, 100, 400)).toBe(1);
    expect(depthAlphaAt(100, 100, 400)).toBe(1);
  });
  it('never go past their limits, in front of the line or beyond the track', () => {
    expect(depthScaleAt(0, 100, 400)).toBe(1);
    expect(depthScaleAt(100000, 100, 400)).toBeLessThan(1);
    expect(depthAlphaAt(100000, 100, 400)).toBeGreaterThan(0.5);
  });
});

describe('drawLaneBackground at a bigger root', () => {
  const [lane] = layoutLanes(600, [6], 20);
  const draw = (root: number) => {
    const rec = createRecorder();
    drawLaneBackground(rec.ctx, lane, 1000, ORIGINAL_PALETTE, null, 300, DEFAULT_STRINGS, root);
    return rec.log;
  };

  it('is the same instructions at the default root as with the argument left out', () => {
    const left = createRecorder();
    drawLaneBackground(left.ctx, lane, 1000, ORIGINAL_PALETTE, null, 300, DEFAULT_STRINGS);
    expect(draw(16)).toEqual(left.log);
  });

  it('scales the rails, the labels and the hit line by the root', () => {
    const base = draw(16);
    const big = draw(20);
    const widths = (log: string[]) => numbersOf(log, 'lineWidth=');
    expect(widths(big).length).toBe(widths(base).length);
    widths(base).forEach((value, index) => expect(widths(big)[index]).toBeCloseTo(value * 1.25, 4));
    expect(big.some((line) => line.startsWith('font=bold 16.25px'))).toBe(true); // the string labels, 13 px at the default
    expect(big.some((line) => line.startsWith('font=bold 13px'))).toBe(false);
    expect(numbersOf(big, 'shadowBlur=')[0]).toBeCloseTo(20, 4); // the hit line glow, 16 px at the default
  });
});

describe('hit feedback follows the note', () => {
  const note = { id: 'n', timeMs: 0, durationMs: 200, string: 2, fret: 3, midiNote: 50, freqHz: 150, noteName: 'D3' } as NoteEvent;
  const feedback = (unit: number): HitEffects => {
    const effects: HitEffects = { particles: [], texts: [] };
    playHitFeedback('perfect', note, 300, 200, { hit: '#0f0', near: '#ff0', miss: '#f00' } as never, effects, false, unit);
    return effects;
  };

  it('starts the text above the note, clear of its number, at a distance that grows with the note', () => {
    const small = feedback(1).texts[0];
    const big = feedback(2).texts[0];
    const smallDiameter = MAX_NOTE_HEIGHT; // the note of unit 1
    // above the note's top edge (half a diameter above the string), with room for the text itself
    expect(200 - small.y).toBeGreaterThan(smallDiameter / 2);
    expect(200 - big.y).toBeGreaterThan(smallDiameter);
    expect(big.x - 300).toBeCloseTo(2 * (small.x - 300), 9);
    expect(200 - big.y).toBeCloseTo(2 * (200 - small.y), 9);
    expect(small.x).toBeGreaterThan(300); // a little to the right of the line, not on it
  });

  it('draws bigger and faster sparks for a bigger note', () => {
    const small = feedback(1).particles;
    const big = feedback(2).particles;
    expect(big.length).toBe(small.length);
    expect(Math.max(...big.map((p) => p.size))).toBeGreaterThan(Math.max(...small.map((p) => p.size)) * 1.3);
    expect(Math.max(...big.map((p) => Math.hypot(p.vx, p.vy)))).toBeGreaterThan(Math.max(...small.map((p) => Math.hypot(p.vx, p.vy))) * 1.3);
  });
});

describe('noteScaleOf', () => {
  it('is the size of a note over the size the effects were drawn for', () => {
    expect(noteScaleOf(46)).toBe(1);
    expect(noteScaleOf(92)).toBe(2);
    expect(noteScaleOf(0)).toBe(1);
  });
});

describe('effects of the canvas follow the note', () => {
  it('draws a pulse ring twice as big for a unit of 2', () => {
    const one = createRecorder();
    const two = createRecorder();
    drawPulseRing(one.ctx, 100, 100, 0.5, '#fff', 2, 1);
    drawPulseRing(two.ctx, 100, 100, 0.5, '#fff', 2, 2);
    const radius = (log: string[]) => Number(/^arc\(\d+,\d+,([\d.]+)/.exec(log.find((line) => line.startsWith('arc('))!)![1]);
    expect(radius(two.log)).toBeCloseTo(radius(one.log) * 2, 4);
    expect(numbersOf(two.log, 'lineWidth=')[0]).toBeCloseTo(numbersOf(one.log, 'lineWidth=')[0] * 2, 4);
  });

  it('keeps the sparks of the effects the same size at a unit of 1', () => {
    const effects = new GameEffects();
    const settings = { hitPulse: false, perfectSpark: true, comboGlow: false, noteTrail: false, reactiveBackground: false, intensity: 2 as const };
    const rec = createRecorder();
    effects.onJudgement('perfect', 100, 100, 0, settings, '#0f0', '#ff0');
    effects.drawOver(rec.ctx, 100, settings);
    const rects = rec.log.filter((line) => line.startsWith('fillRect('));
    expect(rects.length).toBeGreaterThan(0);
    const bigger = createRecorder();
    const other = new GameEffects();
    other.onJudgement('perfect', 100, 100, 0, settings, '#0f0', '#ff0', 2);
    other.drawOver(bigger.ctx, 100, settings);
    const size = (line: string) => Number(line.slice(9, -1).split(',')[2]);
    expect(size(bigger.log.find((line) => line.startsWith('fillRect('))!)).toBeCloseTo(size(rects[0]) * 2, 4);
  });
});

describe('the glow and the trail of a note follow its size', () => {
  const note = { id: 'n', timeMs: 0, durationMs: 400, string: 3, fret: 7, midiNote: 55, freqHz: 196, noteName: 'G3' } as NoteEvent;
  const blurFor = (height: number) => {
    const [graphic] = buildNoteGraphics([note], height);
    const rec = createRecorder();
    drawNoteGraphic(rec.ctx, graphic, buildNoteKit(ORIGINAL_PALETTE, 'classic', 0), 0, 0, 'perfect', height, null);
    return numbersOf(rec.log, 'shadowBlur=')[0];
  };

  it('has the blur of a 46 px note at 46 and twice that at 92', () => {
    expect(blurFor(46)).toBeCloseTo(18, 4);
    expect(blurFor(92)).toBeCloseTo(36, 4);
  });
});
