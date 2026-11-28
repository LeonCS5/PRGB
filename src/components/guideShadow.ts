// The guide shadow: a soft mark on the hit line that shows which note to play next. It rests on the string of the
// note that was just due and hops to the next one, landing exactly on that note's time. Everything here is anchored
// to the song clock (never to timers), so it follows the speed, pauses with the song and survives seeks.
// computeGuide is pure and writes into a reused frame; drawGuide only paints. The game and the appearance preview
// share both, so what the preview shows is what is played.

import { DEFAULT_GUIDE_SHADOW } from '../appearance/defaults';
import type { EffectIntensity, GuideColor, GuideEasing, GuideShadowSettings, GuideStyle, NoteStyle } from '../appearance/types';
import { HIT_LATE_MS, isScorable } from '../services/scoring';
import type { NoteEvent } from '../services/tabsApi';
import type { NoteState } from './noteStyles';
import { MAX_NOTE_HEIGHT, stringY, type Canvas2D, type LaneLayout } from './practiceLanes';

export const GUIDE_HOP_MS = DEFAULT_GUIDE_SHADOW.hopMs; // default real time of the hop; one played slower lasts as much in real time
export const GUIDE_APPROACH_MS = 1400; // real time before a note in which the guide shows up
// The dark body of the shadow style, while the note is still far: it starts at these shares of its opacity and size and
// reaches the full ones as the note arrives, so it never sits heavy on the string long before it is needed
export const GUIDE_FAR_OPACITY = 0.35;
export const GUIDE_FAR_SIZE = 0.82;
export const GUIDE_PULSE_MS = 240; // real time of the pulse after the note is due
export const GUIDE_GROUP_MS = 30; // notes this close in time sound together: the shadow covers them as one set
const MAX_TARGETS = 8;

export interface GuideFrame {
  count: number; // strings of the next set of notes: more than one for a chord
  strings: number[]; // reused; only the first `count` are valid
  fromString: number; // string of the note before, where the shadow rests before the hop
  fromLo: number; // lowest and highest string of the set the shadow rests on (the previous set)
  fromHi: number;
  toLo: number; // lowest and highest string of the set it is landing on
  toHi: number;
  hop: number; // 0 = still on the previous set, 1 = landed on the next one
  visibility: number; // 0..1: fades in as the note comes
  proximity: number; // 0..1: 0 when the guide first shows, 1 as the note is due: the dark body grows into its full weight
  pulse: number; // 1 right as the note is due, back to 0
  aheadMs: number; // song ms until the note; negative once it is due
  hasNext: boolean; // there is a set after this one (only looked for when the preview of the next is on)
  nextLo: number;
  nextHi: number;
}

export const createGuideFrame = (): GuideFrame => ({
  count: 0,
  strings: new Array<number>(MAX_TARGETS).fill(0),
  fromString: 0,
  fromLo: 0,
  fromHi: 0,
  toLo: 0,
  toHi: 0,
  hop: 1,
  visibility: 0,
  proximity: 0,
  pulse: 0,
  aheadMs: 0,
  hasNext: false,
  nextLo: 0,
  nextHi: 0
});

const clamp01 = (value: number): number => (value < 0 ? 0 : value > 1 ? 1 : value);
const easeInOut = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
// Every curve starts at 0 and lands on exactly 1 at t = 1, so the shadow is on the note when its time comes
const snap = (t: number): number => { const u = clamp01((t - 0.7) / 0.3); return u * u * (3 - 2 * u); }; // waits, then jumps
const elastic = (t: number): number => { if (t <= 0) return 0; const u = t - 1; return 1 + 2.70158 * u * u * u + 1.70158 * u * u; }; // overshoots, settles
const EASINGS: Record<GuideEasing, (t: number) => number> = { smooth: easeInOut, snap, elastic };

// First index whose note is not older than `timeMs` (notes come sorted by time)
const firstFrom = (notes: readonly NoteEvent[], timeMs: number): number => {
  let low = 0;
  let high = notes.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (notes[mid].timeMs < timeMs) low = mid + 1;
    else high = mid;
  }
  return low;
};

