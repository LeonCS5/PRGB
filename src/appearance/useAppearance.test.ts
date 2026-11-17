import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_APPEARANCE } from './defaults';
import { getPreset } from './presets';
import { fakeRoot, memoryStorage, type FakeRoot } from './testHelpers';
import { APPEARANCE_STORAGE_KEY } from './validate';

type Store = typeof import('./useAppearance');

interface Env {
  storage: ReturnType<typeof memoryStorage>;
  root: FakeRoot;
  setReducedMotion(value: boolean): void;
}

// Each test gets a fresh module (the store keeps its state at module level) and a fresh fake browser
const load = async (initial: Record<string, string> = {}, reducedMotion = false): Promise<{ store: Store; env: Env }> => {
  vi.resetModules();
  const storage = memoryStorage(initial);
  const root = fakeRoot();
  let reduced = reducedMotion;
  const changeListeners = new Set<() => void>();
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('document', { documentElement: root });
  vi.stubGlobal('matchMedia', () => ({
    get matches() { return reduced; },
    addEventListener: (_type: string, listener: () => void) => { changeListeners.add(listener); }
  }));
  const store = await import('./useAppearance');
  return {
    store,
    env: { storage, root, setReducedMotion: (value) => { reduced = value; for (const listener of changeListeners) listener(); } }
  };
};

beforeEach(() => { vi.unstubAllGlobals(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('appearance store', () => {
  it('starts as Original, writes nothing and saves nothing', async () => {
    const { store, env } = await load();
    expect(store.getAppearance()).toEqual(DEFAULT_APPEARANCE);
    expect(env.root.variables.size).toBe(0);
    expect(env.storage.dump()).toEqual({});
  });

  it('applies and saves a patch, merging strings and effects deeply', async () => {
    const { store, env } = await load();
    store.setAppearance({ themeId: 'refined', strings: { glow: 20 } });
    store.setAppearance({ strings: { thickness: 'thick' }, effects: { hitPulse: true } });
    const state = store.getAppearance();
    expect(state.themeId).toBe('refined');
    expect(state.strings).toEqual({ ...DEFAULT_APPEARANCE.strings, glow: 20, thickness: 'thick' });
    expect(state.effects.hitPulse).toBe(true);
    expect(env.root.attributes.get('data-theme')).toBe('refined');
    expect(env.root.variables.get('--color-amp-400')).toBe('#FF984B');
    expect(JSON.parse(env.storage.dump()[APPEARANCE_STORAGE_KEY]).settings.themeId).toBe('refined');
  });

  it('falls back to the default of a field when the patch value is invalid', async () => {
    const { store } = await load();
    store.setAppearance({ strings: { intensity: 70 } });
    store.setAppearance({ strings: { intensity: 9999 } });
    expect(store.getAppearance().strings.intensity).toBe(100);
  });

  it('keeps the same object when nothing changes', async () => {
    const { store } = await load();
    const first = store.getAppearance();
    store.setAppearance({ themeId: 'original' });
    expect(store.getAppearance()).toBe(first);
    const gameplay = store.getGameplayAppearance();
    expect(store.getGameplayAppearance()).toBe(gameplay);
  });

  it('gameplay appearance keeps its identity until something changes', async () => {
    const { store } = await load();
    const first = store.getGameplayAppearance();
    expect(store.getGameplayAppearance()).toBe(first);
    store.setAppearance({ noteStyle: 'neon' });
    const second = store.getGameplayAppearance();
    expect(second).not.toBe(first);
    expect(second.noteStyle).toBe('neon');
    expect(store.getGameplayAppearance()).toBe(second);
  });

  it('a preset sets the whole look and keeps reduceEffects; manual changes keep the preset id', async () => {
    const { store } = await load();
    store.setAppearance({ reduceEffects: true });
    store.applyPreset('electric-neon');
    expect(store.getAppearance()).toEqual(getPreset('electric-neon', true));
    expect(store.isPresetCustomized(store.getAppearance())).toBe(false);
    store.setAppearance({ font: 'modern' });
    expect(store.getAppearance().presetId).toBe('electric-neon');
    expect(store.isPresetCustomized(store.getAppearance())).toBe(true);
  });

  it('resetting goes back to Original, clears the variables and removes the saved key', async () => {
    const { store, env } = await load();
    store.applyPreset('midnight-arcade');
    expect(env.storage.dump()[APPEARANCE_STORAGE_KEY]).toBeDefined();
    store.resetAppearance();
    expect(store.getAppearance()).toEqual(DEFAULT_APPEARANCE);
    expect(env.root.variables.size).toBe(0);
    expect(env.root.attributes.has('data-theme')).toBe(false);
    expect(env.storage.dump()[APPEARANCE_STORAGE_KEY]).toBeUndefined();
  });

  it('loads a saved look at start, validating it', async () => {
    const saved = JSON.stringify({ version: 1, settings: { themeId: 'graphite-studio', uiStyle: 'nope', strings: { glow: 500 } } });
    const { store, env } = await load({ [APPEARANCE_STORAGE_KEY]: saved });
    expect(store.getAppearance().themeId).toBe('graphite-studio');
    expect(store.getAppearance().uiStyle).toBe('soft');
    expect(store.getAppearance().strings.glow).toBe(0);
    expect(env.root.attributes.get('data-theme')).toBe('graphite-studio');
  });

  it('survives corrupt JSON and unknown stored shapes', async () => {
    for (const bad of ['{', 'null', '[1]', '{"version":"x"}']) {
      const { store } = await load({ [APPEARANCE_STORAGE_KEY]: bad });
      expect(store.getAppearance()).toEqual(DEFAULT_APPEARANCE);
    }
  });

  it('never overwrites a value saved by a newer version', async () => {
    const newer = JSON.stringify({ version: 2, settings: { themeId: 'refined' }, extra: true });
    const { store, env } = await load({ [APPEARANCE_STORAGE_KEY]: newer });
    expect(store.getAppearance()).toEqual(DEFAULT_APPEARANCE);
    store.setAppearance({ themeId: 'electric-neon' });
    expect(store.getAppearance().themeId).toBe('electric-neon');
    store.resetAppearance();
    expect(env.storage.dump()[APPEARANCE_STORAGE_KEY]).toBe(newer);
  });

  it('keeps working when storage throws', async () => {
    vi.resetModules();
    const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); }, removeItem: () => { throw new Error('denied'); } };
    vi.stubGlobal('localStorage', broken);
    vi.stubGlobal('document', { documentElement: fakeRoot() });
    const store = await import('./useAppearance');
    expect(store.getAppearance()).toEqual(DEFAULT_APPEARANCE);
    expect(() => store.setAppearance({ themeId: 'refined' })).not.toThrow();
    expect(store.getAppearance().themeId).toBe('refined');
    expect(() => store.clearAppearance()).not.toThrow();
    expect(store.exportAppearance()).toBeNull();
  });

  it('exports what is saved and clears it', async () => {
    const { store, env } = await load();
    expect(store.exportAppearance()).toBeNull();
    store.applyPreset('analog-soul');
    expect(store.exportAppearance()).toEqual({ version: 1, settings: getPreset('analog-soul') });
    store.clearAppearance();
    expect(env.storage.dump()).toEqual({});
    expect(store.getAppearance()).toEqual(DEFAULT_APPEARANCE);
    expect(store.exportAppearance()).toBeNull();
  });

  it('carries over a theme picked in the old theme lab, once', async () => {
    const { store, env } = await load({ 'prgb:theme-lab:v1': 'analog-vintage' });
    expect(store.getAppearance().themeId).toBe('analog-soul');
    expect(store.getAppearance().presetId).toBeNull();
    expect(env.storage.dump()['prgb:theme-lab:v1']).toBeUndefined();
    expect(JSON.parse(env.storage.dump()[APPEARANCE_STORAGE_KEY]).settings.themeId).toBe('analog-soul');
  });
});

