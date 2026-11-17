import { describe, expect, it } from 'vitest';
import { DEFAULT_APPEARANCE } from './defaults';
import { APPEARANCE_VERSION, parseStoredAppearance, serializeAppearance, validateAppearance } from './validate';

const stored = (settings: unknown, version: unknown = APPEARANCE_VERSION): string => JSON.stringify({ version, settings });

describe('validateAppearance', () => {
  it('returns the defaults for garbage of any shape', () => {
    for (const garbage of [undefined, null, 0, 'x', [], [1, 2], true, { strings: 'a', effects: 3 }]) {
      expect(validateAppearance(garbage)).toEqual(DEFAULT_APPEARANCE);
    }
  });

  it('keeps valid fields and resets only the invalid ones', () => {
    const result = validateAppearance({
      themeId: 'electric-neon', uiStyle: 'banana', font: 'technical', background: 42, noteStyle: 'neon',
      strings: { thickness: 'thick', intensity: 500, laneOpacity: 55, glow: '30', scheme: 'pastel', lineStyle: 'dotted', contrast: 'high' },
      effects: { hitPulse: true, comboGlow: 'yes', intensity: 7, noteTrail: true },
      reduceEffects: 'true', presetId: 'nope'
    });
    expect(result.themeId).toBe('electric-neon');
    expect(result.uiStyle).toBe(DEFAULT_APPEARANCE.uiStyle);
    expect(result.font).toBe('technical');
    expect(result.background).toBe(DEFAULT_APPEARANCE.background);
    expect(result.noteStyle).toBe('neon');
    expect(result.strings).toEqual({ ...DEFAULT_APPEARANCE.strings, thickness: 'thick', laneOpacity: 55, scheme: 'pastel', contrast: 'high' });
    expect(result.effects).toEqual({ ...DEFAULT_APPEARANCE.effects, hitPulse: true, noteTrail: true });
    expect(result.reduceEffects).toBe(false);
    expect(result.presetId).toBe(DEFAULT_APPEARANCE.presetId);
  });

  it('rejects numbers out of range, NaN and Infinity instead of clamping them', () => {
    for (const bad of [39, 101, -1, NaN, Infinity, '70']) {
      expect(validateAppearance({ strings: { intensity: bad } }).strings.intensity).toBe(DEFAULT_APPEARANCE.strings.intensity);
    }
    expect(validateAppearance({ strings: { intensity: 40 } }).strings.intensity).toBe(40);
    expect(validateAppearance({ strings: { laneOpacity: 29 } }).strings.laneOpacity).toBe(100);
    expect(validateAppearance({ strings: { glow: 100 } }).strings.glow).toBe(100);
    expect(validateAppearance({ strings: { glow: 101 } }).strings.glow).toBe(0);
  });

  it('accepts a null preset and the name the theme lab used for Analog Soul', () => {
    expect(validateAppearance({ presetId: null }).presetId).toBeNull();
    expect(validateAppearance({ themeId: 'analog-vintage' }).themeId).toBe('analog-soul');
  });

  it('does not trust prototype keys as theme ids', () => {
    expect(validateAppearance({ themeId: '__proto__' }).themeId).toBe('original');
    expect(validateAppearance({ themeId: 'constructor' }).themeId).toBe('original');
  });
});

describe('parseStoredAppearance', () => {
  it('reports empty, corrupt and newer without throwing', () => {
    expect(parseStoredAppearance(null).status).toBe('empty');
    for (const text of ['{', '', 'null', '[]', '"x"', '{"version":"1"}', '{"version":1.5}', '{"version":0}', '{"version":-3}']) {
      const result = parseStoredAppearance(text);
      expect(result.status).toBe('corrupt');
      expect(result.settings).toEqual(DEFAULT_APPEARANCE);
    }
    const newer = parseStoredAppearance(stored({ themeId: 'refined' }, APPEARANCE_VERSION + 1));
    expect(newer.status).toBe('newer');
    expect(newer.settings).toEqual(DEFAULT_APPEARANCE);
  });

  it('round-trips a saved look', () => {
    const settings = validateAppearance({ themeId: 'refined', uiStyle: 'sharp', presetId: 'refined' });
    const parsed = parseStoredAppearance(serializeAppearance(settings));
    expect(parsed.status).toBe('ok');
    expect(parsed.settings).toEqual(settings);
  });

  it('uses the defaults when the settings object is missing or wrong', () => {
    expect(parseStoredAppearance('{"version":1}').settings).toEqual(DEFAULT_APPEARANCE);
    expect(parseStoredAppearance('{"version":1,"settings":7}').settings).toEqual(DEFAULT_APPEARANCE);
  });
});
