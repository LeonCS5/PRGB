// A small, static picture of the gameplay for the appearance page: six strings and a few example notes, drawn
// with the same functions as the game (lane background, note styles, trail, pulse), so what is shown is what is played.

import type { GameplayAppearance } from '../appearance/types';
import { drawPulseRing } from './gameEffects';
import { buildGameplayLook } from './gameplayLook';
import { computeGuide, createGuideFrame, drawGuide } from './guideShadow';
import { createBlockDraw, drawNoteGraphic, drawTechniqueBlock, SEGMENT_PITCH_RATIO, trailFor, type BlockDraw, type NoteKit, type NoteState } from './noteStyles';
import { analyzeTechniques } from './techniques';
import {
  buildNoteGraphics,
  drawLaneBackground,
  layoutLanes,
  noteHeightFor,
  noteScaleOf,
  readRootFontPx,
  FRET_FONT_FLOOR_REM,
  stringY,
  type Canvas2D,
  type GamePalette,
  type LaneLayout
} from './practiceLanes';
import type { NoteEvent } from '../services/tabsApi';

interface SampleNote { string: number; fret: number; name: string; at: number; state: NoteState }

// `at` is the distance from the hit line as a fraction of the width: positive = still coming
const SAMPLES: readonly SampleNote[] = [
  { string: 1, fret: 5, name: 'A4', at: 0.5, state: 'pending' },
  { string: 2, fret: 3, name: 'D4', at: 0.36, state: 'pending' },
  { string: 3, fret: 5, name: 'D4', at: 0, state: 'perfect' },
  { string: 4, fret: 7, name: 'A3', at: -0.02, state: 'good' },
  { string: 5, fret: 7, name: 'E3', at: 0.22, state: 'pending' },
  { string: 6, fret: 5, name: 'A2', at: -0.14, state: 'miss' }
];

const sampleEvent = (sample: SampleNote, index: number): NoteEvent => ({
  id: `preview-${index}`, timeMs: 0, durationMs: 250, string: sample.string, fret: sample.fret,
  midiNote: 0, freqHz: 0, noteName: sample.name
});

// The guide of the preview plays a little loop of its own, with the same functions as the game: one note every
// 700 ms, hopping across the strings, then a pause before it starts again
const GUIDE_SETS: readonly (readonly number[])[] = [[3], [5], [2], [4, 2, 1], [6], [1, 3, 5]]; // single notes and chords
const GUIDE_STEP_MS = 700;
export const PREVIEW_GUIDE_LOOP_MS = GUIDE_STEP_MS * (GUIDE_SETS.length + 2);
const GUIDE_STATIC_AT_MS = GUIDE_STEP_MS * 2 - 60; // about to land on the second note, hop nearly done
// The window of music across the picture to the right of the line, so the distance is a share of the width
const GUIDE_WINDOW_MS = 1000;
const GUIDE_NOTES: NoteEvent[] = GUIDE_SETS.flatMap((strings, step) => strings.map((string, member): NoteEvent => ({
  id: `guide-${step}-${member}`, timeMs: GUIDE_STEP_MS * (step + 1), durationMs: 250, string, fret: 0,
  midiNote: 0, freqHz: 0, noteName: ''
})));
const guideStates: ReadonlyMap<string, NoteState> = new Map();
const guideFrame = createGuideFrame();

// Draws the guide at a point of its loop; the page animates it by calling this with the clock, and the still
// picture (reduced motion, or nothing else moving) uses a fixed point
export const drawPreviewGuide = (
  ctx: Canvas2D,
  width: number,
  height: number,
  appearance: GameplayAppearance,
  palette: GamePalette,
  positionMs: number
): void => {
  if (!appearance.guide.enabled) return;
  const rootPx = readRootFontPx();
  const [layout] = layoutLanes(height, [6], rootPx);
  if (!computeGuide(GUIDE_NOTES, guideStates, positionMs, 1, appearance.reducedMotion, guideFrame, appearance.guide.shadow)) return;
  const lineX = Math.round(width * 0.38);
  const distancePx = guideFrame.aheadMs * ((width - lineX) / GUIDE_WINDOW_MS);
  drawGuide(ctx, guideFrame, layout, lineX, distancePx, palette.signal, appearance.guide.intensity, noteHeightFor(layout, appearance.noteSize / 100, rootPx), appearance.reducedMotion, appearance.guide.style, {
    shadow: appearance.guide.shadow, stringColors: buildGameplayLook(palette, appearance).palette.strings, noteStyle: appearance.noteStyle
  });
};

