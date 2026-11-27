// Canvas helpers of the practice game: lane geometry, the cached static layer, note pills and hit effects.
// Solo has one lane filling the canvas; duo stacks two lanes (player 1 on top), each with its own strings.

import type { NoteStyle, StringSettings } from '../appearance/types';
import { DEFAULT_STRINGS } from '../appearance/defaults';
import type { NoteEvent } from '../services/tabsApi';
import type { Judgement } from '../services/scoring';
import { SoundFX } from '../services/synthAudio';
import { STRING_THICKNESS_PX } from './gameplayPalette';
import { traceNote, traceNoteDetail } from './noteStyles';

export const HIT_LINE_X = 140; // practice hit target X
export const PIXELS_PER_MS = 0.35; // at 1×; scaled by the playback speed (wider reading window)
const MAX_NOTE_HEIGHT = 46;

// Subtle 3D fretboard tilt across the entire track: top strings sit slightly further back
// (compressed toward horizontal center) and bottom strings sit slightly closer.
const PERSPECTIVE_TOP_SCALE = 0.945;
const PERSPECTIVE_BOTTOM_SCALE = 1.02;

export const perspectiveX = (x: number, y: number, lane: LaneLayout, width: number): number => {
  const top = lane.top + lane.topMargin;
  const span = Math.max(1, lane.height - lane.topMargin * 2);
  const t = Math.max(0, Math.min(1, (y - top) / span));
  const scale = PERSPECTIVE_TOP_SCALE + (PERSPECTIVE_BOTTOM_SCALE - PERSPECTIVE_TOP_SCALE) * t;
  const cx = width * 0.5;
  return cx + (x - cx) * scale;
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

export const layoutLanes = (height: number, stringCounts: number[]): LaneLayout[] => {
  const laneHeight = height / stringCounts.length;
  return stringCounts.map((count, index) => {
    const stringCount = count || 6;
    const topMargin = Math.min(70, laneHeight * 0.16);
    return {
      top: index * laneHeight,
      height: laneHeight,
      topMargin,
      stringSpacing: (laneHeight - topMargin * 2) / (stringCount - 1),
      stringCount
    };
  });
};

export const noteHeightFor = (lane: LaneLayout): number =>
  Math.min(MAX_NOTE_HEIGHT, Math.max(0, lane.stringSpacing * 0.7));

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
  hitLineX: number = HIT_LINE_X,
  strings: StringSettings = DEFAULT_STRINGS
): void => {
  const lineWidth = STRING_THICKNESS_PX[strings.thickness];
  const availableHeight = lane.height - lane.topMargin * 2;
  const boardTop = lane.top + lane.topMargin - 16;
  const boardHeight = availableHeight + 32;

  // 0. Subtle 3D fretboard surface behind the strings
  const boardGrad = ctx.createLinearGradient(0, boardTop, 0, boardTop + boardHeight);
  boardGrad.addColorStop(0, 'rgba(0, 0, 0, 0.22)');
  boardGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.03)');
  boardGrad.addColorStop(1, 'rgba(255, 255, 255, 0.06)');
  ctx.fillStyle = boardGrad;
  ctx.fillRect(0, boardTop, width, boardHeight);

  // Subtle top & bottom fretboard edges
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.fillRect(0, boardTop, width, 1.5);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.fillRect(0, boardTop + boardHeight - 1.5, width, 1.5);

  // 1. Draw horizontal string rails
  for (let s = 1; s <= lane.stringCount; s++) {
    const y = stringY(lane, s);
    const color = palette.strings[s - 1] || palette.muted;

    // String line glow & rail
    ctx.beginPath();
    ctx.strokeStyle = palette.rail;
    ctx.lineWidth = 14;
    if (strings.laneOpacity < 100) ctx.globalAlpha = strings.laneOpacity / 100;
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
    if (strings.laneOpacity < 100) ctx.globalAlpha = 1;

    // Subtle drop shadow under the string for depth above the fretboard
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.lineWidth = lineWidth + 1.5;
    ctx.moveTo(0, y + 2);
    ctx.lineTo(width, y + 2);
    ctx.stroke();

    // Halo of the string: a wider translucent stroke, drawn once into the cached layer
    if (strings.glow > 0) {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth + 6;
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
    if (strings.lineStyle === 'dashed') ctx.setLineDash([14, 6]);
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
    if (strings.lineStyle === 'dashed') ctx.setLineDash([]);

    // String label on the left (e.g. 1 / E, 6 / E)
    ctx.font = 'bold 13px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = palette.background;
    const labelHeight = Math.min(26, lane.stringSpacing * 0.9);
    ctx.fillRect(10, y - labelHeight / 2, 62, labelHeight);
    ctx.fillStyle = color;
    ctx.fillText(`${s} / ${['e', 'B', 'G', 'D', 'A', 'E'][s - 1] || s}`, 18, y);
  }

  // 2. Draw Practice Playhead / Target Hit Zone Bar
  const top = lane.top + lane.topMargin;
  const grad = ctx.createLinearGradient(hitLineX - 4, 0, hitLineX + 4, 0);
  grad.addColorStop(0, palette.signal + '1a');
  grad.addColorStop(0.5, palette.signal);
  grad.addColorStop(1, palette.signal + '1a');
  ctx.fillStyle = grad;
  ctx.fillRect(hitLineX - 8, top - 20, 16, availableHeight + 40);

  ctx.beginPath();
  ctx.strokeStyle = palette.signal;
  ctx.lineWidth = 3;
  ctx.shadowColor = palette.signal;
  ctx.shadowBlur = 16;
  ctx.moveTo(hitLineX, top - 20);
  ctx.lineTo(hitLineX, top + availableHeight + 20);
  ctx.stroke();
  ctx.shadowBlur = 0;

  if (label) {
    ctx.font = 'bold 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = label.color;
    ctx.fillText(label.text, HIT_LINE_X + 18, lane.top + Math.max(10, lane.topMargin / 2 - 8));
  }
};

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
}

