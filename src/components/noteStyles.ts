// Note styles of the practice canvas. `classic` is the original pill, drawn with the original instructions;
// the others only change the shape, the colors and the outline. Positions, sizes and timing come from the caller.

import type { NoteStyle } from '../appearance/types';
import { mixColors, readableOn } from './gameplayPalette';
import type { GamePalette, NoteGraphic } from './practiceLanes';
import { linkBadge, type TechniqueLink } from './techniques';

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
  gap: number;    // px between copies, for a note REFERENCE_HEIGHT tall (drawNoteGraphic scales it with the note)
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
  const drawnHeight = graphic.height || noteHeight;
  // The glow and the trail were drawn for a note REFERENCE_HEIGHT tall: they follow the size of this one
  const unit = drawnHeight / REFERENCE_HEIGHT;
  ctx.save();
  ctx.translate(noteX, noteY);
  if (note.grace) ctx.scale(0.75, 0.75);

  let alpha = 1;
  if (state === 'perfect') {
    if (kit.style === 'classic') {
      ctx.shadowColor = kit.hit;
      ctx.shadowBlur = 18 * unit;
    }
  } else if (state === 'good') {
    if (kit.style === 'classic') {
      ctx.shadowColor = kit.near;
      ctx.shadowBlur = 12 * unit;
    }
  } else if (state === 'miss') {
    ctx.globalAlpha = alpha = 0.35;
  } else if (state === 'skipped' || note.ghost) {
    ctx.globalAlpha = alpha = 0.55;
  }

  if (trail && state === 'pending') {
    ctx.fillStyle = colors.fill;
    for (let copy = 1; copy <= trail.copies; copy++) {
      ctx.translate(trail.gap * unit, 0);
      ctx.globalAlpha = alpha * TRAIL_ALPHA[copy - 1];
      ctx.fill(path);
    }
    ctx.translate(-trail.gap * unit * trail.copies, 0);
    ctx.globalAlpha = alpha;
  }

  ctx.fillStyle = colors.fill;
  ctx.fill(path);

  const strokeWidth = kit.strokeUnits * unit;
  if (kit.haloAlpha > 0) {
    // A wider translucent second stroke: the glow without shadowBlur
    ctx.globalAlpha = alpha * kit.haloAlpha;
    ctx.lineWidth = strokeWidth + 7 * unit;
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

  const marks = graphic.marks;
  if (marks?.vibrato) {
    ctx.shadowBlur = 0;
    ctx.strokeStyle = colors.fill;
    ctx.lineWidth = Math.max(1, drawnHeight * 0.07);
    ctx.globalAlpha = alpha * 0.9;
    traceWave(ctx, marks.waveFrom, marks.waveTo, drawnHeight * 0.64, drawnHeight * 0.075, drawnHeight * 0.3);
    ctx.stroke();
  }

  ctx.restore();
};

const DESTINATION_TINT = 0.3;
const BADGE_RADIUS = 0.23; // of the note's height
/** A segment of a block is at least this many heights wide (what noteSpacing.ts assumes for a short note). */
export const SEGMENT_PITCH_RATIO = 1.05;

/** A small round tag (the H and P of a link, the slash of a slide): ink with a ring, so it reads on any string color. */
const drawBadge = (ctx: Ctx2D, text: string, cx: number, cy: number, height: number, fontPx: number, ink: string, ring: string): void => {
  const radius = BADGE_RADIUS * height;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = ink;
  ctx.globalAlpha = 0.92;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.lineWidth = Math.max(1, height * 0.05);
  ctx.strokeStyle = ring;
  ctx.stroke();
  ctx.fillStyle = LIGHT_TEXT;
  ctx.font = `bold ${fontPx}px Inter, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, cy + fontPx * 0.04);
};

/** The same tag as a pill, for two letters (PM). */
const drawPill = (ctx: Ctx2D, text: string, cx: number, cy: number, fontPx: number, ink: string, ring: string, textColor: string): void => {
  const width = fontPx * 2.1;
  const height = fontPx * 1.2;
  ctx.beginPath();
  ctx.roundRect(cx - width / 2, cy - height / 2, width, height, height / 2);
  ctx.fillStyle = ink;
  ctx.globalAlpha = 0.92;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.lineWidth = Math.max(1, fontPx * 0.14);
  ctx.strokeStyle = ring;
  ctx.stroke();
  ctx.fillStyle = textColor;
  ctx.font = `bold ${fontPx}px Inter, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, cy + fontPx * 0.04);
};

/** A sine line from x0 to x1 at height y (no allocation: it only adds points to the current path). */
const traceWave = (ctx: Ctx2D, x0: number, x1: number, y: number, amplitude: number, wavelength: number): void => {
  const steps = Math.max(2, Math.ceil(((x1 - x0) / wavelength) * 6));
  ctx.beginPath();
  ctx.moveTo(x0, y);
  for (let step = 1; step <= steps; step++) {
    const x = x0 + ((x1 - x0) * step) / steps;
    ctx.lineTo(x, y + Math.sin(((x - x0) / wavelength) * Math.PI * 2) * amplitude);
  }
};

