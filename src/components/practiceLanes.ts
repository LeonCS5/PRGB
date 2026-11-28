// Canvas helpers of the practice game: lane geometry, the cached static layer, note pills and hit effects.
// Solo has one lane filling the canvas; duo stacks two lanes (player 1 on top), each with its own strings.

import type { NoteStyle, StringSettings } from '../appearance/types';
import { DEFAULT_STRINGS } from '../appearance/defaults';
import type { NoteEvent } from '../services/tabsApi';
import type { Judgement } from '../services/scoring';
import { SoundFX } from '../services/synthAudio';
import { STRING_THICKNESS_PX } from './gameplayPalette';
import { traceNote, traceNoteDetail } from './noteStyles';
import { bendLabel } from './techniques';

export const DEFAULT_ROOT_PX = 16;

/**
 * What a size drawn for a 16 px root is multiplied by on a canvas whose root font is `rootPx` (1 at the default). The
 * sizes of the canvas that are not a share of the note (string lines, labels, the hit bar) are written for 16 px and
 * go through this, so they follow the root font size (and with it the page zoom and the scale of large screens).
 */
export const remScale = (rootPx: number = DEFAULT_ROOT_PX): number => rootPx / DEFAULT_ROOT_PX;

// Where the hit line sits: about a quarter of the way in, so the notes already played still show behind it. The floor
// (7.5 rem) keeps it clear of the string labels on a phone and the ceiling (22.5 rem) stops it drifting on a wide screen.
const HIT_LINE_SHARE = 0.28;
const HIT_LINE_MIN_REM = 7.5;
const HIT_LINE_MAX_REM = 22.5;
const HIT_LINE_MAX_SHARE = 0.4;
export const hitLineX = (width: number, rootPx: number = DEFAULT_ROOT_PX): number => {
  const max = HIT_LINE_MAX_REM * rootPx;
  const cap = width > 0 ? Math.min(max, width * HIT_LINE_MAX_SHARE) : max;
  return Math.round(Math.min(Math.max(width * HIT_LINE_SHARE, HIT_LINE_MIN_REM * rootPx), cap));
};
export const PIXELS_PER_MS = 0.25; // per song ms, whatever the speed: the speed changes how fast it scrolls, not the spacing
// The size every width and font below was drawn for, used only as the denominator of ratios (a note this tall has
// scale 1): it is not a size on screen and not a cap
export const MAX_NOTE_HEIGHT = 46;

// Sizes of the game are not fixed pixels: a note is a share of the distance between two strings, text and strokes are
// shares of the note, and the few absolute limits are in rem (the browser's root font size, read once per resize).
// Only hairlines (1 px) and the device pixel ratio are plain pixels. See docs/aparencia.md, "Unidades".
const NOTE_SHARE_OF_SPACING = 0.72; // a normal note
const NOTE_MIN_SHARE = 0.5; // smallest share the size choice can bring it to
const NOTE_MAX_SHARE = 0.92; // biggest: two notes on neighbouring strings never touch
const NOTE_FLOOR_REM = 1.5; // never smaller than this, however small the lane
const NOTE_CEIL_REM = 4.5; // never bigger than this in a very tall lane (times the size choice, for "Enorme")
export const NOTE_READABLE_REM = 1.9; // a short note shrunk by the spacing keeps at least this much (fret number legible)
export const FRET_FONT_FLOOR_REM = 0.875; // the fret number is never smaller than this
/** The root font size in px, for the rem limits above. Read only when the canvas is resized, never per frame. */
export const readRootFontPx = (): number => {
  if (typeof document === 'undefined') return DEFAULT_ROOT_PX;
  const size = parseFloat(getComputedStyle(document.documentElement).fontSize);
  return Number.isFinite(size) && size > 0 ? size : DEFAULT_ROOT_PX;
};

// Depth cue of the scrolling highway: what is far from the hit line is a little smaller and fainter. It depends
// only on the distance to the line, never on the string, so notes of one chord stay on the same vertical.
const DEPTH_FALLBACK_RANGE_PX = 900;
const DEPTH_MIN_SCALE = 0.86;
const DEPTH_MIN_ALPHA = 0.55;

// `range` is the distance over which it fades: the track to the right of the line (the whole window of music), so it
// reads the same on every screen. Two scalar functions, not one returning an object: they run for every note and every
// beat line, every frame.
const depthShare = (x: number, lineX: number, range: number): number => Math.max(0, Math.min(1, (x - lineX) / Math.max(1, range)));
export const depthScaleAt = (x: number, lineX: number, range: number = DEPTH_FALLBACK_RANGE_PX): number =>
  1 - (1 - DEPTH_MIN_SCALE) * depthShare(x, lineX, range);
