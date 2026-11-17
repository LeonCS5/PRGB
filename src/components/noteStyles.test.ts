import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_STRINGS } from '../appearance/defaults';
import { NOTE_STYLES, STRING_SCHEMES, type NoteStyle } from '../appearance/types';
import type { NoteEvent } from '../services/tabsApi';
import { contrastRatio, resolveGameplayPalette } from './gameplayPalette';
import { buildNoteKit, drawNoteGraphic, noteColors, paintNoteRect, traceNote, trailFor, type NoteState } from './noteStyles';
import { buildNoteGraphics, type GamePalette, type NoteGraphic } from './practiceLanes';
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
    ctx.shadowBlur = 18;
  } else if (state === 'good') {
    ctx.shadowColor = palette.near;
    ctx.shadowBlur = 12;
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
    const graphics = buildNoteGraphics(notes, 1, 40);
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
    const [graphic] = buildNoteGraphics([event()], 1, 46);
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
      const [graphic] = buildNoteGraphics([event()], 1, 46, style);
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
      const [g] = buildNoteGraphics([event()], 1, 40, style);
      const { ctx, log } = createRecorder();
      drawNoteGraphic(ctx, g, buildNoteKit(ORIGINAL_PALETTE, style, 100), 100, 50, 'perfect', 40, null);
      expect(log.some((line) => line.startsWith('shadowBlur')), style).toBe(style === 'classic');
    }
    const [graphic] = buildNoteGraphics([event()], 1, 40, 'neon');
    const neon = createRecorder();
    drawNoteGraphic(neon.ctx, graphic, buildNoteKit(ORIGINAL_PALETTE, 'neon', 100), 100, 50, 'pending', 40, null);
    const widths = neon.log.filter((line) => line.startsWith('lineWidth=')).map((line) => Number(line.slice(10)));
    expect(widths).toHaveLength(2);
    expect(widths[0]).toBeGreaterThan(widths[1]);
    expect(buildNoteKit(ORIGINAL_PALETTE, 'neon', 100).haloAlpha).toBeGreaterThan(buildNoteKit(ORIGINAL_PALETTE, 'neon', 0).haloAlpha);
    expect(buildNoteKit(ORIGINAL_PALETTE, 'arcade', 100).haloAlpha).toBe(0);
  });

  it('digital strokes its corner marks after the outline', () => {
    const [graphic] = buildNoteGraphics([event()], 1, 40, 'digital');
    const { ctx, log } = createRecorder();
    drawNoteGraphic(ctx, graphic, buildNoteKit(ORIGINAL_PALETTE, 'digital', 0), 0, 0, 'pending', 40, null);
    expect(log.filter((line) => line.startsWith('stroke(')).length).toBe(2);
  });
});

describe('note trail', () => {
  it('adds 2 to 3 faint copies behind a pending note and nothing for a judged one', () => {
    const [graphic] = buildNoteGraphics([event()], 1, 40);
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
    const [graphic] = buildNoteGraphics([event()], 1, 40);
    const { ctx, log } = createRecorder();
    drawNoteGraphic(ctx, graphic, buildNoteKit(ORIGINAL_PALETTE, 'classic', 0), 0, 0, 'pending', 40, trailFor(2));
    const moved = log.filter((line) => line.startsWith('translate(')).map((line) => Number(line.slice(10).split(',')[0]));
    expect(moved.slice(1).reduce((sum, value) => sum + value, 0)).toBe(0);
    const alphas = log.filter((line) => line.startsWith('globalAlpha=')).map((line) => Number(line.slice(12)));
    expect(Math.max(...alphas.slice(0, 3))).toBeLessThanOrEqual(0.16);
  });
});