describe('toGameplayAppearance', () => {
  it('zeroes every effect and the string glow for reduceEffects, but not the rest', async () => {
    const { store } = await load();
    const settings = {
      ...getPreset('electric-neon'),
      reduceEffects: true,
      effects: { hitPulse: true, perfectSpark: true, comboGlow: true, noteTrail: true, reactiveBackground: true, intensity: 3 as const }
    };
    const result = store.toGameplayAppearance(settings, false);
    expect(result.effects).toEqual({ hitPulse: false, perfectSpark: false, comboGlow: false, noteTrail: false, reactiveBackground: false, intensity: 3 });
    expect(result.strings.glow).toBe(0);
    expect(result.strings.scheme).toBe('vibrant');
    expect(result.noteStyle).toBe('neon');
  });

  it('does the same for reduced motion and leaves everything alone otherwise', async () => {
    const { store } = await load();
    const settings = getPreset('midnight-arcade');
    expect(store.toGameplayAppearance(settings, true).effects.hitPulse).toBe(false);
    expect(store.toGameplayAppearance(settings, false).effects.hitPulse).toBe(true);
    expect(store.toGameplayAppearance(settings, false).strings).toBe(settings.strings);
  });

  it('reads the system preference by default and follows a change while open', async () => {
    const { store, env } = await load({}, true);
    store.setAppearance({ effects: { hitPulse: true } });
    expect(store.getGameplayAppearance().effects.hitPulse).toBe(false);
    expect(env.root.attributes.get('data-effects')).toBe('off');
    const before = store.getGameplayAppearance();
    env.setReducedMotion(false);
    expect(store.getGameplayAppearance()).not.toBe(before);
    expect(store.getGameplayAppearance().effects.hitPulse).toBe(true);
    expect(env.root.attributes.has('data-effects')).toBe(false);
  });
});
