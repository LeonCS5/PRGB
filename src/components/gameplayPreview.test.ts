import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_EFFECTS, DEFAULT_STRINGS } from '../appearance/defaults';
import { NOTE_STYLES, STRING_SCHEMES, type GameplayAppearance } from '../appearance/types';
import { buildGameplayLook, isCurrentLook } from './gameplayLook';
import { drawGameplayPreview } from './gameplayPreview';
import { createRecorder, installPath2D, ORIGINAL_PALETTE } from './testCanvas';

beforeAll(installPath2D);

const appearance = (over: Partial<GameplayAppearance> = {}): GameplayAppearance => ({
  noteStyle: 'classic', strings: DEFAULT_STRINGS, effects: DEFAULT_EFFECTS, ...over
});

describe('drawGameplayPreview', () => {
  it('draws six strings and six sample notes for every style and scheme without throwing', () => {
    for (const noteStyle of NOTE_STYLES) {
      for (const scheme of STRING_SCHEMES) {
        const { ctx, log } = createRecorder();
        drawGameplayPreview(ctx, 320, 150, appearance({ noteStyle, strings: { ...DEFAULT_STRINGS, scheme } }), ORIGINAL_PALETTE);
        expect(log.filter((line) => line.startsWith('fillText(')).length, `${noteStyle} ${scheme}`).toBe(6 + 6 * 2); // string labels + fret and name per note
        expect(log.filter((line) => line.startsWith('fillRect(0,0,320,150)')).length).toBe(1);
      }
    }
  });

  it('uses the string colors of the chosen scheme', () => {
    const { ctx, log } = createRecorder();
    drawGameplayPreview(ctx, 320, 150, appearance({ strings: { ...DEFAULT_STRINGS, scheme: 'vibrant' } }), ORIGINAL_PALETTE);
    expect(log).toContain('strokeStyle=#ff3d9a');
    expect(log).not.toContain(`strokeStyle=${ORIGINAL_PALETTE.strings[0]}`);
  });

  it('shows the note trail and the pulse only when those effects are on', () => {
    const count = (effects: Partial<typeof DEFAULT_EFFECTS>) => {
      const { ctx, log } = createRecorder();
      drawGameplayPreview(ctx, 320, 150, appearance({ effects: { ...DEFAULT_EFFECTS, ...effects } }), ORIGINAL_PALETTE);
      return { fills: log.filter((l) => l.startsWith('fill(')).length, arcs: log.filter((l) => l.startsWith('arc(')).length };
    };
    expect(count({}).arcs).toBe(0);
    expect(count({ hitPulse: true }).arcs).toBe(1);
    expect(count({ noteTrail: true }).fills).toBeGreaterThan(count({}).fills);
  });

  it('draws with a tiny size too', () => {
    const { ctx, log } = createRecorder();
    expect(() => drawGameplayPreview(ctx, 120, 60, appearance({ noteStyle: 'digital' }), ORIGINAL_PALETTE)).not.toThrow();
    expect(log.length).toBeGreaterThan(50);
  });
});

describe('gameplay look', () => {
  it('is current while the theme palette and the note and string settings are unchanged, by value', () => {
    const look = buildGameplayLook(ORIGINAL_PALETTE, appearance());
    expect(isCurrentLook(look, ORIGINAL_PALETTE, appearance({ strings: { ...DEFAULT_STRINGS } }))).toBe(true);
    expect(isCurrentLook(look, ORIGINAL_PALETTE, appearance({ noteStyle: 'neon' }))).toBe(false);
    expect(isCurrentLook(look, ORIGINAL_PALETTE, appearance({ strings: { ...DEFAULT_STRINGS, glow: 10 } }))).toBe(false);
    expect(isCurrentLook(look, { ...ORIGINAL_PALETTE }, appearance())).toBe(false);
  });

  it('ignores the effects settings (they are read from a ref, not rebuilt)', () => {
    const look = buildGameplayLook(ORIGINAL_PALETTE, appearance());
    expect(isCurrentLook(look, ORIGINAL_PALETTE, appearance({ effects: { ...DEFAULT_EFFECTS, hitPulse: true } }))).toBe(true);
  });

  it('keeps the base palette object with the defaults', () => {
    expect(buildGameplayLook(ORIGINAL_PALETTE, appearance()).palette).toBe(ORIGINAL_PALETTE);
  });
});