export const depthAlphaAt = (x: number, lineX: number, range: number = DEPTH_FALLBACK_RANGE_PX): number =>
  1 - (1 - DEPTH_MIN_ALPHA) * depthShare(x, lineX, range);

// Bar and beat line colours, in steps of the depth fade: strings built once, not one per line per frame
const BEAT_LINE_STEPS = 12;
const beatLineColors = (base: number): string[] =>
  Array.from({ length: BEAT_LINE_STEPS + 1 }, (_, step) => `rgba(255, 255, 255, ${(base * (DEPTH_MIN_ALPHA + (1 - DEPTH_MIN_ALPHA) * (step / BEAT_LINE_STEPS))).toFixed(3)})`);
const ACCENT_BEAT_COLORS = beatLineColors(0.14);
const PLAIN_BEAT_COLORS = beatLineColors(0.05);

// `alpha` is the fade of depthAlphaAt (DEPTH_MIN_ALPHA to 1)
export const beatLineColor = (accent: boolean, alpha: number): string => {
  const step = Math.round(((alpha - DEPTH_MIN_ALPHA) / (1 - DEPTH_MIN_ALPHA)) * BEAT_LINE_STEPS);
  return (accent ? ACCENT_BEAT_COLORS : PLAIN_BEAT_COLORS)[Math.min(BEAT_LINE_STEPS, Math.max(0, step))];
};

export interface GamePalette {
  background: string;
  rail: string;
  ink: string;
  muted: string;
  divider: string;
  signal: string;
  hit: string;
  near: string;
  miss: string;
  strings: string[];
  players: [string, string];
}

// Resolve CSS tokens once, outside the animation loop.
export const readPalette = (): GamePalette => {
  const styles = getComputedStyle(document.documentElement);
  const color = (name: string) => styles.getPropertyValue('--color-' + name).trim();
  return {
    background: color('ink-900'), rail: color('ink-800'), ink: color('ink-950'), muted: color('ink-400'),
    divider: color('ink-600'), signal: color('play-signal'), hit: color('hit'), near: color('near'), miss: color('miss'),
    strings: [1, 2, 3, 4, 5, 6].map((number) => color('string-' + number)),
    players: [color('player-1'), color('player-2')]
  };
};

export interface LaneLayout {
  top: number;
  height: number;
  topMargin: number;
  stringSpacing: number;
  stringCount: number;
}

export const layoutLanes = (height: number, stringCounts: number[], rootPx: number = DEFAULT_ROOT_PX): LaneLayout[] => {
  const laneHeight = height / stringCounts.length;
  return stringCounts.map((count, index) => {
    const stringCount = count || 6;
    const topMargin = Math.min(70 * remScale(rootPx), laneHeight * 0.16);
    return {
      top: index * laneHeight,
      height: laneHeight,
      topMargin,
      stringSpacing: (laneHeight - topMargin * 2) / (stringCount - 1),
      stringCount
    };
  });
};

/** What the canvas needs to size a lane's notes, computed once per resize (or size choice), never per frame. */
export interface LaneMetrics {
  rootPx: number; // the root font size the rem limits were converted with
  stringSpacing: number;
  noteDiameter: number; // height of a note; its width, fonts and strokes are ratios of this
  readableMin: number; // the least a shrunk short note keeps (NOTE_READABLE_REM)
  fretFontFloor: number; // the fret number's least font size (FRET_FONT_FLOOR_REM)
}

/**
 * Diameter of a note on a lane whose strings are `stringSpacing` apart: 72% of the spacing times the size the player
 * chose (1 = normal, 0.8 to 1.5), kept between 50% and 92% of the spacing, and between the rem limits. Pure, so the
 * spacing of the notes along the track can use the same number.
 */
export const noteDiameterFor = (stringSpacing: number, sizeScale = 1, rootPx = DEFAULT_ROOT_PX): number => {
  const share = Math.min(NOTE_MAX_SHARE, Math.max(NOTE_MIN_SHARE, NOTE_SHARE_OF_SPACING * sizeScale));
  const ceil = NOTE_CEIL_REM * rootPx * Math.max(1, sizeScale);
  const diameter = Math.max(stringSpacing * share > ceil ? ceil : stringSpacing * share, NOTE_FLOOR_REM * rootPx);
  return Math.max(0, Math.min(diameter, stringSpacing * NOTE_MAX_SHARE));
};

