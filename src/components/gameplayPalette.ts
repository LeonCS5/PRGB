// Colors of the canvas that depend on the appearance settings: the string color schemes, the intensity of the
// string colors and the contrast of the gameplay surfaces. Pure functions, resolved once per settings change.

import type { GameplayContrast, StringScheme, StringSettings } from '../appearance/types';
import type { GamePalette } from './practiceLanes';

// Six colors per scheme, in string order (1 = high e ... 6 = low E). They do not depend on the theme.
export const STRING_SCHEME_COLORS: Record<Exclude<StringScheme, 'original'>, readonly string[]> = {
  vibrant: ['#ff3d9a', '#ff8a00', '#ffe600', '#19e65c', '#00c8ff', '#8f5cff'],
  pastel: ['#f7a1c8', '#ffb48f', '#f6f29a', '#a5e6a8', '#9ad4f5', '#c3aef2']
};

export const STRING_THICKNESS_PX = { thin: 1.5, normal: 2.5, thick: 4 } as const;

export interface Rgb { r: number; g: number; b: number }

export const parseHex = (value: string): Rgb | null => {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  if (!match) return null;
  let hex = match[1];
  if (hex.length === 3) hex = hex.split('').map((char) => char + char).join('');
  const number = parseInt(hex, 16);
  return { r: (number >> 16) & 255, g: (number >> 8) & 255, b: number & 255 };
};

const channel = (value: number): string => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');

// from * (1 - t) + to * t; t outside 0..1 pushes away from `to`. An unparsable color is returned as it came.
export const mixColors = (from: string, to: string, t: number): string => {
  const a = parseHex(from);
  const b = parseHex(to);
  if (!a || !b) return from;
  return `#${channel(a.r + (b.r - a.r) * t)}${channel(a.g + (b.g - a.g) * t)}${channel(a.b + (b.b - a.b) * t)}`;
};

const linear = (value: number): number => {
  const s = value / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

export const luminance = (color: string): number => {
  const rgb = parseHex(color);
  return rgb ? 0.2126 * linear(rgb.r) + 0.7152 * linear(rgb.g) + 0.0722 * linear(rgb.b) : 0;
};

export const contrastRatio = (a: string, b: string): number => {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

// First candidate readable on `background` (4.5:1), else the most readable one
export const readableOn = (background: string, candidates: readonly string[]): string => {
  let best = candidates[0];
  let bestRatio = 0;
  for (const candidate of candidates) {
    const ratio = contrastRatio(candidate, background);
    if (ratio >= 4.5) return candidate;
    if (ratio > bestRatio) {
      best = candidate;
      bestRatio = ratio;
    }
  }
  return best;
};

const SURFACE_MIX = 0.4;

const surfaces = (palette: GamePalette, contrast: GameplayContrast): Pick<GamePalette, 'background' | 'rail' | 'divider'> => {
  const { background, rail, divider } = palette;
  if (contrast === 'low') {
    // Surfaces closer to each other: the lanes stand out less from the field
    const softBackground = mixColors(background, rail, SURFACE_MIX);
    return { background: softBackground, rail: mixColors(rail, background, SURFACE_MIX), divider: mixColors(divider, softBackground, SURFACE_MIX) };
  }
  // High: the field moves away from the lane color
  return { background: mixColors(background, rail, -0.5), rail, divider };
};

/**
 * The palette the canvas really draws with. The Original scheme, full intensity and normal contrast give back
 * the same object (so the default look is the unchanged one); hit/near/miss, signal and ink are never touched.
 */
export const resolveGameplayPalette = (base: GamePalette, strings: Pick<StringSettings, 'scheme' | 'intensity' | 'contrast'>): GamePalette => {
  const { scheme, intensity, contrast } = strings;
  if (scheme === 'original' && intensity >= 100 && contrast === 'normal') return base;
  const scheme6 = scheme === 'original' ? base.strings : STRING_SCHEME_COLORS[scheme];
  const surface = contrast === 'normal' ? null : surfaces(base, contrast);
  const rail = surface ? surface.rail : base.rail;
  const t = 1 - Math.max(0, Math.min(100, intensity)) / 100;
  return {
    ...base,
    ...surface,
    strings: intensity >= 100 ? [...scheme6] : scheme6.map((color) => mixColors(color, rail, t))
  };
};

export const sameStringLook = (a: StringSettings, b: StringSettings): boolean =>
  a.thickness === b.thickness && a.intensity === b.intensity && a.laneOpacity === b.laneOpacity &&
  a.lineStyle === b.lineStyle && a.glow === b.glow && a.contrast === b.contrast && a.scheme === b.scheme;
