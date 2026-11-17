import { describe, expect, it } from 'vitest';
import {
  ORIGINAL_THEME_ID, READABILITY_CHECKS, THEMES, contrastRatio, deriveTokens, findTheme, isHexColor, mix
} from './themes';

// The gameplay tokens no theme may touch: strings, players, hit line and the feedback colors
const GAMEPLAY_TOKENS = [
  '--color-string-1', '--color-string-2', '--color-string-3', '--color-string-4', '--color-string-5', '--color-string-6',
  '--color-player-1', '--color-player-2', '--color-play-signal', '--color-hit', '--color-near', '--color-miss', '--color-note-violet'
];

describe('themes', () => {
  it('has six themes, the first being the untouched original', () => {
    expect(THEMES).toHaveLength(6);
    expect(THEMES[0].id).toBe(ORIGINAL_THEME_ID);
    expect(THEMES[0].colors).toBeNull();
    expect(new Set(THEMES.map((theme) => theme.id)).size).toBe(6);
  });

  it('falls back to the original for an unknown or missing id', () => {
    expect(findTheme('nope').id).toBe(ORIGINAL_THEME_ID);
    expect(findTheme(null).id).toBe(ORIGINAL_THEME_ID);
  });

  it('writes valid colors only and never a gameplay token', () => {
    for (const theme of THEMES.filter((item) => item.colors)) {
      const tokens = deriveTokens(theme.colors!);
      for (const color of Object.values(theme.colors!)) expect(isHexColor(color)).toBe(true);
      for (const [name, value] of Object.entries(tokens)) {
        expect(GAMEPLAY_TOKENS).not.toContain(name);
        expect(isHexColor(value)).toBe(true);
      }
    }
  });

  it('maps the base colors onto the existing scales', () => {
    const refined = THEMES.find((theme) => theme.id === 'refined')!.colors!;
    const tokens = deriveTokens(refined);
    expect(tokens['--color-ink-950']).toBe(refined.background);
    expect(tokens['--color-ink-900']).toBe(refined.surface);
    expect(tokens['--color-ink-800']).toBe(refined.surfaceElevated);
    expect(tokens['--color-ink-700']).toBe(refined.border);
    expect(tokens['--color-ink-100']).toBe(refined.text);
    expect(tokens['--color-ink-400']).toBe(refined.textMuted);
    expect(tokens['--color-amp-400']).toBe(refined.primary);
    expect(tokens['--color-signal-400']).toBe(refined.secondary);
    expect(tokens['--color-success']).toBe(refined.success);
  });

  it.each(THEMES.filter((theme) => theme.colors).map((theme) => [theme.name, theme.colors!] as const))(
    '%s keeps text and controls readable', (_name, colors) => {
      for (const check of READABILITY_CHECKS(colors)) {
        expect(check.ratio, check.name).toBeGreaterThanOrEqual(check.min);
      }
    });

  it('uses the owner palettes and the renamed Analog Soul', () => {
    const byId = (id: string) => THEMES.find((theme) => theme.id === id)!;
    expect(THEMES.map((theme) => theme.id)).toEqual(['original', 'refined', 'midnight-arcade', 'graphite-studio', 'analog-soul', 'electric-neon']);
    expect(byId('analog-soul').name).toBe('Analog Soul');
    expect(byId('analog-soul').colors!.primary).toBe('#D6A65C');
    expect(byId('electric-neon').colors!.primary).toBe('#B7F34B');
    expect(findTheme('analog-vintage').id).toBe(ORIGINAL_THEME_ID);
  });

  it('computes WCAG contrast and linear mixes', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mix('#102030', '#102030', 0.7)).toBe('#102030');
  });
});
