import { DEFAULT_APPEARANCE, DEFAULT_EFFECTS, DEFAULT_GUIDE, DEFAULT_STRINGS } from './defaults';
import type { AppearanceSettings, GuideSettings, NoteSize, TechniqueSettings, ThemeId } from './types';

// Each theme is a complete look: colors + component style + type + notes + strings + background + effects.
// A preset never carries reduceEffects, hitSounds, noteSize or techniques: they are choices of the player (accessibility and taste), kept when a preset is applied.
export type PresetLook = Omit<AppearanceSettings, 'presetId' | 'reduceEffects' | 'hitSounds' | 'noteSize' | 'techniques'>;

const look = (overrides: Partial<PresetLook> & { themeId: ThemeId }): PresetLook => ({
  ...DEFAULT_APPEARANCE,
  ...overrides,
  strings: { ...DEFAULT_STRINGS, ...overrides.strings },
  effects: { ...DEFAULT_EFFECTS, ...overrides.effects },
  guide: { ...DEFAULT_GUIDE, ...overrides.guide, shadow: { ...DEFAULT_GUIDE.shadow, ...overrides.guide?.shadow } }
});

export const PRESET_LOOKS: Readonly<Record<ThemeId, PresetLook>> = {
  original: look({ themeId: 'original' }),
  refined: look({ themeId: 'refined', uiStyle: 'soft', font: 'modern', noteStyle: 'classic', background: 'solid' }),
  'midnight-arcade': look({
    themeId: 'midnight-arcade', uiStyle: 'arcade', font: 'expressive', noteStyle: 'arcade', background: 'gradient',
    strings: { ...DEFAULT_STRINGS, scheme: 'vibrant' },
    effects: { ...DEFAULT_EFFECTS, hitPulse: true, comboGlow: true }
  }),
  'graphite-studio': look({ themeId: 'graphite-studio', uiStyle: 'sharp', font: 'technical', noteStyle: 'minimal', background: 'solid' }),
  'analog-soul': look({ themeId: 'analog-soul', uiStyle: 'soft', font: 'expressive', noteStyle: 'classic', background: 'ambient' }),
  'electric-neon': look({
    themeId: 'electric-neon', uiStyle: 'sharp', font: 'technical', noteStyle: 'neon', background: 'grid',
    strings: { ...DEFAULT_STRINGS, scheme: 'vibrant', glow: 35 },
    effects: { ...DEFAULT_EFFECTS, hitPulse: true }
  })
};

// The guide, like the hit sounds, is the player's own taste and many options deep: picking a theme must not wipe it
export const getPreset = (id: ThemeId, reduceEffects = false, hitSounds = DEFAULT_APPEARANCE.hitSounds, guide: GuideSettings = PRESET_LOOKS[id].guide, noteSize: NoteSize = DEFAULT_APPEARANCE.noteSize, techniques: TechniqueSettings = DEFAULT_APPEARANCE.techniques): AppearanceSettings => {
  const preset = PRESET_LOOKS[id];
  return { ...preset, strings: { ...preset.strings }, effects: { ...preset.effects }, guide: { ...guide, shadow: { ...guide.shadow } }, reduceEffects, hitSounds, noteSize, techniques: { ...techniques }, presetId: id };
};

const sameLook = (a: PresetLook, b: PresetLook): boolean =>
  a.themeId === b.themeId && a.uiStyle === b.uiStyle && a.font === b.font && a.background === b.background
  && a.noteStyle === b.noteStyle
  && (Object.keys(a.strings) as (keyof PresetLook['strings'])[]).every((key) => a.strings[key] === b.strings[key])
  && (Object.keys(a.effects) as (keyof PresetLook['effects'])[]).every((key) => a.effects[key] === b.effects[key]);

/** True when the player changed anything from the preset they started from (or never used one). The guide is not part of a preset's look. */
export const isPresetCustomized = (settings: AppearanceSettings): boolean =>
  settings.presetId === null || !sameLook(settings, PRESET_LOOKS[settings.presetId]);