// Two blocks of the techniques, drawn with the game's own functions (analyzeTechniques, createBlockDraw,
// drawTechniqueBlock) so what is shown is what is played: a hammer-on and a pull-off (5 H 7 P 5) and a slide (3 / 5).
// `at` is the share of the width from the hit line to the first segment.
interface TechniqueSample { string: number; at: number; state: NoteState; notes: NoteEvent[] }
const techniqueNote = (id: string, timeMs: number, string: number, fret: number, extra: Partial<NoteEvent> = {}): NoteEvent => ({
  id, timeMs, durationMs: 150, string, fret, midiNote: 0, freqHz: 0, noteName: '', ...extra
});
const TECHNIQUE_SAMPLES: readonly TechniqueSample[] = [
  { string: 6, at: 0.1, state: 'pending', notes: [techniqueNote('t-0', 0, 6, 5), techniqueNote('t-1', 150, 6, 7, { hammerOnOrPullOff: true }), techniqueNote('t-2', 300, 6, 5, { hammerOnOrPullOff: true })] },
  { string: 1, at: -0.36, state: 'perfect', notes: [techniqueNote('s-0', 0, 1, 3, { slide: 'shift' }), techniqueNote('s-1', 150, 1, 5)] }
];

interface BuiltTechniques { key: string; blocks: { draw: BlockDraw; sample: TechniqueSample }[] }
let builtTechniques: BuiltTechniques | null = null;

// Built once for a size and a style, not on every frame of the page's animation
const techniqueBlocks = (noteHeight: number, appearance: GameplayAppearance, rootPx: number): BuiltTechniques['blocks'] => {
  const key = `${noteHeight}|${appearance.noteStyle}|${rootPx}`;
  if (builtTechniques?.key === key) return builtTechniques.blocks;
  const blocks: BuiltTechniques['blocks'] = [];
  for (const sample of TECHNIQUE_SAMPLES) {
    const graphics = buildNoteGraphics(sample.notes, noteHeight, appearance.noteStyle, 1, 1, 0, FRET_FONT_FLOOR_REM * rootPx, true);
    const [block] = analyzeTechniques(sample.notes).blocks;
    if (block) blocks.push({ draw: createBlockDraw(block.indexes.map((index) => graphics[index]), block.links), sample });
  }
  builtTechniques = { key, blocks };
  return blocks;
};

const drawPreviewTechniques = (ctx: Canvas2D, layout: LaneLayout, kit: NoteKit, noteHeight: number, hitLineX: number, width: number, appearance: GameplayAppearance, rootPx: number): void => {
  if (!appearance.techniques.show) return;
  const labelPx = Math.max(0.7 * FRET_FONT_FLOOR_REM * rootPx, 0.3 * noteHeight);
  for (const { draw, sample } of techniqueBlocks(noteHeight, appearance, rootPx)) {
    const first = hitLineX + sample.at * width;
    for (let segment = 0; segment < draw.xs.length; segment++) {
      draw.xs[segment] = first + segment * noteHeight * SEGMENT_PITCH_RATIO;
      draw.states[segment] = sample.state;
    }
    drawTechniqueBlock(ctx, kit, draw, stringY(layout, draw.string), labelPx);
  }
};

// `guideAt` is where the guide loop stands; null leaves it out, for a page that draws it moving on top
export const drawGameplayPreview = (
  ctx: Canvas2D,
  width: number,
  height: number,
  appearance: GameplayAppearance,
  palette: GamePalette,
  guideAt: number | null = GUIDE_STATIC_AT_MS
): void => {
  const look = buildGameplayLook(palette, appearance);
  const { kit } = look;
  const hitLineX = Math.round(width * 0.38);
  const rootPx = readRootFontPx();
  const [layout] = layoutLanes(height, [6], rootPx);
  const noteHeight = noteHeightFor(layout, appearance.noteSize / 100, rootPx);

  ctx.fillStyle = look.palette.background;
  ctx.fillRect(0, 0, width, height);
  drawLaneBackground(ctx, layout, width, look.palette, null, hitLineX, look.strings, rootPx);

  const { effects } = appearance;
  const trail = effects.noteTrail ? trailFor(effects.intensity) : null;
  // Under the notes, as in the game
  if (guideAt !== null) drawPreviewGuide(ctx, width, height, appearance, palette, guideAt);
  const graphics = buildNoteGraphics(SAMPLES.map(sampleEvent), noteHeight, appearance.noteStyle, 1, 1, 0, FRET_FONT_FLOOR_REM * rootPx);
  graphics.forEach((graphic, index) => {
    const sample = SAMPLES[index];
    drawNoteGraphic(ctx, graphic, kit, hitLineX + sample.at * width, stringY(layout, sample.string), sample.state, noteHeight, trail);
  });

  drawPreviewTechniques(ctx, layout, kit, noteHeight, hitLineX, width, appearance, rootPx);

  if (effects.hitPulse) drawPulseRing(ctx, hitLineX, stringY(layout, 3), 0.35, look.palette.hit, effects.intensity, noteScaleOf(noteHeight));
};
