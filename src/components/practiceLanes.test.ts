import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_STRINGS } from '../appearance/defaults';
import { drawLaneBackground, hitLineX, layoutLanes, stringY, type GamePalette, type LaneLayout } from './practiceLanes';
import { createRecorder, installPath2D, ORIGINAL_PALETTE } from './testCanvas';

beforeAll(installPath2D);

// The lane the game drew before the string settings existed, copied from practiceLanes as it was (the hit line is now
// a share of the width, `hitLineX(width)`, and the name of the player sits beside it)
const legacyLane = (ctx: CanvasRenderingContext2D, lane: LaneLayout, width: number, palette: GamePalette, label: { text: string; color: string } | null, lineX: number = hitLineX(width)): void => {
  const availableHeight = lane.height - lane.topMargin * 2;
  for (let s = 1; s <= lane.stringCount; s++) {
    const y = stringY(lane, s);
    const color = palette.strings[s - 1] || palette.muted;
    ctx.beginPath();
    ctx.strokeStyle = palette.rail;
    ctx.lineWidth = 14;
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
    ctx.font = 'bold 13px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = palette.background;
    const labelHeight = Math.min(26, lane.stringSpacing * 0.9);
    ctx.fillRect(10, y - labelHeight / 2, 62, labelHeight);
    ctx.fillStyle = color;
    ctx.fillText(`${s} / ${['e', 'B', 'G', 'D', 'A', 'E'][s - 1] || s}`, 18, y);
  }
  const top = lane.top + lane.topMargin;
  const grad = ctx.createLinearGradient(lineX - 4, 0, lineX + 4, 0);
  grad.addColorStop(0, palette.signal + '1a');
  grad.addColorStop(0.5, palette.signal);
  grad.addColorStop(1, palette.signal + '1a');
  ctx.fillStyle = grad as unknown as string;
  ctx.fillRect(lineX - 8, top - 20, 16, availableHeight + 40);
  ctx.beginPath();
  ctx.strokeStyle = palette.signal;
  ctx.lineWidth = 3;
  ctx.shadowColor = palette.signal;
  ctx.shadowBlur = 16;
  ctx.moveTo(lineX, top - 20);
  ctx.lineTo(lineX, top + availableHeight + 20);
  ctx.stroke();
  ctx.shadowBlur = 0;
  if (label) {
    ctx.font = 'bold 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = label.color;
    ctx.fillText(label.text, lineX + 18, lane.top + Math.max(10, lane.topMargin / 2 - 8));
  }
};

const [solo] = layoutLanes(400, [6]);
const [first, second] = layoutLanes(400, [6, 4]);

describe('drawLaneBackground', () => {
  it('draws the same instructions as before with the default string settings (solo, duo lane, Play Free line)', () => {
    const cases: Array<[LaneLayout, { text: string; color: string } | null, number | undefined]> = [
      [solo, null, undefined],
      [first, { text: 'JOGADOR 1 · CANAL 1', color: '#8cf1ff' }, undefined],
      [second, null, undefined],
      [solo, null, 880]
    ];
    for (const [lane, label, lineX] of cases) {
      const before = createRecorder();
      legacyLane(before.ctx, lane, 1000, ORIGINAL_PALETTE, label, lineX);
      const withDefaults = createRecorder();
      drawLaneBackground(withDefaults.ctx, lane, 1000, ORIGINAL_PALETTE, label, lineX, DEFAULT_STRINGS);
      const omitted = createRecorder();
      drawLaneBackground(omitted.ctx, lane, 1000, ORIGINAL_PALETTE, label, lineX);
      expect(withDefaults.log).toEqual(before.log);
      expect(omitted.log).toEqual(before.log);
      expect(before.log.length).toBeGreaterThan(50);
    }
  });

  const draw = (strings: Partial<typeof DEFAULT_STRINGS>) => {
    const { ctx, log } = createRecorder();
    drawLaneBackground(ctx, solo, 1000, ORIGINAL_PALETTE, null, hitLineX(1000), { ...DEFAULT_STRINGS, ...strings });
    return log;
  };

  it('thickness sets the width of the colored line', () => {
    const widths = (thickness: 'thin' | 'normal' | 'thick') => new Set(draw({ thickness }).filter((l) => l.startsWith('lineWidth=')).map((l) => l.slice(10)));
    expect(widths('thin').has('1.5')).toBe(true);
    expect(widths('normal').has('2.5')).toBe(true);
    expect(widths('thick').has('4')).toBe(true);
  });

  it('dashed draws the colored line segmented and then restores it; solid never touches the dash', () => {
    expect(draw({}).some((l) => l.startsWith('setLineDash'))).toBe(false);
    const log = draw({ lineStyle: 'dashed' });
    expect(log.filter((l) => l.startsWith('setLineDash([14,6])'))).toHaveLength(6);
    expect(log.filter((l) => l === 'setLineDash([])')).toHaveLength(6);
  });

  it('glow adds a translucent wider halo per string and no shadowBlur beyond the existing hit line', () => {
    const none = draw({});
    const glow = draw({ glow: 100 });
    expect(glow.filter((l) => l.startsWith('stroke(')).length).toBe(none.filter((l) => l.startsWith('stroke(')).length + 6);
    expect(glow.filter((l) => l.startsWith('shadowBlur=')).length).toBe(none.filter((l) => l.startsWith('shadowBlur=')).length);
    expect(glow.some((l) => l.startsWith('globalAlpha=0.32'))).toBe(true);
  });

  it('lane opacity fades only the lane strip and puts the alpha back', () => {
    const log = draw({ laneOpacity: 50 });
    expect(log.filter((l) => l === 'globalAlpha=0.5')).toHaveLength(6);
    expect(log.filter((l) => l === 'globalAlpha=1')).toHaveLength(6);
    expect(draw({}).some((l) => l.startsWith('globalAlpha'))).toBe(false);
  });
});
