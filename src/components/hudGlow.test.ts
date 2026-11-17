import { describe, expect, it } from 'vitest';
import { DEFAULT_APPEARANCE } from '../appearance/defaults';
import type { EffectSettings } from '../appearance/types';
import { COMBO_GLOW_FULL_AT } from './gameEffects';
import { comboGlowAlpha, comboGlowStyle, HUD_GLOW_MAX_ALPHA, HUD_GLOW_TRANSITION } from './hudGlow';

const on: EffectSettings = { ...DEFAULT_APPEARANCE.effects, comboGlow: true, intensity: 2 };
const off: EffectSettings = { ...DEFAULT_APPEARANCE.effects, comboGlow: false };

describe('comboGlowAlpha', () => {
  it('is zero when the effect is off, whatever the combo', () => {
    expect(comboGlowAlpha(0, off)).toBe(0);
    expect(comboGlowAlpha(200, off)).toBe(0);
  });

  it('grows with the combo and stops at the ceiling', () => {
    expect(comboGlowAlpha(0, on)).toBe(0);
    expect(comboGlowAlpha(10, on)).toBeGreaterThan(0);
    expect(comboGlowAlpha(10, on)).toBeLessThan(comboGlowAlpha(30, on));
    expect(comboGlowAlpha(COMBO_GLOW_FULL_AT, on)).toBeCloseTo(HUD_GLOW_MAX_ALPHA);
    expect(comboGlowAlpha(COMBO_GLOW_FULL_AT * 10, on)).toBeCloseTo(HUD_GLOW_MAX_ALPHA);
  });

  it('never goes over 0.3, even with the strongest intensity', () => {
    expect(comboGlowAlpha(1000, { ...on, intensity: 3 })).toBeLessThanOrEqual(0.3);
  });

  it('is softer at the lowest intensity', () => {
    expect(comboGlowAlpha(25, { ...on, intensity: 1 })).toBeLessThan(comboGlowAlpha(25, on));
  });
});

describe('comboGlowStyle', () => {
  it('returns nothing when the effect is off', () => {
    expect(comboGlowStyle(40, off)).toBeUndefined();
  });

  it('uses the signal color, a smooth transition of at least 400 ms and a growing shadow', () => {
    const low = comboGlowStyle(5, on);
    const high = comboGlowStyle(COMBO_GLOW_FULL_AT, on);
    expect(low?.textShadow).toContain('--color-signal-400');
    expect(low?.transition).toBe(HUD_GLOW_TRANSITION);
    expect(Number(/(\d+)ms/.exec(String(low?.transition))?.[1])).toBeGreaterThanOrEqual(400);
    expect(low?.textShadow).not.toBe(high?.textShadow);
    expect(String(high?.textShadow)).toMatch(/signal-400\) 30%/);
  });
});