const isGuideNote = (note: NoteEvent): boolean => !note.dead && !note.grace;

/**
 * Finds the next set of notes still to be played (one note, or every note that sounds together: a chord, a strum,
 * strings struck at once) and where the shadow is on its way to it. `states` holds what the game decided for each
 * note (missing = pending). Returns false, with nothing to draw, when no note is left.
 * Reduced motion keeps the information and drops the movement: the shadow is on the set as soon as it shows.
 */
export const computeGuide = (
  notes: readonly NoteEvent[],
  states: ReadonlyMap<string, NoteState>,
  positionMs: number,
  speed: number,
  reducedMotion: boolean,
  out: GuideFrame,
  shadow: GuideShadowSettings = DEFAULT_GUIDE_SHADOW
): boolean => {
  out.count = 0;
  out.hasNext = false;
  const safeSpeed = speed > 0 ? speed : 1;
  // A note older than the late window is already a miss in the game; skipping it here keeps the guide right
  // for callers that have no states yet
  let index = firstFrom(notes, positionMs - HIT_LATE_MS);
  while (index < notes.length) {
    const note = notes[index];
    if (isScorable(note) && (states.get(note.id) ?? 'pending') === 'pending') break;
    index++;
  }
  if (index >= notes.length) return false;

  const target = notes[index];
  // Everything that sounds with the target and is still to be played (the members of a chord share its state)
  let lo = target.string;
  let hi = target.string;
  out.strings[0] = target.string;
  out.count = 1;
  for (let peer = firstFrom(notes, target.timeMs - GUIDE_GROUP_MS); peer < notes.length && out.count < MAX_TARGETS; peer++) {
    const member = notes[peer];
    if (member.timeMs - target.timeMs > GUIDE_GROUP_MS) break;
    if (member === target || !isGuideNote(member) || (states.get(member.id) ?? 'pending') !== 'pending') continue;
    let seen = false;
    for (let known = 0; known < out.count; known++) if (out.strings[known] === member.string) seen = true;
    if (seen) continue;
    out.strings[out.count++] = member.string;
    if (member.string < lo) lo = member.string;
    if (member.string > hi) hi = member.string;
  }
  out.toLo = lo;
  out.toHi = hi;

  // Where the shadow came from: the set before, when it is close enough for the guide to have been showing
  let previous: NoteEvent | null = null;
  let previousIndex = -1;
  for (let back = index - 1; back >= 0; back--) {
    const candidate = notes[back];
    if (!isGuideNote(candidate) || target.timeMs - candidate.timeMs <= GUIDE_GROUP_MS) continue;
    previous = candidate;
    previousIndex = back;
    break;
  }
  const approachSong = GUIDE_APPROACH_MS * safeSpeed;
  const hopSong = shadow.hopMs * safeSpeed;
  const ahead = target.timeMs - positionMs;
  out.aheadMs = ahead;
  const hasOrigin = previous !== null && target.timeMs - previous.timeMs <= approachSong;
  out.fromString = hasOrigin && previous ? previous.string : target.string;
  if (hasOrigin && previous) {
    let fromLo = previous.string;
    let fromHi = previous.string;
    for (let back = previousIndex - 1; back >= 0 && previous.timeMs - notes[back].timeMs <= GUIDE_GROUP_MS; back--) {
      if (!isGuideNote(notes[back])) continue;
      if (notes[back].string < fromLo) fromLo = notes[back].string;
      if (notes[back].string > fromHi) fromHi = notes[back].string;
    }
    out.fromLo = fromLo;
    out.fromHi = fromHi;
  } else {
    out.fromLo = lo;
    out.fromHi = hi;
  }

  // The hop starts at the previous note's time or one hop before the next, whichever is later
  const hopStart = previous ? Math.max(previous.timeMs, target.timeMs - hopSong) : target.timeMs - hopSong;
  const span = target.timeMs - hopStart;
  out.hop = reducedMotion || span <= 0 ? 1 : EASINGS[shadow.easing](clamp01((positionMs - hopStart) / span));
  out.visibility = clamp01((approachSong - ahead) / (approachSong * 0.3));
  out.proximity = clamp01(1 - ahead / approachSong);
  out.pulse = reducedMotion || ahead > 0 || !shadow.pulse ? 0 : clamp01(1 - -ahead / (GUIDE_PULSE_MS * safeSpeed));

  // The set after the target, for the faint preview of what comes next
  if (shadow.showNext) {
    let after = index + 1;
    while (after < notes.length && (notes[after].timeMs - target.timeMs <= GUIDE_GROUP_MS || !isGuideNote(notes[after]) || !isScorable(notes[after]))) after++;
    if (after < notes.length) {
      const first = notes[after];
      let nextLo = first.string;
      let nextHi = first.string;
      for (let peer = after + 1; peer < notes.length && notes[peer].timeMs - first.timeMs <= GUIDE_GROUP_MS; peer++) {
        if (!isGuideNote(notes[peer])) continue;
        if (notes[peer].string < nextLo) nextLo = notes[peer].string;
        if (notes[peer].string > nextHi) nextHi = notes[peer].string;
      }
      out.hasNext = true;
      out.nextLo = nextLo;
      out.nextHi = nextHi;
    }
  }
  return true;
};

