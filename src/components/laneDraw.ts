// The drawing of a lane's notes and technique blocks, outside the component: these run for every note, every frame.
// The component keeps one LaneDrawEnv and refills it (beginLaneFrame, beginLane) instead of building closures and
// objects per lane per frame; nothing here allocates.

import type { ScaleMap } from './noteSpacing';
import { depthScaleAt, stringY, type LaneLayout, type NoteGraphic } from './practiceLanes';
import { drawNoteGraphic, drawTechniqueBlock, type BlockDraw, type NoteKit, type NoteState, type TrailSpec } from './noteStyles';
import type { PalmMuteRun, TechniqueLink } from './techniques';

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** What the techniques of one lane need to be drawn (built once per tab, see PracticeGame). */
export interface LaneTechniques {
  draws: BlockDraw[]; // one per block of notes joined by a technique
  indexes: number[][]; // the notes (indexes into the lane's graphics) of each block, in time order
  blockAt: Int32Array; // the block a note starts, or -1
  inBlock: Uint8Array; // 1 for a note that is a segment of a block
  alone: TechniqueLink[]; // slides that only enter or leave a note
  runs: PalmMuteRun[]; // stretches of palm-muted notes
}

export interface LaneDrawEnv {
  ctx: Ctx2D | null;
  width: number;
  lineX: number;
  u: number; // a 16 px size, scaled by the root font of this screen
  depthRange: number;
  kit: NoteKit | null;
  trail: TrailSpec | null;
  signal: string;
  noteHeight: number;
  chordFont: string;
  chordY: number;
  labelPx: number;
}

export const createLaneDrawEnv = (): LaneDrawEnv => ({
  ctx: null,
  width: 0,
  lineX: 0,
  u: 1,
  depthRange: 1,
  kit: null,
  trail: null,
  signal: '#ffffff',
  noteHeight: 0,
  chordFont: '',
  chordY: 0,
  labelPx: 0
});

export interface LaneFrame {
  ctx: Ctx2D;
  width: number;
  lineX: number;
  u: number;
  depthRange: number;
  kit: NoteKit;
  trail: TrailSpec | null;
  signal: string;
}

/** What is the same for every lane of this frame. */
export const beginLaneFrame = (env: LaneDrawEnv, frame: LaneFrame): void => {
  env.ctx = frame.ctx;
  env.width = frame.width;
  env.lineX = frame.lineX;
  env.u = frame.u;
  env.depthRange = frame.depthRange;
  env.kit = frame.kit;
  env.trail = frame.trail;
  env.signal = frame.signal;
};

/** What belongs to one lane. */
export const beginLane = (env: LaneDrawEnv, noteHeight: number, chordFont: string, chordY: number, labelPx: number): void => {
  env.noteHeight = noteHeight;
  env.chordFont = chordFont;
  env.chordY = chordY;
  env.labelPx = labelPx;
};

/** One note pill, culled off screen, smaller with distance around its own point (so it never leaves its string). */
export const drawNoteInLane = (env: LaneDrawEnv, graphic: NoteGraphic, noteX: number, noteY: number, state: NoteState): void => {
  const { ctx, kit, noteHeight } = env;
  if (!ctx || !kit || noteX < -100 * env.u || noteX > env.width + 100 * env.u || !noteHeight) return;
  const { note } = graphic;
  if (note.chord) {
    ctx.font = env.chordFont;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = env.signal;
    ctx.fillText(note.chord.label, noteX, env.chordY);
  }
  const scale = depthScaleAt(noteX, env.lineX, env.depthRange);
  ctx.save();
  ctx.translate(noteX, noteY);
  ctx.scale(scale, scale);
  ctx.translate(-noteX, -noteY);
  drawNoteGraphic(ctx, graphic, kit, noteX, noteY, state, noteHeight, env.trail);
  ctx.restore();
};

/**
 * A block of notes joined by a technique: one piece, a segment per note, drawn where its first note is reached.
 * `lap` 0 is the lap being played, 1 the next one coming in behind it (training) and -1 the one just left.
 */
export const drawBlockInLane = (
  env: LaneDrawEnv,
  tech: LaneTechniques,
  graphics: NoteGraphic[],
  noteStates: Map<string, NoteState>,
  previousStates: Map<string, NoteState> | undefined,
  layout: LaneLayout,
  scaleMap: ScaleMap,
  trackBase: number,
  blockNumber: number,
  shift: number,
  lap: -1 | 0 | 1
): void => {
  const { ctx, kit } = env;
  if (!ctx || !kit) return;
  const draw = tech.draws[blockNumber];
  const indexes = tech.indexes[blockNumber];
  const count = indexes.length;
  for (let segment = 0; segment < count; segment++) {
    const { note } = graphics[indexes[segment]];
    draw.xs[segment] = env.lineX + scaleMap.xOf(note.timeMs) - trackBase + shift;
    draw.states[segment] = lap === 0 ? noteStates.get(note.id) || 'pending' : lap === 1 ? 'pending' : previousStates?.get(note.id) ?? 'pending';
  }
  const first = draw.xs[0];
  const last = draw.xs[count - 1];
  if (last + draw.height * 4 < -100 * env.u || first > env.width + 100 * env.u) return;
  if (lap === -1 && !previousStates?.has(graphics[indexes[0]].note.id)) return;
  const y = stringY(layout, draw.string);
  const middle = (first + last) / 2;
  const scale = depthScaleAt(middle, env.lineX, env.depthRange);
  ctx.save();
  ctx.translate(middle, y);
  ctx.scale(scale, scale);
  ctx.translate(-middle, -y);
  drawTechniqueBlock(ctx, kit, draw, y, env.labelPx);
  ctx.restore();
};
