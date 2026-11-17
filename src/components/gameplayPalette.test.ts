import { describe, expect, it } from 'vitest';
import { DEFAULT_STRINGS } from '../appearance/defaults';
import { contrastRatio, mixColors, parseHex, readableOn, resolveGameplayPalette, STRING_SCHEME_COLORS } from './gameplayPalette';
import type { GamePalette } from './practiceLanes';
import { ORIGINAL_PALETTE } from './testCanvas';

const distance = (a: string, b: string): number => {
  const x = parseHex(a)!;
  const y = parseHex(b)!;
  return Math.hypot(x.r - y.r, x.g - y.g, x.b - y.b);
};

const minPairDistance = (colors: readonly string[]): number => {
  let min = Infinity;
  for (let i = 0; i < colors.length; i++) for (let j = i + 1; j < colors.length; j++) min = Math.min(min, distance(colors[i], colors[j]));
  return min;
};

describe('string schemes', () => {
  it('give six hex colors each, in string order', () => {
    for (const scheme of ['vibrant', 'pastel'] as const) {
      expect(STRING_SCHEME_COLORS[scheme]).toHaveLength(6);
      for (const color of STRING_SCHEME_COLORS[scheme]) expect(parseHex(color)).not.toBeNull();
    }
    expect(STRING_SCHEME_COLORS.vibrant[0]).toBe('#ff3d9a'); // string 1 first
    expect(STRING_SCHEME_COLORS.vibrant[5]).toBe('#8f5cff'); // string 6 last
  });

  it('keep the six colors of each scheme tell-apart (minimum distance in RGB)', () => {
    expect(minPairDistance(STRING_SCHEME_COLORS.vibrant)).toBeGreaterThanOrEqual(90);
    expect(minPairDistance(STRING_SCHEME_COLORS.pastel)).toBeGreaterThanOrEqual(55);
    // The original mapping is the reference the others are held to
    expect(minPairDistance(ORIGINAL_PALETTE.strings)).toBeGreaterThanOrEqual(45);
  });

  it('pastel reaches 3:1 against the lane of the Original theme (and so does vibrant)', () => {
    for (const color of STRING_SCHEME_COLORS.pastel) expect(contrastRatio(color, ORIGINAL_PALETTE.rail)).toBeGreaterThanOrEqual(3);
    for (const color of STRING_SCHEME_COLORS.vibrant) expect(contrastRatio(color, ORIGINAL_PALETTE.rail)).toBeGreaterThanOrEqual(3);
  });

  it('resolves to the very same palette for the defaults (the original look)', () => {
    expect(resolveGameplayPalette(ORIGINAL_PALETTE, DEFAULT_STRINGS)).toBe(ORIGINAL_PALETTE);
  });

  it('swaps only the strings for a scheme and never touches hit, near, miss, signal or ink', () => {
    const resolved = resolveGameplayPalette(ORIGINAL_PALETTE, { ...DEFAULT_STRINGS, scheme: 'vibrant' });
    expect(resolved.strings).toEqual([...STRING_SCHEME_COLORS.vibrant]);
    for (const key of ['hit', 'near', 'miss', 'signal', 'ink', 'background', 'rail', 'divider', 'players'] as const) {
      expect(resolved[key]).toEqual(ORIGINAL_PALETTE[key]);
    }
  });

  it('mixes the string colors toward the lane when the intensity drops', () => {
    const resolved = resolveGameplayPalette(ORIGINAL_PALETTE, { ...DEFAULT_STRINGS, intensity: 40 });
    resolved.strings.forEach((color, index) => {
      expect(color).toBe(mixColors(ORIGINAL_PALETTE.strings[index], ORIGINAL_PALETTE.rail, 0.6));
      expect(contrastRatio(color, ORIGINAL_PALETTE.rail)).toBeLessThan(contrastRatio(ORIGINAL_PALETTE.strings[index], ORIGINAL_PALETTE.rail));
    });
  });

  it('low contrast brings the surfaces together and high pulls the field away from the lane', () => {
    const gap = (palette: GamePalette) => contrastRatio(palette.background, palette.rail);
    const normal = gap(ORIGINAL_PALETTE);
    expect(gap(resolveGameplayPalette(ORIGINAL_PALETTE, { ...DEFAULT_STRINGS, contrast: 'low' }))).toBeLessThan(normal);
    expect(gap(resolveGameplayPalette(ORIGINAL_PALETTE, { ...DEFAULT_STRINGS, contrast: 'high' }))).toBeGreaterThan(normal);
  });
});

describe('color helpers', () => {
  it('mix and parse round trip, and an unparsable color comes back untouched', () => {
    expect(mixColors('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mixColors('oklch(0.5 0.1 20)', '#ffffff', 0.5)).toBe('oklch(0.5 0.1 20)');
    expect(parseHex('#abc')).toEqual({ r: 170, g: 187, b: 204 });
  });

  it('readableOn prefers the first readable candidate and falls back to the most readable', () => {
    expect(readableOn('#ffffff', ['#000000', '#ffffff'])).toBe('#000000');
    expect(readableOn('#000000', ['#000000', '#ffffff'])).toBe('#ffffff');
    expect(readableOn('#808080', ['#777777', '#999999'])).toBe('#999999'); // best of two poor ones
  });
});
