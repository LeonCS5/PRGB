import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_STRINGS } from '../appearance/defaults';
import { NOTE_STYLES, STRING_SCHEMES, type NoteStyle } from '../appearance/types';
import type { NoteEvent } from '../services/tabsApi';
import { contrastRatio, resolveGameplayPalette } from './gameplayPalette';
import { buildNoteKit, createBlockDraw, drawAloneSlide, drawNoteGraphic, drawPalmMuteBracket, drawTechniqueBlock, noteColors, paintNoteRect, traceNote, trailFor, type NoteState } from './noteStyles';
import { buildNoteGraphics, type GamePalette, type NoteGraphic } from './practiceLanes';
import { analyzeTechniques } from './techniques';
import { createRecorder, installPath2D, ORIGINAL_PALETTE, type RecordedPath2D } from './testCanvas';

beforeAll(installPath2D);

const event = (over: Partial<NoteEvent> = {}): NoteEvent => ({
  id: 'n', timeMs: 0, durationMs: 400, string: 3, fret: 7, midiNote: 55, freqHz: 196, noteName: 'G3', ...over
});

const STATES: NoteState[] = ['pending', 'perfect', 'good', 'miss', 'skipped'];
const pathLog = (path: Path2D): string[] => (path as unknown as RecordedPath2D).log;

// The drawing the game had before note styles existed, copied from PracticeGame as it was
const legacyDrawNote = (ctx: CanvasRenderingContext2D, palette: GamePalette, noteHeight: number, graphic: NoteGraphic, noteX: number, noteY: number, state: NoteState) => {
  const { note, path, fret, subtitle, fretX, subtitleX, fretFont, subtitleFont } = graphic;
  const stringColor = palette.strings[(note.string) - 1] || palette.muted;
  ctx.save();
  ctx.translate(noteX, noteY);
  if (note.grace) ctx.scale(0.75, 0.75);
  if (state === 'perfect') {
    ctx.shadowColor = palette.hit;
    ctx.shadowBlur = 18 * noteHeight / 46;
  } else if (state === 'good') {
    ctx.shadowColor = palette.near;
    ctx.shadowBlur = 12 * noteHeight / 46;
  } else if (state === 'miss') {
    ctx.globalAlpha = 0.35;
  } else if (state === 'skipped' || note.ghost) {
    ctx.globalAlpha = 0.55;
  }
  if (state === 'perfect') {
    ctx.fillStyle = palette.hit;
  } else if (state === 'good') {
    ctx.fillStyle = palette.near;
  } else if (state === 'miss') {
    ctx.fillStyle = palette.muted;
  } else {
    ctx.fillStyle = stringColor;
  }
  ctx.fill(path);
  ctx.lineWidth = 2.5 * noteHeight / 46;
  ctx.strokeStyle = state === 'perfect' ? palette.hit : palette.ink;
  ctx.stroke(path);
  ctx.fillStyle = palette.ink;
  ctx.font = fretFont;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(fret, fretX, 0);
  ctx.fillStyle = palette.ink;
  ctx.font = subtitleFont;
  ctx.textAlign = 'left';
  ctx.fillText(subtitle, subtitleX, 0);
  ctx.restore();
};

describe('classic note style', () => {
  it('records the same instructions as the drawing the game had before, for every state and kind of note', () => {
    const notes = [event(), event({ id: 'g', grace: true, string: 1 }), event({ id: 'h', ghost: true, string: 6 }), event({ id: 'x', dead: true, string: 9 }), event({ id: 'b', bendSemitones: 2 })];
    const graphics = buildNoteGraphics(notes, 40);
    const kit = buildNoteKit(ORIGINAL_PALETTE, 'classic', 0);
    for (const graphic of graphics) {
      for (const state of STATES) {
        const before = createRecorder();
        legacyDrawNote(before.ctx, ORIGINAL_PALETTE, 40, graphic, 200, 80, state);
        const after = createRecorder();
        drawNoteGraphic(after.ctx, graphic, kit, 200, 80, state, 40, null);
        expect(after.log).toEqual(before.log);
        expect(after.log.length).toBeGreaterThan(10);
      }
    }
  });

  it('builds the pill path the game always had (radius = half the height, no detail)', () => {
    const [graphic] = buildNoteGraphics([event()], 46);
    expect(pathLog(graphic.path)).toHaveLength(1);
    expect(pathLog(graphic.path)[0]).toMatch(/^roundRect\(-?[\d.]+,-23,[\d.]+,46,23\)$/);
    expect(graphic.detail).toBeNull();
  });

  it('draws the rectangle of Play Free as before', () => {
    const kit = buildNoteKit(ORIGINAL_PALETTE, 'classic', 0);
    const { ctx, log } = createRecorder();
    const text = paintNoteRect(ctx, kit, 4, 10, 20, 90, 40);
    expect(text).toBe(ORIGINAL_PALETTE.ink);
    expect(log).toEqual([`fillStyle=${ORIGINAL_PALETTE.strings[3]}`, 'beginPath()', 'roundRect(10,20,90,40,20)', 'fill()']);
  });
});

