import { describe, expect, it } from 'vitest';
import { DEFAULT_APPEARANCE } from './defaults';
import { PRESET_LOOKS, getPreset, isPresetCustomized } from './presets';
import { THEME_IDS } from './types';
import { THEMES } from './themes';
import { validateAppearance } from './validate';

describe('presets', () => {
  it('has one preset per theme and Original is exactly the defaults', () => {
    expect(Object.keys(PRESET_LOOKS).sort()).toEqual([...THEME_IDS].sort());
    expect(THEMES.map((theme) => theme.id)).toEqual([...THEME_IDS]);
    expect(getPreset('original')).toEqual(DEFAULT_APPEARANCE);
  });

  it('every preset is valid as is and points to its own theme', () => {
    for (const id of THEME_IDS) {
      const preset = getPreset(id);
      expect(validateAppearance(preset)).toEqual(preset);
      expect(preset.themeId).toBe(id);
      expect(preset.presetId).toBe(id);
      expect(isPresetCustomized(preset)).toBe(false);
    }
  });

  it('the themes are really different looks, not just colors', () => {
    expect(getPreset('electric-neon').noteStyle).toBe('neon');
    expect(getPreset('midnight-arcade').uiStyle).toBe('arcade');
    expect(getPreset('graphite-studio').font).toBe('technical');
    expect(getPreset('analog-soul').background).toBe('ambient');
    expect(getPreset('electric-neon').strings.glow).toBeGreaterThan(0);
  });

  it('keeps the reduce-effects choice and never shares objects with the preset table', () => {
    const preset = getPreset('refined', true);
    expect(preset.reduceEffects).toBe(true);
    preset.strings.glow = 99;
    expect(getPreset('refined').strings.glow).toBe(0);
  });

  it('keeps the hit sounds choice when a preset is applied and treats it as outside the look', () => {
    expect(getPreset('refined', false, false).hitSounds).toBe(false);
    expect(getPreset('refined').hitSounds).toBe(true);
    expect(isPresetCustomized({ ...getPreset('refined'), hitSounds: false })).toBe(false);
  });

  it('every preset starts with the guide shadow on, and the guide is not part of what makes a look customized', () => {
    for (const id of THEME_IDS) expect(PRESET_LOOKS[id].guide).toMatchObject({ enabled: true, intensity: 2, style: 'shadow' });
    const base = getPreset('refined');
    expect(isPresetCustomized({ ...base, guide: { ...base.guide, enabled: false } })).toBe(false);
    expect(isPresetCustomized({ ...base, guide: { ...base.guide, intensity: 3 } })).toBe(false);
  });

  it('takes the guide the player already has when one is given', () => {
    const own = { ...getPreset('original').guide, enabled: false, style: 'hologram' as const };
    expect(getPreset('refined', false, true, own).guide).toEqual(own);
  });

  it('derives "customized" by comparing with the preset', () => {
    const base = getPreset('midnight-arcade');
    expect(isPresetCustomized({ ...base, reduceEffects: true })).toBe(false);
    expect(isPresetCustomized({ ...base, font: 'modern' })).toBe(true);
    expect(isPresetCustomized({ ...base, strings: { ...base.strings, glow: 10 } })).toBe(true);
    expect(isPresetCustomized({ ...base, effects: { ...base.effects, noteTrail: true } })).toBe(true);
    expect(isPresetCustomized({ ...base, themeId: 'refined' })).toBe(true);
    expect(isPresetCustomized({ ...base, presetId: null })).toBe(true);
  });
});
