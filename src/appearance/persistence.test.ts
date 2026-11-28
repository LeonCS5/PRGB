import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_APPEARANCE } from './defaults';
import { fakeRoot, memoryStorage } from './testHelpers';
import {
  BACKGROUND_STYLES, EFFECT_INTENSITIES, FONT_PACKS, GAMEPLAY_CONTRASTS, GUIDE_CHORD_COVERS, GUIDE_COLORS, GUIDE_EASINGS, GUIDE_SHAPES, GUIDE_STYLES,
  LINE_STYLES, NOTE_STYLES, STRING_SCHEMES, STRING_THICKNESS, THEME_IDS, UI_STYLES
} from './types';
import { APPEARANCE_STORAGE_KEY } from './validate';

type Store = typeof import('./useAppearance');

const load = async (initial: Record<string, string> = {}): Promise<{ store: Store; storage: ReturnType<typeof memoryStorage> }> => {
  vi.resetModules();
  const storage = memoryStorage(initial);
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('document', { documentElement: fakeRoot() });
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => undefined }));
  return { store: await import('./useAppearance'), storage };
};

beforeEach(() => { vi.unstubAllGlobals(); });
afterEach(() => { vi.unstubAllGlobals(); });

const other = <T>(list: readonly T[], current: T): T => list.find((value) => value !== current) ?? current;

// A value different from the default for every leaf. A field added to AppearanceSettings without an entry here fails the
// coverage test below, so a new setting can never be forgotten by the save/load path.
const ALTERNATIVES: Record<string, unknown> = {
  themeId: other(THEME_IDS, DEFAULT_APPEARANCE.themeId),
  uiStyle: other(UI_STYLES, DEFAULT_APPEARANCE.uiStyle),
  font: other(FONT_PACKS, DEFAULT_APPEARANCE.font),
  background: other(BACKGROUND_STYLES, DEFAULT_APPEARANCE.background),
  noteStyle: other(NOTE_STYLES, DEFAULT_APPEARANCE.noteStyle),
  noteSize: 125,
  'techniques.show': !DEFAULT_APPEARANCE.techniques.show,
  'techniques.legend': !DEFAULT_APPEARANCE.techniques.legend,
  'strings.thickness': other(STRING_THICKNESS, DEFAULT_APPEARANCE.strings.thickness),
  'strings.intensity': 70,
  'strings.laneOpacity': 65,
  'strings.lineStyle': other(LINE_STYLES, DEFAULT_APPEARANCE.strings.lineStyle),
  'strings.glow': 35,
  'strings.contrast': other(GAMEPLAY_CONTRASTS, DEFAULT_APPEARANCE.strings.contrast),
  'strings.scheme': other(STRING_SCHEMES, DEFAULT_APPEARANCE.strings.scheme),
  'effects.hitPulse': true,
  'effects.perfectSpark': true,
  'effects.comboGlow': true,
  'effects.noteTrail': true,
  'effects.reactiveBackground': true,
  'effects.intensity': other(EFFECT_INTENSITIES, DEFAULT_APPEARANCE.effects.intensity),
  'guide.enabled': false,
  'guide.intensity': other(EFFECT_INTENSITIES, DEFAULT_APPEARANCE.guide.intensity),
  'guide.style': other(GUIDE_STYLES, DEFAULT_APPEARANCE.guide.style),
  'guide.shadow.opacity': 55,
  'guide.shadow.color': other(GUIDE_COLORS, DEFAULT_APPEARANCE.guide.shadow.color),
  'guide.shadow.width': 110,
  'guide.shadow.height': 120,
  'guide.shadow.blur': 50,
  'guide.shadow.offsetX': 10,
  'guide.shadow.offsetY': -10,
  'guide.shadow.shape': other(GUIDE_SHAPES, DEFAULT_APPEARANCE.guide.shadow.shape),
  'guide.shadow.outline': !DEFAULT_APPEARANCE.guide.shadow.outline,
  'guide.shadow.outlineWidth': 4,
  'guide.shadow.outlineColor': other(GUIDE_COLORS, DEFAULT_APPEARANCE.guide.shadow.outlineColor),
  'guide.shadow.trail': !DEFAULT_APPEARANCE.guide.shadow.trail,
  'guide.shadow.trailLength': 80,
  'guide.shadow.trailOpacity': 30,
  'guide.shadow.pulse': !DEFAULT_APPEARANCE.guide.shadow.pulse,
  'guide.shadow.pulseStrength': 90,
  'guide.shadow.hopMs': 450,
  'guide.shadow.easing': other(GUIDE_EASINGS, DEFAULT_APPEARANCE.guide.shadow.easing),
  'guide.shadow.chordCover': other(GUIDE_CHORD_COVERS, DEFAULT_APPEARANCE.guide.shadow.chordCover),
  'guide.shadow.showNext': !DEFAULT_APPEARANCE.guide.shadow.showNext,
  'guide.shadow.glow': 20,
  'guide.shadow.preserveNote': !DEFAULT_APPEARANCE.guide.shadow.preserveNote,
  hitSounds: false,
  reduceEffects: true,
  presetId: null
};