/** The size of a note over the size the effects of the canvas were drawn for (a 46 px note is 1). */
export const noteScaleOf = (noteDiameter: number): number => (noteDiameter > 0 ? noteDiameter / MAX_NOTE_HEIGHT : 1);

export const computeLaneMetrics = (lane: LaneLayout, sizeScale = 1, rootPx = DEFAULT_ROOT_PX): LaneMetrics => ({
  rootPx,
  stringSpacing: lane.stringSpacing,
  noteDiameter: noteDiameterFor(lane.stringSpacing, sizeScale, rootPx),
  readableMin: NOTE_READABLE_REM * rootPx,
  fretFontFloor: FRET_FONT_FLOOR_REM * rootPx
});

/** The same for a lane described by its height and number of strings (the layout formula of layoutLanes, one lane). */
export const noteDiameterPx = (laneHeight: number, stringCount: number, sizeScale = 1, rootPx = DEFAULT_ROOT_PX): number => {
  const [lane] = layoutLanes(laneHeight, [stringCount], rootPx);
  return noteDiameterFor(lane.stringSpacing, sizeScale, rootPx);
};

export const noteHeightFor = (lane: LaneLayout, sizeScale = 1, rootPx = DEFAULT_ROOT_PX): number =>
  noteDiameterFor(lane.stringSpacing, sizeScale, rootPx);

export const stringY = (lane: LaneLayout, string: number): number =>
  lane.top + lane.topMargin + (string - 1) * lane.stringSpacing;

export type Canvas2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/**
 * Static part of a lane (rails, string labels, hit line), drawn once into the cached background.
 * `label` names the player in duo mode. Play Free moves the line to where the notes are born.
 * `strings` only changes how the string lines look; the defaults draw exactly the original lane.
 */
