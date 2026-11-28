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
// How big the notes are drawn, in % of the size the track suggests for its height (100 = normal)
export const NOTE_SIZES = [80, 100, 125, 150] as const;
export type NoteSize = (typeof NOTE_SIZES)[number];

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

export const GUIDE_STYLES = ['shadow', 'hologram'] as const; // a soft dark shadow; the luminous glow
export type GuideStyle = (typeof GUIDE_STYLES)[number];

export const GUIDE_SHAPES = ['capsule', 'ellipse', 'rounded', 'note'] as const; // 'note' follows the shape of the chosen note style
export type GuideShape = (typeof GUIDE_SHAPES)[number];

// 'auto' is the look's own choice (dark for the shadow, the signal colour for the hologram); the others are fixed swatches
export const GUIDE_COLORS = ['auto', 'black', 'string', 'white', 'amber', 'cyan', 'violet', 'green', 'red'] as const;
export type GuideColor = (typeof GUIDE_COLORS)[number];

export const GUIDE_EASINGS = ['smooth', 'snap', 'elastic'] as const;
export type GuideEasing = (typeof GUIDE_EASINGS)[number];

export const GUIDE_CHORD_COVERS = ['between', 'played'] as const; // one shape over every string of a chord, or one per played string
export type GuideChordCover = (typeof GUIDE_CHORD_COVERS)[number];

// The detailed look of the guide. Percent fields are whole numbers in their range (see validate.ts).
export interface GuideShadowSettings {
  opacity: number;          // 20-100 (%): how dark the body is, before the intensity
  color: GuideColor;
  width: number;            // 80-180 (%): of the note; 100 is as big as the note
  height: number;           // 80-180 (%)
  blur: number;             // 0-100: softness of the edges; 0 = sharp
  offsetX: number;          // -50..50 (% of the note height): + moves the shadow to the right
  offsetY: number;          // -50..50 (% of the note height): + moves it down
  shape: GuideShape;
  outline: boolean;
  outlineWidth: number;     // 1-6 (px)
  outlineColor: GuideColor;
  trail: boolean;
  trailLength: number;      // 20-100 (%)
  trailOpacity: number;     // 10-100 (%)
  pulse: boolean;
  pulseStrength: number;    // 10-100 (%)
  hopMs: number;            // 100-600 (ms, real time): how long before the note the hop starts
  easing: GuideEasing;
  chordCover: GuideChordCover;
  showNext: boolean;        // a faint ghost on the set after the next one
  glow: number;             // 0-100: halo of the hologram style (the shadow style ignores it)
  preserveNote: boolean;    // the guide never hides the note: the hologram is a ring, notes keep their size and opacity
}

// The guide shadow: marks on the hit line which note is next, hopping to it as its time comes
export interface GuideSettings {
  enabled: boolean;
  intensity: EffectIntensity;
  style: GuideStyle;
  shadow: GuideShadowSettings;
}

// The marks of the guitar techniques on the track (hammer-ons, pull-offs, slides, vibrato, palm mute, bend sizes)
export interface TechniqueSettings {
  show: boolean;   // false = only the numbers, as before
  legend: boolean; // a small key of the symbols: in Aparência and on the first game
}

export interface AppearanceSettings {
  themeId: ThemeId;
  uiStyle: UiStyle;
  font: FontPack;
  background: BackgroundStyle;
  noteStyle: NoteStyle;
  // Size of the notes on the track; a taste of the player, kept when a theme is picked (like hitSounds)
  noteSize: NoteSize;
  // A taste of the player, kept when a theme is picked (like noteSize)
  techniques: TechniqueSettings;
  strings: StringSettings;
  effects: EffectSettings;
  guide: GuideSettings;
  // Sound of the Perfect/Good/Miss judgements; false = silent. The guide notes and the metronome are not part of it.
  hitSounds: boolean;
  // Master switch: no decorative effect at all (the effects above are ignored, glows and trails go off)
  reduceEffects: boolean;
  // Preset the settings started from; null = none. "Customized" is derived by comparing with the preset.
  presetId: ThemeId | null;
}

// What the canvas needs, already resolved; changes rarely, so it is read per frame without allocations
export interface GameplayAppearance {
  noteStyle: NoteStyle;
  noteSize: NoteSize;
  techniques: TechniqueSettings;
  strings: StringSettings;
  effects: EffectSettings; // all booleans false when reduceEffects or the system asks for reduced motion
  guide: GuideSettings; // kept with reduced motion (it is information, not decoration): the guide then moves without animating
  hitSounds: boolean;
  reducedMotion: boolean; // reduceEffects or the system preference
}