/**
 * Notes joined one after another on a string (a hammer-on, a pull-off, a slide) drawn as ONE block: a single pill with
 * one outline, a segment inside it for each note (the first, the one that is picked, at full tone; the ones reached by
 * the left hand alone lighter), and on each division the tag of the link (H, P, / or \\) and a small arrow. The point of
 * a segment is where its note falls, so the player sees where each note lands inside the block.
 */
export interface BlockDraw {
  graphics: NoteGraphic[]; // one per segment, in time order
  links: TechniqueLink[]; // links[i] joins segment i to segment i + 1
  string: number;
  height: number; // one for the whole block: the smallest of its segments
  xs: Float64Array; // the x of each segment's point: written by the caller every frame
  states: NoteState[]; // the state of each segment: written by the caller every frame
  px: Float64Array; // scratch: where each segment is drawn
}

export const createBlockDraw = (graphics: NoteGraphic[], links: TechniqueLink[]): BlockDraw => ({
  graphics,
  links,
  string: graphics[0].note.string,
  height: graphics.reduce((smallest, graphic) => Math.min(smallest, graphic.height), Infinity),
  xs: new Float64Array(graphics.length),
  states: graphics.map(() => 'pending' as NoteState),
  px: new Float64Array(graphics.length)
});

const reachedByHand = (link: TechniqueLink): boolean => link.kind !== 'slide' || link.slide === 'legato';

export const drawTechniqueBlock = (ctx: Ctx2D, kit: NoteKit, block: BlockDraw, y: number, labelPx: number): void => {
  const { graphics, links, xs, states, px, string } = block;
  const count = graphics.length;
  const h = block.height;
  const top = y - h / 2;
  // Each segment is at least as wide as a short note: a block of fast notes grows past their time before it is unreadable
  px[0] = xs[0];
  for (let index = 1; index < count; index++) px[index] = Math.max(xs[index], px[index - 1] + h * SEGMENT_PITCH_RATIO);
  const left = px[0] - h / 2;
  const right = px[count - 1] + Math.max(graphics[count - 1].tailPx, h * 0.7);
  const unit = h / REFERENCE_HEIGHT;
  const dividerWidth = Math.max(1, h * 0.045);

  ctx.save();
  // The faint dotted arcs of the movement, behind the block
  ctx.setLineDash([h * 0.07, h * 0.12]);
  ctx.lineWidth = Math.max(1, h * 0.06);
  for (let index = 1; index < count; index++) {
    if (links[index - 1].kind === 'slide') continue;
    const colors = noteColors(kit, string, states[index]);
    const from = px[index - 1];
    const to = px[index];
    ctx.strokeStyle = colors.fill;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(from, top + h * 0.2);
    ctx.quadraticCurveTo((from + to) / 2, top - Math.min(h * 0.9, (to - from) * 0.35) * 2, to, top + h * 0.2);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // The body: one outline; inside it a segment for each note, in the color of its state
  ctx.beginPath();
  traceNote(ctx, kit.style, left, top, right - left, h);
  ctx.save();
  ctx.clip();
  for (let index = 0; index < count; index++) {
    const start = index === 0 ? left : px[index] - h / 2;
    const end = index === count - 1 ? right : px[index + 1] - h / 2;
    const state = states[index];
    const alpha = state === 'miss' ? 0.35 : state === 'skipped' || graphics[index].note.ghost ? 0.55 : 1;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = noteColors(kit, string, state).fill;
    ctx.fillRect(start, top, end - start, h);
    if (index > 0) {
      if (reachedByHand(links[index - 1])) {
        ctx.globalAlpha = alpha * DESTINATION_TINT;
        ctx.fillStyle = LIGHT_TEXT;
        ctx.fillRect(start, top, end - start, h);
      }
      ctx.globalAlpha = alpha * 0.7;
      ctx.fillStyle = kit.ink;
      ctx.fillRect(start - dividerWidth / 2, top, dividerWidth, h);
    }
  }
  ctx.restore();
  ctx.globalAlpha = 1;
  ctx.beginPath();
  traceNote(ctx, kit.style, left, top, right - left, h);
  ctx.lineWidth = kit.strokeUnits * unit;
  ctx.strokeStyle = noteColors(kit, string, states[0]).stroke;
  ctx.stroke();

  // The fret of each segment at the point of its note, and the wave of a vibrato under it
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let index = 0; index < count; index++) {
    const graphic = graphics[index];
    const colors = noteColors(kit, string, states[index]);
    ctx.globalAlpha = states[index] === 'miss' ? 0.35 : 1;
    ctx.fillStyle = colors.text;
    ctx.font = graphic.fretFont;
    ctx.fillText(graphic.fret, px[index], y);
    if (graphic.note.vibrato) {
      const end = index === count - 1 ? right : px[index + 1] - h / 2;
      ctx.strokeStyle = colors.fill;
      ctx.lineWidth = Math.max(1, h * 0.07);
      traceWave(ctx, px[index] - h * 0.35, Math.max(px[index] + h * 0.35, end - h * 0.3), y + h * 0.64, h * 0.075, h * 0.3);
      ctx.stroke();
    }
  }

  // On each division: the arrow of the direction (a slash for a slide) and the tag of the link
  ctx.lineCap = 'round';
  for (let index = 1; index < count; index++) {
    const link = links[index - 1];
    const x = px[index] - h / 2;
    const colors = noteColors(kit, string, states[index]);
    ctx.globalAlpha = states[index] === 'miss' ? 0.35 : 1;
    ctx.strokeStyle = colors.text;
    ctx.lineWidth = Math.max(1, h * (link.kind === 'slide' ? 0.1 : 0.08));
    ctx.beginPath();
    const lean = link.up ? 1 : -1;
    if (link.kind === 'slide') {
      ctx.moveTo(x - h * 0.14, y + lean * h * 0.18);
      ctx.lineTo(x + h * 0.14, y - lean * h * 0.18);
    } else {
      const arm = h * 0.12;
      ctx.moveTo(x - arm, y + lean * arm * 0.5);
      ctx.lineTo(x, y - lean * arm * 0.5);
      ctx.lineTo(x + arm, y + lean * arm * 0.5);
    }
    ctx.stroke();
    drawBadge(ctx, linkBadge(link), x, top, h, labelPx, kit.ink, colors.fill);
  }
  ctx.restore();
};