const leaves = (value: unknown, prefix = ''): string[] =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? Object.entries(value).flatMap(([key, child]) => leaves(child, prefix ? `${prefix}.${key}` : key))
    : [prefix];

const read = (root: unknown, path: string): unknown => path.split('.').reduce<unknown>((node, key) => (node as Record<string, unknown>)[key], root);

const patchFor = (path: string, value: unknown): Record<string, unknown> => {
  const keys = path.split('.');
  return keys.reduceRight<unknown>((inner, key) => ({ [key]: inner }), value) as Record<string, unknown>;
};

describe('appearance persistence', () => {
  const paths = leaves(DEFAULT_APPEARANCE);

  it('has a different value to test for every setting', () => {
    expect(Object.keys(ALTERNATIVES).sort()).toEqual([...paths].sort());
    for (const path of paths) expect(ALTERNATIVES[path], path).not.toEqual(read(DEFAULT_APPEARANCE, path));
  });

  it.each(paths)('saves %s and still has it after a reload', async (path) => {
    const { store, storage } = await load();
    store.setAppearance(patchFor(path, ALTERNATIVES[path]) as Parameters<Store['setAppearance']>[0]);
    expect(read(store.getAppearance(), path), `in memory: ${path}`).toEqual(ALTERNATIVES[path]);
    const saved = storage.dump()[APPEARANCE_STORAGE_KEY];
    expect(saved, 'written to storage').toBeDefined();
    const fresh = await load({ [APPEARANCE_STORAGE_KEY]: saved });
    expect(read(fresh.store.getAppearance(), path), `after reload: ${path}`).toEqual(ALTERNATIVES[path]);
  });

  it('keeps every setting at once through a reload', async () => {
    const { store, storage } = await load();
    for (const path of paths) store.setAppearance(patchFor(path, ALTERNATIVES[path]) as Parameters<Store['setAppearance']>[0]);
    const fresh = await load({ [APPEARANCE_STORAGE_KEY]: storage.dump()[APPEARANCE_STORAGE_KEY] });
    for (const path of paths) expect(read(fresh.store.getAppearance(), path), path).toEqual(ALTERNATIVES[path]);
  });

  it('keeps the guide the player set when a theme is picked', async () => {
    const { store } = await load();
    store.setAppearance({ guide: { style: 'hologram', shadow: { opacity: 55, width: 110 } } });
    store.applyPreset('midnight-arcade');
    const { guide } = store.getAppearance();
    expect(guide.style).toBe('hologram');
    expect(guide.shadow.opacity).toBe(55);
    expect(guide.shadow.width).toBe(110);
  });

  it('keeps the techniques the player set when a theme is picked', async () => {
    const { store } = await load();
    store.setAppearance({ techniques: { show: false, legend: false } });
    store.applyPreset('electric-neon');
    expect(store.getAppearance().techniques).toEqual({ show: false, legend: false });
    expect(store.getGameplayAppearance().techniques.show).toBe(false);
  });

  it('follows a look saved by another tab instead of overwriting it with its own older copy', async () => {
    vi.resetModules();
    const storage = memoryStorage();
    let onStorage: ((event: { key: string | null; storageArea: Storage }) => void) | undefined;
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('document', { documentElement: fakeRoot() });
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => undefined }));
    vi.stubGlobal('window', { addEventListener: (type: string, listener: typeof onStorage) => { if (type === 'storage') onStorage = listener; } });
    const store = await import('./useAppearance');
    store.getAppearance();
    // The other tab picks a theme and saves it
    storage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify({ version: 1, settings: { themeId: 'refined', presetId: 'refined' } }));
    onStorage?.({ key: APPEARANCE_STORAGE_KEY, storageArea: storage });
    expect(store.getAppearance().themeId).toBe('refined');
    // This tab then changes something else: the other tab's choice survives
    store.setAppearance({ hitSounds: false });
    const saved = JSON.parse(storage.dump()[APPEARANCE_STORAGE_KEY]).settings;
    expect(saved.themeId).toBe('refined');
    expect(saved.hitSounds).toBe(false);
  });
});