export const drawLaneBackground = (
  ctx: Canvas2D,
  lane: LaneLayout,
  width: number,
  palette: GamePalette,
  label: { text: string; color: string } | null,
  lineX: number = hitLineX(width),
  strings: StringSettings = DEFAULT_STRINGS,
  rootPx: number = DEFAULT_ROOT_PX
): void => {
  // Every size below was drawn for a 16 px root: `u` carries it to the root of this screen (1 at the default)
  const u = remScale(rootPx);
  const lineWidth = STRING_THICKNESS_PX[strings.thickness] * u;
  const availableHeight = lane.height - lane.topMargin * 2;

  // 1. Draw horizontal string rails
  for (let s = 1; s <= lane.stringCount; s++) {
    const y = stringY(lane, s);
    const color = palette.strings[s - 1] || palette.muted;

    // String line glow & rail
    ctx.beginPath();
    ctx.strokeStyle = palette.rail;
    ctx.lineWidth = 14 * u;
    if (strings.laneOpacity < 100) ctx.globalAlpha = strings.laneOpacity / 100;
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
    if (strings.laneOpacity < 100) ctx.globalAlpha = 1;

    // Halo of the string: a wider translucent stroke, drawn once into the cached layer
    if (strings.glow > 0) {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth + 6 * u;
      ctx.globalAlpha = 0.32 * strings.glow / 100;
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Colored string center line
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    if (strings.lineStyle === 'dashed') ctx.setLineDash([14 * u, 6 * u]);
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
    if (strings.lineStyle === 'dashed') ctx.setLineDash([]);

    // String label on the left (e.g. 1 / E, 6 / E)
    ctx.font = `bold ${13 * u}px Inter, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = palette.background;
    const labelHeight = Math.min(26 * u, lane.stringSpacing * 0.9);
    ctx.fillRect(10 * u, y - labelHeight / 2, 62 * u, labelHeight);
    ctx.fillStyle = color;
    ctx.fillText(`${s} / ${['e', 'B', 'G', 'D', 'A', 'E'][s - 1] || s}`, 18 * u, y);
  }

  // 2. Draw Practice Playhead / Target Hit Zone Bar
  const top = lane.top + lane.topMargin;
  const grad = ctx.createLinearGradient(lineX - 4 * u, 0, lineX + 4 * u, 0);
  grad.addColorStop(0, palette.signal + '1a');
  grad.addColorStop(0.5, palette.signal);
  grad.addColorStop(1, palette.signal + '1a');
  ctx.fillStyle = grad;
  ctx.fillRect(lineX - 8 * u, top - 20 * u, 16 * u, availableHeight + 40 * u);

  ctx.beginPath();
  ctx.strokeStyle = palette.signal;
  ctx.lineWidth = 3 * u;
  ctx.shadowColor = palette.signal;
  ctx.shadowBlur = 16 * u;
  ctx.moveTo(lineX, top - 20 * u);
  ctx.lineTo(lineX, top + availableHeight + 20 * u);
  ctx.stroke();
  ctx.shadowBlur = 0;

  if (label) {
    ctx.font = `bold ${11 * u}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = label.color;
    ctx.fillText(label.text, lineX + 18 * u, lane.top + Math.max(10 * u, lane.topMargin / 2 - 8 * u));
  }
};

/** How the song is spread along the track: where a note ends (its tail) and how much of its size it keeps. */
export interface NoteScale {
  spanPx: (timeMs: number, durationMs: number) => number;
  shrink: (note: NoteEvent) => number;
}

/**
 * What a technique adds to a note drawn on its own: the wave of a vibrato. Notes joined by a hammer-on, a pull-off or a
 * slide are drawn as one block (noteStyles.ts) and a palm mute as one bracket over its stretch, so they have no marks here.
 */
export interface NoteMarks {
  vibrato: boolean;
  /** Where the vibrato wave runs along the note, in px from its point (a short note gets a small wave under it). */
  waveFrom: number;
  waveTo: number;
}

export interface NoteGraphic {
  note: NoteEvent;
  path: Path2D;
  fret: string;
  subtitle: string;
  fretX: number;
  subtitleX: number;
  fretFont: string;
  subtitleFont: string;
  detail: Path2D | null; // stroke-only marks inside the note (digital style)
  height: number; // what the note was drawn at: smaller than the lane's note height for a shrunk short note
  tailPx: number; // how far its tail runs along the track from its point (the block it is a segment of uses it)
  marks: NoteMarks | null; // null: no technique mark (the setting is off, or the note has none)
}

// Pill shapes are shared between notes of the same size, so a song builds only a handful of Path2D.
// Short single-tap notes render as compact circles (fret only); longer/sustained notes stretch into pills.
// `zoom` is one scale for the whole track, or a NoteScale that follows the song (noteSpacing.ts).
// `shrink` is the share of its size a short tap keeps when the song is too tight for full circles (noteSpacing.ts).
// `techniques` turns on the marks of the techniques (destination of a link, palm mute, vibrato, the size of a bend).
export const buildNoteGraphics = (notes: NoteEvent[], noteHeight: number, style: NoteStyle = 'classic', zoom: number | NoteScale = 1, shrink: number = 1, minHeight: number = 0, fontFloor: number = FRET_FONT_FLOOR_REM * DEFAULT_ROOT_PX, techniques: boolean = false): NoteGraphic[] => {
  const paths = new Map<string, { path: Path2D; detail: Path2D | null }>();
  return notes.map((note) => {
    const technique = `${note.bendSemitones ? '↑' + (techniques ? bendLabel(note.bendSemitones) : '') : ''}${note.harmonic ? 'H' : ''}${note.tapping ? 'T' : ''}`;
    const fret = note.dead ? 'x' : note.ghost ? `(${note.fret})` : `${note.fret}`;
    // A number is one scale all through; a NoteScale follows the song, so a tail ends where its note ends on the track
    const durationPx = (typeof zoom === 'number' ? note.durationMs * PIXELS_PER_MS * zoom : zoom.spanPx(note.timeMs, note.durationMs)) * 0.85;
    const noteShrink = typeof zoom === 'number' ? shrink : zoom.shrink(note);
    const isShortTap = !technique && durationPx < noteHeight * 1.45;
    // Only the short taps shrink, and the fret number keeps a floor so it stays readable
    // minHeight keeps a shrunk tap readable: it never goes below it (or below the lane's own note height)
    const height = isShortTap ? Math.max(noteHeight * noteShrink, Math.min(noteHeight, minHeight)) : noteHeight;
    const scale = height / MAX_NOTE_HEIGHT;
    const fretFontSize = Math.max(Math.min(fontFloor, 23 * noteHeight / MAX_NOTE_HEIGHT), 23 * scale); // the floor never makes it bigger than unshrunk
    const subtitleFontSize = 13 * scale;
    const subtitle = note.dead || isShortTap ? '' : technique || note.noteName;
    const fretWidth = fret.length * fretFontSize * 0.75;
    const left = isShortTap ? -Math.max(height, fretWidth + 14 * scale) / 2 : -Math.max(height / 2, fretWidth / 2 + 10 * scale);
    const subtitleX = fretWidth / 2 + 8 * scale;
    const labelWidth = -left + fretWidth / 2 + (subtitle ? 8 * scale + subtitle.length * subtitleFontSize * 0.65 + 10 * scale : 0);
    const width = isShortTap
      ? Math.max(height, fretWidth + 14 * scale)
      : Math.max((technique ? 100 : 72) * scale, labelWidth, -left + durationPx); // the tail ends where the note ends
    const key = `${left}:${width}:${height}`;
    let shape = paths.get(key);
    if (!shape) {
      const path = new Path2D();
      traceNote(path, style, left, -height / 2, width, height);
      let detail: Path2D | null = null;
      if (style === 'digital') {
        detail = new Path2D();
        traceNoteDetail(detail, left, -height / 2, width, height);
      }
      shape = { path, detail };
      paths.set(key, shape);
    }
    let marks: NoteMarks | null = null;
    if (techniques && note.vibrato) {
      const waveFrom = isShortTap ? -0.35 * height : 0;
      marks = { vibrato: true, waveFrom, waveTo: Math.max(waveFrom + 0.7 * height, isShortTap ? 0.35 * height : left + width - 0.3 * height) };
    }
    return {
      note,
      path: shape.path,
      detail: shape.detail,
      fret,
      subtitle,
      fretX: 0,
      subtitleX,
      height,
      tailPx: durationPx,
      marks,
      fretFont: `900 ${fretFontSize}px Inter, sans-serif`,
      subtitleFont: `bold ${subtitleFontSize}px monospace`
    };
  });
};

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
  size: number;
}

