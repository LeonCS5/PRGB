// Note styles of the practice canvas. `classic` is the original pill, drawn with the original instructions;
// the others only change the shape, the colors and the outline. Positions, sizes and timing come from the caller.

import type { NoteStyle } from '../appearance/types';
import { mixColors, readableOn } from './gameplayPalette';
import type { GamePalette, NoteGraphic } from './practiceLanes';

export type NoteState = 'pending' | 'perfect' | 'good' | 'miss' | 'skipped';

const LIGHT_TEXT = '#ffffff';
const REFERENCE_HEIGHT = 46; // MAX_NOTE_HEIGHT of practiceLanes: widths below are for a note this tall

// Path2D and the 2D context both accept these, so one function shapes the cached paths and the direct draws
export interface ShapeTarget {
  roundRect(x: number, y: number, width: number, height: number, radius: number): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  closePath(): void;
}

export const traceNote = (target: ShapeTarget, style: NoteStyle, x: number, y: number, width: number, height: number): void => {
  switch (style) {
    case 'arcade':
      target.roundRect(x, y, width, height, height * 0.28);
      return;
    case 'minimal':
      target.roundRect(x, y, width, height, height * 0.22);
      return;
    case 'digital': {
      const cut = Math.min(height * 0.3, width / 4);
      target.moveTo(x + cut, y);
      target.lineTo(x + width - cut, y);
      target.lineTo(x + width, y + cut);
      target.lineTo(x + width, y + height - cut);
      target.lineTo(x + width - cut, y + height);
      target.lineTo(x + cut, y + height);
      target.lineTo(x, y + height - cut);
      target.lineTo(x, y + cut);
      target.closePath();
      return;
    }
    default: // classic and neon: the pill
      target.roundRect(x, y, width, height, height / 2);
  }
};

// Small corner marks inside a digital note (a stroke-only path)
export const traceNoteDetail = (target: ShapeTarget, x: number, y: number, width: number, height: number): void => {
  const unit = height / REFERENCE_HEIGHT;
  const cut = Math.min(height * 0.3, width / 4);
  const inset = 3 * unit;
  const length = 6 * unit;
  target.moveTo(x + cut + inset, y + inset + length);
  target.lineTo(x + cut + inset, y + inset);
  target.lineTo(x + cut + inset + length, y + inset);
  target.moveTo(x + width - cut - inset, y + height - inset - length);
  target.lineTo(x + width - cut - inset, y + height - inset);
  target.lineTo(x + width - cut - inset - length, y + height - inset);
};

export interface NoteColors {
  fill: string;
  stroke: string;
  text: string;
}

// A kit holds every color of a style already resolved, so the frame only indexes an array
export interface NoteKit {
  style: NoteStyle;
  table: NoteColors[];
  haloAlpha: number;
  hit: string;
  near: string;
  ink: string;
  strokeUnits: number; // outline width for a 46 px note
}

const STATE_COUNT = 4; // pending, perfect, good, miss (skipped looks pending)
const STATE_INDEX: Record<NoteState, number> = { pending: 0, perfect: 1, good: 2, miss: 3, skipped: 0 };
const STROKE_UNITS: Record<NoteStyle, number> = { classic: 2.5, arcade: 4, minimal: 2, neon: 2.5, digital: 2 };

const colorsFor = (style: NoteStyle, base: string, state: number, palette: GamePalette): NoteColors => {
  if (style === 'classic') {
    // Ink is readable on every original color; only a dimmed string (intensity setting) can need the light text
    return { fill: base, stroke: state === 1 ? palette.hit : palette.ink, text: readableOn(base, [palette.ink, LIGHT_TEXT]) };
  }
  if (style === 'minimal' || style === 'neon') {
    const fill = style === 'minimal' ? mixColors(base, palette.rail, 0.78) : mixColors(base, palette.background, 0.82);
    return { fill, stroke: base, text: readableOn(fill, [base, LIGHT_TEXT, palette.ink]) };
  }
  // arcade and digital: solid fill with a dark outline
  return { fill: base, stroke: palette.ink, text: readableOn(base, [palette.ink, LIGHT_TEXT]) };
};

export const buildNoteKit = (palette: GamePalette, style: NoteStyle, glow: number): NoteKit => {
  const table: NoteColors[] = [];
  const bases = [...palette.strings.slice(0, 6), palette.muted]; // the last one serves a string with no color
  for (const stringColor of bases) {
    for (let state = 0; state < STATE_COUNT; state++) {
      const base = state === 1 ? palette.hit : state === 2 ? palette.near : state === 3 ? palette.muted : stringColor;
      table.push(colorsFor(style, base, state, palette));
    }
  }
  return {
    style,
    table,
    haloAlpha: style === 'neon' ? 0.18 + 0.32 * Math.max(0, Math.min(100, glow)) / 100 : 0,
    hit: palette.hit,
    near: palette.near,
    ink: palette.ink,
    strokeUnits: STROKE_UNITS[style]
  };
};