// Pill shapes are shared between notes of the same size, so a song builds only a handful of Path2D
export const buildNoteGraphics = (notes: NoteEvent[], speed: number, noteHeight: number, style: NoteStyle = 'classic'): NoteGraphic[] => {
  const paths = new Map<string, { path: Path2D; detail: Path2D | null }>();
  const scale = noteHeight / MAX_NOTE_HEIGHT;
  const fretFontSize = 23 * scale;
  const subtitleFontSize = 13 * scale;
  return notes.map((note) => {
    const technique = `${note.bendSemitones ? '↑' : ''}${note.harmonic ? 'H' : ''}${note.tapping ? 'T' : ''}`;
    const fret = note.dead ? 'x' : note.ghost ? `(${note.fret})` : `${note.fret}`;
    const subtitle = note.dead ? '' : technique || note.noteName;
    const fretWidth = fret.length * fretFontSize * 0.75;
    const left = -(10 * scale + fretWidth / 2);
    const subtitleX = fretWidth / 2 + 8 * scale;
    const labelWidth = 20 * scale + fretWidth + (subtitle ? 8 * scale + subtitle.length * subtitleFontSize * 0.65 : 0);
    const width = Math.max((technique ? 104 : 70) * scale, labelWidth, note.durationMs * PIXELS_PER_MS * speed * 0.7);
    const key = `${width}:${noteHeight}`;
    let shape = paths.get(key);
    if (!shape) {
      const path = new Path2D();
      traceNote(path, style, left, -noteHeight / 2, width, noteHeight);
      let detail: Path2D | null = null;
      if (style === 'digital') {
        detail = new Path2D();
        traceNoteDetail(detail, left, -noteHeight / 2, width, noteHeight);
      }
      shape = { path, detail };
      paths.set(key, shape);
    }
    return {
      note,
      path: shape.path,
      detail: shape.detail,
      fret,
      subtitle,
      fretX: 0,
      subtitleX,
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

const burst = (effects: HitEffects, y: number, count: number, speed: [number, number], size: [number, number], color: string) => {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const spd = speed[0] + Math.random() * speed[1];
    effects.particles.push({
      x: HIT_LINE_X,
      y,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd,
      color,
      alpha: 1,
      size: size[0] + Math.random() * size[1]
    });
  }
};

// Sound, sparks and the floating "Perfeito!/Bom/Errou" of a judged note
export const playHitFeedback = (judgement: Judgement, note: NoteEvent, y: number, palette: GamePalette, effects: HitEffects): void => {
  const textAt = { x: HIT_LINE_X + 15, y: y - 10 };
  if (judgement === 'perfect') {
    SoundFX.playPerfectHit();
    burst(effects, y, 24, [2, 5], [3, 4], palette.hit);
    effects.texts.push({ text: `Perfeito! ${note.noteName}`, color: palette.hit, ...textAt, alpha: 1 });
  } else if (judgement === 'good') {
    SoundFX.playPerfectHit();
    burst(effects, y, 14, [1.5, 3.5], [2.5, 3], palette.near);
    effects.texts.push({ text: 'Bom', color: palette.near, ...textAt, alpha: 1 });
  } else {
    SoundFX.playMissSound();
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
