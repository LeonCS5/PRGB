import type { AppearanceSettings, EffectSettings, StringSettings } from './types';

// Original look: Space Grotesk + Inter + JetBrains Mono, rounded surfaces, classic capsules, no glow, no effects
export const DEFAULT_STRINGS: StringSettings = {
  thickness: 'normal', intensity: 100, laneOpacity: 100, lineStyle: 'solid', glow: 0, contrast: 'normal', scheme: 'original'
};

export const DEFAULT_EFFECTS: EffectSettings = {
  hitPulse: false, perfectSpark: false, comboGlow: false, noteTrail: false, reactiveBackground: false, intensity: 2
};

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  themeId: 'original',
  uiStyle: 'soft',
  font: 'expressive',
  background: 'solid',
  noteStyle: 'classic',
  strings: DEFAULT_STRINGS,
  effects: DEFAULT_EFFECTS,
  reduceEffects: false,
  presetId: 'original'
};
