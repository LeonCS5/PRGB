import type { AppearanceSettings, EffectSettings, GuideSettings, GuideShadowSettings, StringSettings } from './types';

// Original look: Space Grotesk + Inter + JetBrains Mono, rounded surfaces, classic capsules, no glow, no effects
export const DEFAULT_STRINGS: StringSettings = {
  thickness: 'normal', intensity: 100, laneOpacity: 100, lineStyle: 'solid', glow: 0, contrast: 'normal', scheme: 'original'
};

export const DEFAULT_EFFECTS: EffectSettings = {
  hitPulse: false, perfectSpark: false, comboGlow: false, noteTrail: false, reactiveBackground: false, intensity: 2
};

// "Destaque": a dark body bigger than the note, sitting behind it with a visible rim around
export const DEFAULT_GUIDE_SHADOW: GuideShadowSettings = {
  opacity: 80, color: 'auto', width: 140, height: 140, blur: 30, offsetX: 0, offsetY: 6, shape: 'capsule',
  outline: true, outlineWidth: 2, outlineColor: 'auto', trail: true, trailLength: 60, trailOpacity: 50,
  pulse: true, pulseStrength: 50, hopMs: 280, easing: 'smooth', chordCover: 'between', showNext: false, glow: 60, preserveNote: true
};

export const DEFAULT_GUIDE: GuideSettings = { enabled: true, intensity: 2, style: 'shadow', shadow: DEFAULT_GUIDE_SHADOW };

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  themeId: 'original',
  uiStyle: 'soft',
  font: 'expressive',
  background: 'solid',
  noteStyle: 'classic',
  noteSize: 100,
  techniques: { show: true, legend: true },
  strings: DEFAULT_STRINGS,
  effects: DEFAULT_EFFECTS,
  guide: DEFAULT_GUIDE,
  hitSounds: true,
  reduceEffects: false,
  presetId: 'original'
};
