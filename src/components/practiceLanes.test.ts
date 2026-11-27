import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_STRINGS } from '../appearance/defaults';
import { drawLaneBackground, HIT_LINE_X, layoutLanes, type LaneLayout } from './practiceLanes';
import { createRecorder, installPath2D, ORIGINAL_PALETTE } from './testCanvas';

beforeAll(installPath2D);

const [solo] = layoutLanes(400, [6]);
const [first, second] = layoutLanes(400, [6, 4]);

describe('drawLaneBackground', () => {
  it('draws the subtle 3D fretboard consistently between explicit default strings and omitted strings', () => {
    const cases: Array<[LaneLayout, { text: string; color: string } | null, number | undefined]> = [
      [solo, null, undefined],
      [first, { text: 'JOGADOR 1 · CANAL 1', color: '#8cf1ff' }, undefined],
      [second, null, undefined],
      [solo, null, 880]
    ];
    for (const [lane, label, hitLineX] of cases) {
      const withDefaults = createRecorder();
      drawLaneBackground(withDefaults.ctx, lane, 1000, ORIGINAL_PALETTE, label, hitLineX, DEFAULT_STRINGS);
      const omitted = createRecorder();
      drawLaneBackground(omitted.ctx, lane, 1000, ORIGINAL_PALETTE, label, hitLineX);
      expect(omitted.log).toEqual(withDefaults.log);
      expect(withDefaults.log.length).toBeGreaterThan(50);
    }
  });

  const draw = (strings: Partial<typeof DEFAULT_STRINGS>) => {
    const { ctx, log } = createRecorder();
    drawLaneBackground(ctx, solo, 1000, ORIGINAL_PALETTE, null, HIT_LINE_X, { ...DEFAULT_STRINGS, ...strings });
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
