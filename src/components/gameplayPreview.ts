// A small, static picture of the gameplay for the appearance page: six strings and a few example notes, drawn
// with the same functions as the game (lane background, note styles, trail, pulse), so what is shown is what is played.

import type { GameplayAppearance } from '../appearance/types';
import { drawPulseRing } from './gameEffects';
import { buildGameplayLook } from './gameplayLook';
import { drawNoteGraphic, trailFor, type NoteState } from './noteStyles';
import {
  buildNoteGraphics,
  drawLaneBackground,
  layoutLanes,
  noteHeightFor,
  stringY,
  type Canvas2D,
  type GamePalette
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

export const drawGameplayPreview = (
  ctx: Canvas2D,
  width: number,
  height: number,
  appearance: GameplayAppearance,
  palette: GamePalette
): void => {
  const look = buildGameplayLook(palette, appearance);
  const { kit } = look;
  const hitLineX = Math.round(width * 0.38);
  const [layout] = layoutLanes(height, [6]);
  const noteHeight = noteHeightFor(layout);

  ctx.fillStyle = look.palette.background;
  ctx.fillRect(0, 0, width, height);
  drawLaneBackground(ctx, layout, width, look.palette, null, hitLineX, look.strings);

  const { effects } = appearance;
  const trail = effects.noteTrail ? trailFor(effects.intensity) : null;
  const graphics = buildNoteGraphics(SAMPLES.map(sampleEvent), 1, noteHeight, appearance.noteStyle);
  graphics.forEach((graphic, index) => {
    const sample = SAMPLES[index];
    drawNoteGraphic(ctx, graphic, kit, hitLineX + sample.at * width, stringY(layout, sample.string), sample.state, noteHeight, trail);
  });

  if (effects.hitPulse) drawPulseRing(ctx, hitLineX, stringY(layout, 3), 0.35, look.palette.hit, effects.intensity);
};