const INTENSITY_GAIN: Record<EffectIntensity, number> = { 1: 0.65, 2: 1, 3: 1.4 };

// Fixed swatches of the options (the project's own tones); 'auto' and 'string' depend on the look and the string
const SWATCHES: Record<Exclude<GuideColor, 'auto' | 'string'>, string> = {
  black: '#000000', white: '#ffffff', amber: '#ff9a4d', cyan: '#34e3ff', violet: '#c49bff', green: '#3ee08f', red: '#ff4d6d'
};
const resolveColor = (choice: GuideColor, auto: string, stringColor: string): string =>
  choice === 'auto' ? auto : choice === 'string' ? stringColor : SWATCHES[choice];

// How round the corners of the "note" shape are, from the note style (1 = a full capsule)
const NOTE_ROUNDNESS: Record<NoteStyle, number> = { classic: 1, arcade: 0.5, minimal: 0.45, neon: 1, digital: 0.15 };

// One path for the whole set: an ellipse for a single note, an oval capsule from the highest string to the lowest for
// a chord; the other shapes are rounded rectangles that cover the same span
const body = (ctx: Canvas2D, shape: GuideShadowSettings['shape'], x: number, top: number, bottom: number, rx: number, ry: number, noteStyle: NoteStyle): void => {
  ctx.beginPath();
  if (shape === 'ellipse') {
    ctx.ellipse(x, top, rx, ry, 0, 0, Math.PI * 2);
    if (bottom > top) {
      ctx.rect(x - rx, top, rx * 2, bottom - top);
      ctx.ellipse(x, bottom, rx, ry, 0, 0, Math.PI * 2);
    }
    return;
  }
  const round = shape === 'capsule' ? 1 : shape === 'rounded' ? 0.45 : NOTE_ROUNDNESS[noteStyle];
  ctx.roundRect(x - rx, top - ry, rx * 2, bottom - top + ry * 2, Math.min(rx, ry) * round);
};

export interface GuideDrawExtras {
  shadow?: GuideShadowSettings;
  stringColors?: readonly string[]; // the colours of the strings, 1 first, for the "cor da corda" choices
  noteStyle?: NoteStyle; // the shape of the "formato da nota" option
}

/**
 * Paints the frame on the hit line of one lane. `distancePx` is how far the next note still is from the line: the
 * faint streak joins the note to the line, so the eye can follow it down to the strings it will land on. The
 * shape covers every string of the set at once (or one per played string, if the player asked for that).
 * The hologram style uses the options that fit a glow (colour, size, opacity, "brilho", trail, pulse, offset,
 * next, hop); outline, shape and blur belong to the shadow style.
 */