describe('note styles', () => {
  it('give each style its own shape', () => {
    const radius = (style: NoteStyle) => {
      const radii: number[] = [];
      let lines = 0;
      traceNote({ roundRect: (...a: number[]) => radii.push(a[4]), moveTo: () => lines++, lineTo: () => lines++, closePath: () => lines++ }, style, 0, 0, 100, 40);
      return { radius: radii[0], lines };
    };
    expect(radius('classic')).toEqual({ radius: 20, lines: 0 });
    expect(radius('neon')).toEqual({ radius: 20, lines: 0 });
    expect(radius('arcade').radius).toBeLessThan(20);
    expect(radius('minimal').radius).toBeLessThan(radius('arcade').radius);
    expect(radius('digital')).toEqual({ radius: undefined, lines: 9 });
  });

  it('digital builds a detail path and the others do not', () => {
    for (const style of NOTE_STYLES) {
      const [graphic] = buildNoteGraphics([event()], 46, style);
      expect(graphic.detail !== null).toBe(style === 'digital');
    }
  });

  it('keeps the fret number and the note name readable (4.5:1) in every style, state, string and scheme', () => {
    for (const scheme of STRING_SCHEMES) {
      const palette = resolveGameplayPalette(ORIGINAL_PALETTE, { ...DEFAULT_STRINGS, scheme });
      for (const style of NOTE_STYLES) {
        const kit = buildNoteKit(palette, style, 50);
        for (let string = 1; string <= 7; string++) {
          for (const state of STATES) {
            const colors = noteColors(kit, string, state);
            expect(contrastRatio(colors.text, colors.fill), `${scheme} ${style} s${string} ${state}`).toBeGreaterThanOrEqual(4.5);
          }
        }
      }
    }
  });

  it('keeps that readability at the lowest string intensity and with low contrast', () => {
    const palette = resolveGameplayPalette(ORIGINAL_PALETTE, { ...DEFAULT_STRINGS, intensity: 40, contrast: 'low' });
    for (const style of NOTE_STYLES) {
      const kit = buildNoteKit(palette, style, 0);
      for (const state of STATES) {
        for (let string = 1; string <= 6; string++) {
          const colors = noteColors(kit, string, state);
          expect(contrastRatio(colors.text, colors.fill), `${style} s${string} ${state}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });

  it('never uses shadowBlur outside classic; neon gets a wider translucent stroke instead', () => {
    for (const style of NOTE_STYLES) {
      const [g] = buildNoteGraphics([event()], 40, style);
      const { ctx, log } = createRecorder();
      drawNoteGraphic(ctx, g, buildNoteKit(ORIGINAL_PALETTE, style, 100), 100, 50, 'perfect', 40, null);
      expect(log.some((line) => line.startsWith('shadowBlur')), style).toBe(style === 'classic');
    }
    const [graphic] = buildNoteGraphics([event()], 40, 'neon');
    const neon = createRecorder();
    drawNoteGraphic(neon.ctx, graphic, buildNoteKit(ORIGINAL_PALETTE, 'neon', 100), 100, 50, 'pending', 40, null);
    const widths = neon.log.filter((line) => line.startsWith('lineWidth=')).map((line) => Number(line.slice(10)));
    expect(widths).toHaveLength(2);
    expect(widths[0]).toBeGreaterThan(widths[1]);
    expect(buildNoteKit(ORIGINAL_PALETTE, 'neon', 100).haloAlpha).toBeGreaterThan(buildNoteKit(ORIGINAL_PALETTE, 'neon', 0).haloAlpha);
    expect(buildNoteKit(ORIGINAL_PALETTE, 'arcade', 100).haloAlpha).toBe(0);
  });

  it('digital strokes its corner marks after the outline', () => {
    const [graphic] = buildNoteGraphics([event()], 40, 'digital');
    const { ctx, log } = createRecorder();
    drawNoteGraphic(ctx, graphic, buildNoteKit(ORIGINAL_PALETTE, 'digital', 0), 0, 0, 'pending', 40, null);
    expect(log.filter((line) => line.startsWith('stroke(')).length).toBe(2);
  });
});

describe('note trail', () => {
  it('adds 2 to 3 faint copies behind a pending note and nothing for a judged one', () => {
    const [graphic] = buildNoteGraphics([event()], 40);
    const kit = buildNoteKit(ORIGINAL_PALETTE, 'classic', 0);
    const fills = (state: NoteState, intensity: 1 | 2 | 3) => {
      const { ctx, log } = createRecorder();
      drawNoteGraphic(ctx, graphic, kit, 0, 0, state, 40, trailFor(intensity));
      return log.filter((line) => line.startsWith('fill(')).length;
    };
    expect(fills('pending', 1)).toBe(1 + 2);
    expect(fills('pending', 3)).toBe(1 + 3);
    expect(fills('perfect', 3)).toBe(1);
    expect(fills('miss', 3)).toBe(1);
  });

  it('keeps the transform balanced and the copies faint', () => {
    const [graphic] = buildNoteGraphics([event()], 40);
    const { ctx, log } = createRecorder();
    drawNoteGraphic(ctx, graphic, buildNoteKit(ORIGINAL_PALETTE, 'classic', 0), 0, 0, 'pending', 40, trailFor(2));
    const moved = log.filter((line) => line.startsWith('translate(')).map((line) => Number(line.slice(10).split(',')[0]));
    // The recorder logs each shift rounded, and the gap now follows the size of the note: balanced up to that rounding
    expect(moved.slice(1).reduce((sum, value) => sum + value, 0)).toBeCloseTo(0, 4);
    const alphas = log.filter((line) => line.startsWith('globalAlpha=')).map((line) => Number(line.slice(12)));
    expect(Math.max(...alphas.slice(0, 3))).toBeLessThanOrEqual(0.16);
  });
});

describe('techniques: one block, one bracket', () => {
  const chain = [5, 7, 8, 7, 5].map((fret, index) => event({ id: `c${index}`, timeMs: index * 250, durationMs: 250, string: 4, fret, hammerOnOrPullOff: index > 0 }));
  const kit = buildNoteKit(ORIGINAL_PALETTE, 'classic', 0);
  const blockOf = () => {
    const graphics = buildNoteGraphics(chain, 46, 'classic', 1, 1, 0, 14, true);
    const { blocks } = analyzeTechniques(chain);
    const draw = createBlockDraw(blocks[0].indexes.map((index) => graphics[index]), blocks[0].links);
    for (let index = 0; index < draw.xs.length; index++) draw.xs[index] = 200 + index * 90;
    return draw;
  };
  const count = (log: string[], prefix: string) => log.filter((line) => line.startsWith(prefix)).length;

  it('draws the chain as a single pill with one outline, clipped once, and a segment per note inside', () => {
    const { ctx, log } = createRecorder();
    drawTechniqueBlock(ctx, kit, blockOf(), 100, 12);
    expect(count(log, 'clip(')).toBe(1);
    expect(count(log, 'roundRect(')).toBe(2); // the outline path, once to clip and once to stroke
    expect(count(log, 'fillRect(')).toBe(5 + 4 * 2); // a color per segment, plus the lighter tint and the divider of the four that follow the first
  });

  it('writes the fret of every segment and the tag of every division, and nothing else as a note', () => {
    const { ctx, log } = createRecorder();
    drawTechniqueBlock(ctx, kit, blockOf(), 100, 12);
    const texts = log.filter((line) => line.startsWith('fillText(')).map((line) => line.split(',')[0].replace('fillText(', ''));
    expect(texts).toEqual(['5', '7', '8', '7', '5', 'H', 'H', 'P', 'P']);
  });

  it('never draws a segment closer than a short note is wide, so the numbers do not run into each other', () => {
    const draw = blockOf();
    for (let index = 0; index < draw.xs.length; index++) draw.xs[index] = 200 + index * 5; // far tighter than a note
    const { ctx } = createRecorder();
    drawTechniqueBlock(ctx, kit, draw, 100, 12);
    for (let index = 1; index < draw.px.length; index++) expect(draw.px[index] - draw.px[index - 1]).toBeGreaterThanOrEqual(draw.height * 1.05 - 1e-9);
    expect(draw.px[0]).toBe(draw.xs[0]);
  });

  it('keeps the block as small as its smallest segment', () => {
    const graphics = buildNoteGraphics(chain, 46, 'classic', { spanPx: () => 20, shrink: (each) => (each.id === 'c2' ? 0.6 : 1) }, 1, 0, 14, true);
    expect(createBlockDraw(graphics, []).height).toBeCloseTo(46 * 0.6, 6);
  });

  it('colors each segment by the state of its note', () => {
    const draw = blockOf();
    draw.states[1] = 'perfect';
    draw.states[3] = 'miss';
    const { ctx, log } = createRecorder();
    drawTechniqueBlock(ctx, kit, draw, 100, 12);
    expect(log).toContain(`fillStyle=${ORIGINAL_PALETTE.hit}`);
    expect(log).toContain('globalAlpha=0.35');
  });

  it('draws a palm mute as one bracket with a single PM label', () => {
    const { ctx, log } = createRecorder();
    drawPalmMuteBracket(ctx, kit, 6, 100, 700, 80, 46, 12, 0);
    expect(log.filter((line) => line.startsWith('fillText(PM'))).toHaveLength(1);
    expect(log).toContain('setLineDash([6.44,4.6])');
    expect(count(log, 'lineTo(')).toBe(3); // the bracket: along the top and a tick at each end
  });

  it('keeps the PM label in view while the stretch scrolls past the left edge', () => {
    const { ctx, log } = createRecorder();
    drawPalmMuteBracket(ctx, kit, 6, -300, 900, 80, 46, 12, 0);
    const label = log.find((line) => line.startsWith('fillText(PM'))!;
    expect(Number(label.split(',')[1])).toBeGreaterThan(0);
  });

  it('draws a slide in or out as a short wedge with its tag', () => {
    const { ctx, log } = createRecorder();
    drawAloneSlide(ctx, { kind: 'slide', from: 0, to: 0, up: true, slide: 'in' }, kit, 3, 300, 100, 46, 12, 'pending');
    expect(log.filter((line) => line.startsWith('fillText(')).map((line) => line.split(',')[0])).toEqual(['fillText(/']);
    expect(count(log, 'closePath')).toBe(1);
  });

  it('leaves notes with no technique exactly as they were drawn', () => {
    const plain = [event({ id: 'a' }), event({ id: 'b', timeMs: 400 })];
    const off = buildNoteGraphics(plain, 46, 'classic', 1, 1, 0, 14, false);
    const on = buildNoteGraphics(plain, 46, 'classic', 1, 1, 0, 14, true);
    expect(on.map((graphic) => graphic.marks)).toEqual([null, null]);
    expect(on.map((graphic) => graphic.height)).toEqual(off.map((graphic) => graphic.height));
  });

  it('writes the size of a bend on the note only when the techniques are shown', () => {
    const bend = [event({ bendSemitones: 2 })];
    expect(buildNoteGraphics(bend, 46, 'classic', 1, 1, 0, 14, true)[0].subtitle).toBe('↑1');
    expect(buildNoteGraphics(bend, 46, 'classic', 1, 1, 0, 14, false)[0].subtitle).toBe('↑');
  });

  it('gives a vibrato its wave on the note itself', () => {
    const [graphic] = buildNoteGraphics([event({ vibrato: true })], 46, 'classic', 1, 1, 0, 14, true);
    expect(graphic.marks?.vibrato).toBe(true);
    const { ctx, log } = createRecorder();
    drawNoteGraphic(ctx, graphic, kit, 100, 100, 'pending', 46, null);
    expect(count(log, 'lineTo(')).toBeGreaterThan(8); // the wave
  });
});
