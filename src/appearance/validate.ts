import { DEFAULT_APPEARANCE, DEFAULT_EFFECTS, DEFAULT_GUIDE, DEFAULT_GUIDE_SHADOW, DEFAULT_STRINGS } from './defaults';
import {
  BACKGROUND_STYLES, EFFECT_INTENSITIES, FONT_PACKS, GAMEPLAY_CONTRASTS, GUIDE_CHORD_COVERS, GUIDE_COLORS, GUIDE_EASINGS, GUIDE_SHAPES, GUIDE_STYLES, LINE_STYLES, NOTE_SIZES, NOTE_STYLES, STRING_SCHEMES,
  STRING_THICKNESS, THEME_IDS, UI_STYLES,
  type AppearanceSettings, type EffectIntensity, type EffectSettings, type GuideSettings, type GuideShadowSettings, type GuideStyle, type StringSettings, type TechniqueSettings, type ThemeId
} from './types';

export const APPEARANCE_STORAGE_KEY = 'prgb:appearance:v1';
export const APPEARANCE_VERSION = 1;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const oneOf = <T extends string | number>(value: unknown, list: readonly T[], fallback: T): T =>
  (list as readonly unknown[]).includes(value) ? (value as T) : fallback;

// Out of range or the wrong type goes back to the default of that field; it is never clamped
const inRange = (value: unknown, min: number, max: number, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : fallback;

const bool = (value: unknown, fallback: boolean): boolean => (typeof value === 'boolean' ? value : fallback);

// Name used by the temporary theme lab, kept readable for anyone who picked it
const LEGACY_THEME_IDS: Readonly<Record<string, ThemeId>> = { 'analog-vintage': 'analog-soul' };

export const parseThemeId = (value: unknown, fallback: ThemeId): ThemeId => {
  if (typeof value === 'string' && Object.hasOwn(LEGACY_THEME_IDS, value)) return LEGACY_THEME_IDS[value];
  return oneOf(value, THEME_IDS, fallback);
};

const validateStrings = (raw: unknown): StringSettings => {
  const input = isRecord(raw) ? raw : {};
  return {
    thickness: oneOf(input.thickness, STRING_THICKNESS, DEFAULT_STRINGS.thickness),
    intensity: inRange(input.intensity, 40, 100, DEFAULT_STRINGS.intensity),
    laneOpacity: inRange(input.laneOpacity, 30, 100, DEFAULT_STRINGS.laneOpacity),
    lineStyle: oneOf(input.lineStyle, LINE_STYLES, DEFAULT_STRINGS.lineStyle),
    glow: inRange(input.glow, 0, 100, DEFAULT_STRINGS.glow),
    contrast: oneOf(input.contrast, GAMEPLAY_CONTRASTS, DEFAULT_STRINGS.contrast),
    scheme: oneOf(input.scheme, STRING_SCHEMES, DEFAULT_STRINGS.scheme)
  };
};

const validateEffects = (raw: unknown): EffectSettings => {
  const input = isRecord(raw) ? raw : {};
  return {
    hitPulse: bool(input.hitPulse, DEFAULT_EFFECTS.hitPulse),
    perfectSpark: bool(input.perfectSpark, DEFAULT_EFFECTS.perfectSpark),
    comboGlow: bool(input.comboGlow, DEFAULT_EFFECTS.comboGlow),
    noteTrail: bool(input.noteTrail, DEFAULT_EFFECTS.noteTrail),
    reactiveBackground: bool(input.reactiveBackground, DEFAULT_EFFECTS.reactiveBackground),
    intensity: oneOf<EffectIntensity>(input.intensity, EFFECT_INTENSITIES, DEFAULT_EFFECTS.intensity)
  };
};

// Whole steps inside the range, like the sliders; anything else goes back to the default of that field
const inSteps = (value: unknown, min: number, max: number, step: number, fallback: number): number =>
  inRange(value, min, max, fallback) === value && ((value as number) - min) % step === 0 ? (value as number) : fallback;

const validateGuideShadow = (raw: unknown): GuideShadowSettings => {
  const input = isRecord(raw) ? raw : {};
  const d = DEFAULT_GUIDE_SHADOW;
  return {
    opacity: inSteps(input.opacity, 20, 100, 5, d.opacity),
    color: oneOf(input.color, GUIDE_COLORS, d.color),
    width: inSteps(input.width, 80, 180, 5, d.width),
    height: inSteps(input.height, 80, 180, 5, d.height),
    blur: inSteps(input.blur, 0, 100, 5, d.blur),
    offsetX: inSteps(input.offsetX, -50, 50, 5, d.offsetX),
    offsetY: inSteps(input.offsetY, -50, 50, 5, d.offsetY),
    shape: oneOf(input.shape, GUIDE_SHAPES, d.shape),
    outline: bool(input.outline, d.outline),
    outlineWidth: inSteps(input.outlineWidth, 1, 6, 1, d.outlineWidth),
    outlineColor: oneOf(input.outlineColor, GUIDE_COLORS, d.outlineColor),
    trail: bool(input.trail, d.trail),
    trailLength: inSteps(input.trailLength, 20, 100, 10, d.trailLength),
    trailOpacity: inSteps(input.trailOpacity, 10, 100, 10, d.trailOpacity),
    pulse: bool(input.pulse, d.pulse),
    pulseStrength: inSteps(input.pulseStrength, 10, 100, 10, d.pulseStrength),
    hopMs: inSteps(input.hopMs, 100, 600, 50, d.hopMs),
    easing: oneOf(input.easing, GUIDE_EASINGS, d.easing),
    chordCover: oneOf(input.chordCover, GUIDE_CHORD_COVERS, d.chordCover),
    showNext: bool(input.showNext, d.showNext),
    glow: inSteps(input.glow, 0, 100, 10, d.glow),
    preserveNote: bool(input.preserveNote, d.preserveNote)
  };
};

const validateGuide = (raw: unknown): GuideSettings => {
  const input = isRecord(raw) ? raw : {};
  return {
    enabled: bool(input.enabled, DEFAULT_GUIDE.enabled),
    intensity: oneOf<EffectIntensity>(input.intensity, EFFECT_INTENSITIES, DEFAULT_GUIDE.intensity),
    style: oneOf<GuideStyle>(input.style, GUIDE_STYLES, DEFAULT_GUIDE.style),
    shadow: validateGuideShadow(input.shadow)
  };
};

const validateTechniques = (raw: unknown): TechniqueSettings => {
  const input = isRecord(raw) ? raw : {};
  return {
    show: bool(input.show, DEFAULT_APPEARANCE.techniques.show),
    legend: bool(input.legend, DEFAULT_APPEARANCE.techniques.legend)
  };
};

const validatePresetId = (value: unknown): ThemeId | null => {
  if (value === null) return null;
  if (typeof value === 'string') return parseThemeId(value, DEFAULT_APPEARANCE.presetId ?? 'original');
  return DEFAULT_APPEARANCE.presetId;
};

/** Field by field: anything invalid becomes the default of that field and the rest is kept. Never throws. */
export const validateAppearance = (raw: unknown): AppearanceSettings => {
  const input = isRecord(raw) ? raw : {};
  return {
    themeId: parseThemeId(input.themeId, DEFAULT_APPEARANCE.themeId),
    uiStyle: oneOf(input.uiStyle, UI_STYLES, DEFAULT_APPEARANCE.uiStyle),
    font: oneOf(input.font, FONT_PACKS, DEFAULT_APPEARANCE.font),
    background: oneOf(input.background, BACKGROUND_STYLES, DEFAULT_APPEARANCE.background),
    noteStyle: oneOf(input.noteStyle, NOTE_STYLES, DEFAULT_APPEARANCE.noteStyle),
    noteSize: oneOf(input.noteSize, NOTE_SIZES, DEFAULT_APPEARANCE.noteSize),
    techniques: validateTechniques(input.techniques),
    strings: validateStrings(input.strings),
    effects: validateEffects(input.effects),
    guide: validateGuide(input.guide),
    hitSounds: bool(input.hitSounds, DEFAULT_APPEARANCE.hitSounds),
    reduceEffects: bool(input.reduceEffects, DEFAULT_APPEARANCE.reduceEffects),
    presetId: validatePresetId(input.presetId)
  };
};

export type StoredStatus = 'empty' | 'ok' | 'corrupt' | 'newer';

export interface ParsedStorage {
  status: StoredStatus;
  settings: AppearanceSettings;
}

const defaults = (status: StoredStatus): ParsedStorage => ({ status, settings: validateAppearance({}) });

/** Reads the stored text. A newer version is reported (the caller must not overwrite it); garbage means defaults. */
export const parseStoredAppearance = (text: string | null): ParsedStorage => {
  if (text === null) return defaults('empty');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return defaults('corrupt');
  }
  if (!isRecord(parsed) || typeof parsed.version !== 'number' || !Number.isInteger(parsed.version)) return defaults('corrupt');
  if (parsed.version > APPEARANCE_VERSION) return defaults('newer');
  if (parsed.version < 1) return defaults('corrupt');
  return { status: 'ok', settings: validateAppearance(parsed.settings) };
};

export const serializeAppearance = (settings: AppearanceSettings): string =>
  JSON.stringify({ version: APPEARANCE_VERSION, settings });