export const drawGuide = (
  ctx: Canvas2D,
  frame: GuideFrame,
  lane: LaneLayout,
  lineX: number,
  distancePx: number,
  color: string,
  intensity: EffectIntensity,
  noteHeight: number,
  reducedMotion: boolean,
  style: GuideStyle = 'shadow',
  extras: GuideDrawExtras = {}
): void => {
  if (frame.count === 0 || frame.visibility <= 0 || noteHeight <= 0) return;
  const { shadow = DEFAULT_GUIDE_SHADOW, stringColors, noteStyle = 'classic' } = extras;
  const d = DEFAULT_GUIDE_SHADOW;
  const gain = INTENSITY_GAIN[intensity];
  const hologram = style === 'hologram';
  // Every length below is a share of the note (the unit is 1 for the size the widths were drawn for): nothing is a fixed number of pixels
  const unit = noteHeight / MAX_NOTE_HEIGHT;
  const stringColor = stringColors?.[frame.strings[0] - 1] ?? color;
  const fill = resolveColor(shadow.color, hologram ? color : SWATCHES.black, stringColor);

  const fromA = stringY(lane, frame.fromLo);
  const fromB = stringY(lane, frame.fromHi);
  const fromTop = Math.min(fromA, fromB);
  const fromBottom = Math.max(fromA, fromB);
  const toA = stringY(lane, frame.toLo);
  const toB = stringY(lane, frame.toHi);
  const toTop = Math.min(toA, toB);
  const toBottom = Math.max(toA, toB);
  // The hop is an arc: it leaves the strings, rises a little and lands on the next ones
  const arc = reducedMotion ? 0 : Math.sin(Math.PI * frame.hop) * Math.min(lane.stringSpacing * 0.6, noteHeight * 0.35);
  const top = fromTop + (toTop - fromTop) * frame.hop - arc;
  const bottom = fromBottom + (toBottom - fromBottom) * frame.hop - arc;

  const pulse = 1 + (shadow.pulseStrength / 100) * 0.9 * frame.pulse;
  const x = lineX + (noteHeight * shadow.offsetX) / 100;
  let dy = (noteHeight * shadow.offsetY) / 100;
  let alpha: number;
  let rx: number;
  let ry: number;
  if (hologram) {
    // Opacity, glow and offset are relative to the defaults, so a player who never touched them sees the usual hologram
    alpha = frame.visibility * Math.min(shadow.preserveNote ? 0.6 : 1, 0.55 * gain * (shadow.opacity / d.opacity));
    // Same body size as the shadow style, driven by the same width and height options
    rx = noteHeight * 0.5 * (shadow.width / 100) * pulse;
    ry = noteHeight * 0.5 * (shadow.height / 100) * pulse;
    dy -= (noteHeight * d.offsetY) / 100;
  } else {
    // Lighter and a little smaller while the note is far (proximity < 1); the full "Destaque" when it arrives
    const arriving = frame.proximity * frame.proximity * (3 - 2 * frame.proximity);
    alpha = frame.visibility * Math.min(1, (shadow.opacity / 100) * gain) * (GUIDE_FAR_OPACITY + (1 - GUIDE_FAR_OPACITY) * arriving);
    const size = GUIDE_FAR_SIZE + (1 - GUIDE_FAR_SIZE) * arriving;
    rx = noteHeight * 0.5 * (shadow.width / 100) * pulse * size;
    ry = noteHeight * 0.5 * (shadow.height / 100) * pulse * size;
  }
  const shape = hologram ? 'ellipse' : shadow.shape;
  const perString = !hologram && shadow.chordCover === 'played' && frame.count > 1;

  ctx.save();
  ctx.fillStyle = fill;
  ctx.shadowColor = fill;

  // Streak: from the line up to the note, behind it, fading toward the note
  if (shadow.trail && distancePx > 0 && distancePx < 360 * unit) {
    const length = Math.min(distancePx, 260 * unit * (shadow.trailLength / 100));
    const segments = 6;
    const half = noteHeight * 0.3;
    for (let segment = 0; segment < segments; segment++) {
      ctx.globalAlpha = alpha * (shadow.trailOpacity / 100) * (hologram ? 0.64 : 0.8) * (1 - segment / segments);
      ctx.fillRect(x + (length * segment) / segments, toTop + dy - half, length / segments + 1, toBottom - toTop + half * 2);
    }
  }

  // A faint ghost on the set after this one, a little ahead on the track and smaller than the shadow
  if (shadow.showNext && frame.hasNext) {
    const nextA = stringY(lane, frame.nextLo);
    const nextB = stringY(lane, frame.nextHi);
    ctx.globalAlpha = alpha * 0.35;
    body(ctx, shape, x + rx * 1.8, Math.min(nextA, nextB) + dy, Math.max(nextA, nextB) + dy, rx * 0.7, ry * 0.7, noteStyle);
    ctx.fill();
  }

  // The body: one shape over the set, or one per played string
  // "Preservar a nota": the hologram is a ring around the note (a faint fill, the light on its edge) and the dark body
  // stays see-through, so what is under or over the guide is never washed out
  const ring = hologram && shadow.preserveNote;
  ctx.shadowBlur = hologram ? noteHeight * (0.5 + 0.3 * gain) * (shadow.glow / d.glow) : (noteHeight * 0.8 * shadow.blur) / 100;
  ctx.globalAlpha = ring ? alpha * 0.16 : hologram ? alpha : Math.min(shadow.preserveNote ? 0.85 : 0.95, alpha);
  if (perString) {
    for (let index = 0; index < frame.count; index++) {
      const y = perStringY(lane, frame, index, fromTop, fromBottom, arc) + dy;
      body(ctx, shape, x, y, y, rx, ry, noteStyle);
      ctx.fill();
    }
  } else {
    body(ctx, shape, x, top + dy, bottom + dy, rx, ry, noteStyle);
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  if (ring) {
    // The light sits on the edge and the middle stays clear, so the fret number reads through it
    ctx.strokeStyle = fill;
    ctx.lineWidth = noteHeight * 0.09;
    ctx.shadowColor = fill;
    ctx.shadowBlur = noteHeight * (0.3 + 0.2 * gain) * (shadow.glow / d.glow);
    ctx.globalAlpha = Math.min(0.8, alpha * 1.4);
    body(ctx, shape, x, top + dy, bottom + dy, rx, ry, noteStyle);
    ctx.stroke();
    ctx.shadowBlur = 0;
  } else if (hologram) {
    // The denser core of the halo
    ctx.globalAlpha = Math.min(1, alpha * 0.9);
    body(ctx, 'ellipse', x, top + dy, bottom + dy, rx * 0.45, ry * 0.46, noteStyle);
    ctx.fill();
  } else if (shadow.outline) {
    // The rim in the chosen colour and, unless that is already white, a thinner light one, so the body reads on the dark track
    ctx.lineWidth = shadow.outlineWidth * unit;
    ctx.strokeStyle = resolveColor(shadow.outlineColor, stringColor, stringColor);
    ctx.globalAlpha = Math.min(1, alpha * 1.2);
    const light = shadow.outlineColor !== 'white';
    const strokeBody = (rimTop: number, rimBottom: number) => {
      body(ctx, shape, x, rimTop, rimBottom, rx, ry, noteStyle);
      ctx.stroke();
      if (!light) return;
      const width = ctx.lineWidth;
      const color = ctx.strokeStyle;
      ctx.strokeStyle = SWATCHES.white;
      ctx.lineWidth = 1;
      ctx.globalAlpha = Math.min(1, alpha * 0.7);
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.globalAlpha = Math.min(1, alpha * 1.2);
    };
    if (perString) {
      for (let index = 0; index < frame.count; index++) {
        const y = perStringY(lane, frame, index, fromTop, fromBottom, arc) + dy;
        strokeBody(y, y);
      }
    } else {
      strokeBody(top + dy, bottom + dy);
    }
  }
  ctx.restore();
};

// Where one played string of a chord is: it leaves from the nearest point of the set the shadow was resting on
const perStringY = (lane: LaneLayout, frame: GuideFrame, index: number, fromTop: number, fromBottom: number, arc: number): number => {
  const target = stringY(lane, frame.strings[index]);
  const start = target < fromTop ? fromTop : target > fromBottom ? fromBottom : target;
  return start + (target - start) * frame.hop - arc;
};