export interface FloatingText {
  text: string;
  color: string;
  x: number;
  y: number;
  alpha: number;
}

export interface HitEffects {
  particles: Particle[];
  texts: FloatingText[];
}

// `unit` is the size of the note on this lane over the size these numbers were drawn for (noteScaleOf): the sparks and the
// text follow the note, on a phone and on a QHD screen alike
const burst = (effects: HitEffects, lineX: number, y: number, count: number, speed: [number, number], size: [number, number], color: string, unit: number) => {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const spd = (speed[0] + Math.random() * speed[1]) * unit;
    effects.particles.push({
      x: lineX,
      y,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd,
      color,
      alpha: 1,
      size: (size[0] + Math.random() * size[1]) * unit
    });
  }
};

// Where the floating "Perfeito!/Bom/Errou" starts, in diameters of the note: a little to the right of the line, and
// high enough that the text (about half a diameter tall) is above the note's top edge, which is half a diameter up
const FEEDBACK_SHIFT = 0.1;
const FEEDBACK_RISE = 0.95;

// Sound, sparks and the floating "Perfeito!/Bom/Errou" of a judged note. Without `withSound` the judgement is silent
// (the player's choice) and everything else still shows.
export const playHitFeedback = (judgement: Judgement, note: NoteEvent, lineX: number, y: number, palette: GamePalette, effects: HitEffects, withSound = true, unit = 1): void => {
  // Above the note, never over its number: the text starts clear of the note's top edge and rises from there. Both
  // distances are shares of the note (MAX_NOTE_HEIGHT * unit is its diameter), so it clears it on every screen.
  const diameter = MAX_NOTE_HEIGHT * unit;
  const textAt = { x: lineX + FEEDBACK_SHIFT * diameter, y: y - FEEDBACK_RISE * diameter };
  if (judgement === 'perfect') {
    if (withSound) SoundFX.playPerfectHit();
    burst(effects, lineX, y, 24, [2, 5], [3, 4], palette.hit, unit);
    effects.texts.push({ text: `Perfeito! ${note.noteName}`, color: palette.hit, ...textAt, alpha: 1 });
  } else if (judgement === 'good') {
    if (withSound) SoundFX.playPerfectHit();
    burst(effects, lineX, y, 14, [1.5, 3.5], [2.5, 3], palette.near, unit);
    effects.texts.push({ text: 'Bom', color: palette.near, ...textAt, alpha: 1 });
  } else {
    if (withSound) SoundFX.playMissSound();
    effects.texts.push({ text: 'Errou', color: palette.miss, ...textAt, alpha: 0.9 });
  }
};

// The static layers are drawn once on an offscreen surface; browsers without OffscreenCanvas get a detached canvas
export const createLayer = (width: number, height: number): { layer: OffscreenCanvas | HTMLCanvasElement; ctx: Canvas2D | null } => {
  if (typeof OffscreenCanvas !== 'undefined') {
    const layer = new OffscreenCanvas(width, height);
    return { layer, ctx: layer.getContext('2d') };
  }
  const layer = document.createElement('canvas');
  layer.width = width;
  layer.height = height;
  return { layer, ctx: layer.getContext('2d') };
};