/**
 * One bracket over a stretch of notes under a palm mute, like the "P.M.- - -|" of a tab: a dashed line with an end tick
 * and a single PM label, kept in view while the stretch scrolls past (`labelFrom` is the left edge it may reach).
 */
export const drawPalmMuteBracket = (ctx: Ctx2D, kit: NoteKit, string: number, x0: number, x1: number, y: number, height: number, labelPx: number, labelFrom: number): void => {
  const tick = height * 0.2;
  const colors = noteColors(kit, string, 'pending');
  ctx.save();
  ctx.setLineDash([height * 0.14, height * 0.1]);
  ctx.lineWidth = Math.max(1, height * 0.06);
  ctx.strokeStyle = LIGHT_TEXT;
  ctx.globalAlpha = 0.75;
  ctx.beginPath();
  ctx.moveTo(x0, y + tick);
  ctx.lineTo(x0, y);
  ctx.lineTo(x1, y);
  ctx.lineTo(x1, y + tick);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  const labelWidth = labelPx * 2.1;
  const labelX = Math.min(Math.max(x0 + labelWidth / 2 + height * 0.1, labelFrom + labelWidth / 2), x1 - labelWidth / 2);
  drawPill(ctx, 'PM', Math.max(labelX, Math.min(x0 + labelWidth / 2, x1)), y, labelPx, kit.ink, colors.fill, LIGHT_TEXT);
  ctx.restore();
};

/** A slide that only enters or leaves a note: a short wedge beside it, thin where it starts and thick where it lands, and its tag. */
export const drawAloneSlide = (ctx: Ctx2D, link: TechniqueLink, kit: NoteKit, string: number, x: number, y: number, height: number, labelPx: number, state: NoteState): void => {
  const colors = noteColors(kit, string, state);
  const alpha = state === 'miss' ? 0.35 : state === 'skipped' ? 0.55 : 1;
  const reach = height * 1.1;
  const entering = link.slide === 'in';
  const x0 = entering ? x - reach : x + height * 0.1;
  const x1 = entering ? x - height * 0.1 : x + reach;
  const thin = height * 0.16;
  const thick = height * 0.58;
  const leftSide = entering ? thin : thick;
  const rightSide = entering ? thick : thin;
  ctx.save();
  ctx.globalAlpha = alpha * 0.85;
  ctx.beginPath();
  ctx.moveTo(x0, y - leftSide / 2);
  ctx.lineTo(x1, y - rightSide / 2);
  ctx.lineTo(x1, y + rightSide / 2);
  ctx.lineTo(x0, y + leftSide / 2);
  ctx.closePath();
  ctx.fillStyle = colors.fill;
  ctx.fill();
  ctx.globalAlpha = alpha;
  ctx.lineWidth = Math.max(1, height * 0.05);
  ctx.strokeStyle = kit.ink;
  ctx.stroke();
  drawBadge(ctx, linkBadge(link), (x0 + x1) / 2, y - height * 0.52, height, labelPx, kit.ink, colors.fill);
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