export const noteColors = (kit: NoteKit, string: number, state: NoteState): NoteColors => {
  const lane = string >= 1 && string <= 6 ? string - 1 : 6;
  return kit.table[lane * STATE_COUNT + STATE_INDEX[state]];
};

export interface TrailSpec {
  copies: number; // 2 or 3
  gap: number;    // px between copies
}

const TRAIL_ALPHA = [0.16, 0.1, 0.05] as const;

export const trailFor = (intensity: 1 | 2 | 3): TrailSpec => ({ copies: intensity === 1 ? 2 : 3, gap: 7 + intensity * 3 });

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/**
 * One note at (noteX, noteY). `trail` adds faint copies behind a pending note (computed from the position only).
 * With the classic style and no trail the instruction sequence is the one the game always drew.
 */
export const drawNoteGraphic = (
  ctx: Ctx2D,
  graphic: NoteGraphic,
  kit: NoteKit,
  noteX: number,
  noteY: number,
  state: NoteState,
  noteHeight: number,
  trail: TrailSpec | null
): void => {
  const { note, path, fret, subtitle, fretX, subtitleX, fretFont, subtitleFont } = graphic;
  const colors = noteColors(kit, note.string, state);
  ctx.save();
  ctx.translate(noteX, noteY);
  if (note.grace) ctx.scale(0.75, 0.75);

  let alpha = 1;
  if (state === 'perfect') {
    if (kit.style === 'classic') {
      ctx.shadowColor = kit.hit;
      ctx.shadowBlur = 18;
    }
  } else if (state === 'good') {
    if (kit.style === 'classic') {
      ctx.shadowColor = kit.near;
      ctx.shadowBlur = 12;
    }
  } else if (state === 'miss') {
    ctx.globalAlpha = alpha = 0.35;
  } else if (state === 'skipped' || note.ghost) {
    ctx.globalAlpha = alpha = 0.55;
  }

  if (trail && state === 'pending') {
    ctx.fillStyle = colors.fill;
    for (let copy = 1; copy <= trail.copies; copy++) {
      ctx.translate(trail.gap, 0);
      ctx.globalAlpha = alpha * TRAIL_ALPHA[copy - 1];
      ctx.fill(path);
    }
    ctx.translate(-trail.gap * trail.copies, 0);
    ctx.globalAlpha = alpha;
  }

  ctx.fillStyle = colors.fill;
  ctx.fill(path);

  const strokeWidth = kit.strokeUnits * noteHeight / REFERENCE_HEIGHT;
  if (kit.haloAlpha > 0) {
    // A wider translucent second stroke: the glow without shadowBlur
    ctx.globalAlpha = alpha * kit.haloAlpha;
    ctx.lineWidth = strokeWidth + 7 * noteHeight / REFERENCE_HEIGHT;
    ctx.strokeStyle = colors.stroke;
    ctx.stroke(path);
    ctx.globalAlpha = alpha;
  }

  ctx.lineWidth = strokeWidth;
  ctx.strokeStyle = colors.stroke;
  ctx.stroke(path);

  if (graphic.detail) {
    ctx.globalAlpha = alpha * 0.6;
    ctx.lineWidth = Math.max(1, strokeWidth * 0.8);
    ctx.stroke(graphic.detail);
    ctx.globalAlpha = alpha;
  }

  ctx.fillStyle = colors.text;
  ctx.font = fretFont;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(fret, fretX, 0);

  ctx.fillStyle = colors.text;
  ctx.font = subtitleFont;
  ctx.textAlign = 'left';
  ctx.fillText(subtitle, subtitleX, 0);

  ctx.restore();
};

/**
 * A note as a plain rectangle (Play Free, where the width follows the played duration). Paints the shape and
 * returns the color the caller must use for the text.
 */
export const paintNoteRect = (ctx: Ctx2D, kit: NoteKit, string: number, x: number, top: number, width: number, height: number): string => {
  const colors = noteColors(kit, string, 'pending');
  ctx.fillStyle = colors.fill;
  ctx.beginPath();
  traceNote(ctx, kit.style, x, top, width, height);
  ctx.fill();
  if (kit.style !== 'classic') {
    const unit = height / REFERENCE_HEIGHT;
    if (kit.haloAlpha > 0) {
      ctx.globalAlpha = kit.haloAlpha;
      ctx.lineWidth = (kit.strokeUnits + 7) * unit;
      ctx.strokeStyle = colors.stroke;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.lineWidth = kit.strokeUnits * unit;
    ctx.strokeStyle = colors.stroke;
    ctx.stroke();
    if (kit.style === 'digital') {
      ctx.beginPath();
      traceNoteDetail(ctx, x, top, width, height);
      ctx.globalAlpha = 0.6;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  return colors.text;
};
