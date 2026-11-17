// Contract of the appearance system (see docs/aparencia.md). Everything the player can customize lives in
// AppearanceSettings; the Original theme with the defaults must look exactly like PRGB did before this feature.

export const THEME_IDS = ['original', 'refined', 'midnight-arcade', 'graphite-studio', 'analog-soul', 'electric-neon'] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export const UI_STYLES = ['soft', 'sharp', 'arcade'] as const;
export type UiStyle = (typeof UI_STYLES)[number];

export const FONT_PACKS = ['modern', 'technical', 'expressive'] as const; // Inter | IBM Plex | Space Grotesk (current look)
export type FontPack = (typeof FONT_PACKS)[number];

export const NOTE_STYLES = ['classic', 'arcade', 'minimal', 'neon', 'digital'] as const;
export type NoteStyle = (typeof NOTE_STYLES)[number];

export const STRING_SCHEMES = ['original', 'vibrant', 'pastel'] as const;
export type StringScheme = (typeof STRING_SCHEMES)[number];

export const LINE_STYLES = ['solid', 'dashed'] as const;
export type LineStyle = (typeof LINE_STYLES)[number];

export const STRING_THICKNESS = ['thin', 'normal', 'thick'] as const;
export type StringThickness = (typeof STRING_THICKNESS)[number];

export const BACKGROUND_STYLES = ['solid', 'gradient', 'grid', 'ambient'] as const;
export type BackgroundStyle = (typeof BACKGROUND_STYLES)[number];

export const GAMEPLAY_CONTRASTS = ['low', 'normal', 'high'] as const;
export type GameplayContrast = (typeof GAMEPLAY_CONTRASTS)[number];

export const EFFECT_INTENSITIES = [1, 2, 3] as const; // subtle, normal, strong
export type EffectIntensity = (typeof EFFECT_INTENSITIES)[number];

export interface StringSettings {
  thickness: StringThickness;
  intensity: number;    // 40-100 (%): how strong the string colors are against the lane
  laneOpacity: number;  // 30-100 (%): opacity of the lane backgrounds
  lineStyle: LineStyle;
  glow: number;         // 0-100 (%): brightness halo of the string lines; 0 = none (the original)
  contrast: GameplayContrast; // contrast of the gameplay background (the canvas surfaces)
  scheme: StringScheme;
}

export interface EffectSettings {
  hitPulse: boolean;
  perfectSpark: boolean;
  comboGlow: boolean;
  noteTrail: boolean;
  reactiveBackground: boolean;
  intensity: EffectIntensity;
}

export interface AppearanceSettings {
  themeId: ThemeId;
  uiStyle: UiStyle;
  font: FontPack;
  background: BackgroundStyle;
  noteStyle: NoteStyle;
  strings: StringSettings;
  effects: EffectSettings;
  // Master switch: no decorative effect at all (the effects above are ignored, glows and trails go off)
  reduceEffects: boolean;
  // Preset the settings started from; null = none. "Customized" is derived by comparing with the preset.
  presetId: ThemeId | null;
}

// What the canvas needs, already resolved; changes rarely, so it is read per frame without allocations
export interface GameplayAppearance {
  noteStyle: NoteStyle;
  strings: StringSettings;
  effects: EffectSettings; // all booleans false when reduceEffects or the system asks for reduced motion
}
