import { useSyncExternalStore } from 'react';
import { applyAppearanceToDocument, prefersReducedMotion } from './apply';
import { DEFAULT_APPEARANCE } from './defaults';
import { getPreset, isPresetCustomized } from './presets';
import type { AppearanceSettings, EffectSettings, GameplayAppearance, StringSettings, ThemeId } from './types';
import { APPEARANCE_STORAGE_KEY, APPEARANCE_VERSION, parseStoredAppearance, parseThemeId, serializeAppearance, validateAppearance } from './validate';

export { isPresetCustomized };

// Key of the temporary theme lab (removed): a theme picked there is carried over once
const LEGACY_LAB_KEY = 'prgb:theme-lab:v1';

export interface AppearancePatch extends Partial<Omit<AppearanceSettings, 'strings' | 'effects'>> {
  strings?: Partial<StringSettings>;
  effects?: Partial<EffectSettings>;
}

let state: AppearanceSettings = DEFAULT_APPEARANCE;
let loaded = false;
// A newer app version saved the stored value: this version shows the defaults and never overwrites it
let locked = false;
let reducedMotion = false;
const listeners = new Set<() => void>();

const readStorage = (): string | null => {
  try {
    return localStorage.getItem(APPEARANCE_STORAGE_KEY);
  } catch {
    return null;
  }
};

const persist = (): void => {
  if (locked) return;
  try {
    if (serializeAppearance(state) === serializeAppearance(DEFAULT_APPEARANCE)) localStorage.removeItem(APPEARANCE_STORAGE_KEY);
    else localStorage.setItem(APPEARANCE_STORAGE_KEY, serializeAppearance(state));
  } catch {
    // Without storage (private mode, quota) the look only lasts until the page closes.
  }
};

const migrateLabTheme = (): AppearanceSettings | null => {
  try {
    const legacy = localStorage.getItem(LEGACY_LAB_KEY);
    if (legacy === null) return null;
    localStorage.removeItem(LEGACY_LAB_KEY);
    const themeId = parseThemeId(legacy, 'original');
    return themeId === 'original' ? null : { ...DEFAULT_APPEARANCE, themeId, presetId: null };
  } catch {
    return null;
  }
};

const emit = (): void => {
  applyAppearanceToDocument(state);
  for (const listener of listeners) listener();
};

const watchReducedMotion = (): void => {
  try {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    query.addEventListener('change', () => {
      reducedMotion = query.matches;
      emit();
    });
  } catch {
    // No matchMedia: the preference is read once and stays.
  }
};

/** Reads the saved look again (and migrates the old lab key). Runs by itself on first use. */
export const reloadAppearance = (): void => {
  const parsed = parseStoredAppearance(readStorage());
  locked = parsed.status === 'newer';
  state = parsed.settings;
  if (parsed.status === 'empty') {
    const migrated = migrateLabTheme();
    if (migrated) {
      state = migrated;
      persist();
    }
  }
  reducedMotion = prefersReducedMotion();
  loaded = true;
  emit();
};

let watching = false;

const ensureLoaded = (): void => {
  if (!loaded) reloadAppearance();
  if (!watching) {
    watching = true;
    watchReducedMotion();
  }
};

export const getAppearance = (): AppearanceSettings => {
  ensureLoaded();
  return state;
};

const subscribe = (listener: () => void): (() => void) => {
  ensureLoaded();
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

const commit = (next: AppearanceSettings): void => {
  ensureLoaded();
  if (serializeAppearance(next) === serializeAppearance(state)) return;
  state = next;
  persist();
  emit();
};

/** Deep patch for strings and effects; anything invalid in it falls back to that field's default. */
export const setAppearance = (patch: AppearancePatch): void => {
  const current = getAppearance();
  commit(validateAppearance({
    ...current,
    ...patch,
    strings: { ...current.strings, ...patch.strings },
    effects: { ...current.effects, ...patch.effects }
  }));
};

export const resetAppearance = (): void => {
  commit(DEFAULT_APPEARANCE);
};

/** Takes a preset whole; the reduce-effects switch is the player's accessibility choice and stays as it was. */
export const applyPreset = (id: ThemeId): void => {
  commit(getPreset(parseThemeId(id, 'original'), getAppearance().reduceEffects));
};

/** For the local data export: what is saved, or null when nothing is. */
export const exportAppearance = (): { version: number; settings: AppearanceSettings } | null => {
  const parsed = parseStoredAppearance(readStorage());
  return parsed.status === 'ok' ? { version: APPEARANCE_VERSION, settings: parsed.settings } : null;
};

/** For "apagar dados locais": removes the saved look (even a newer version's, since the player asked) and goes back to the defaults. */
export const clearAppearance = (): void => {
  try {
    localStorage.removeItem(APPEARANCE_STORAGE_KEY);
    localStorage.removeItem(LEGACY_LAB_KEY);
  } catch {
    // Nothing to remove without storage.
  }
  loaded = true;
  locked = false;
  state = DEFAULT_APPEARANCE;
  emit();
};

export const useAppearance = (): AppearanceSettings =>
  useSyncExternalStore(subscribe, getAppearance, getAppearance);

/** Reduced motion or reduce-effects: the decorative effects and the string glow go off. */
export const toGameplayAppearance = (
  settings: AppearanceSettings,
  reduced: boolean = prefersReducedMotion()
): GameplayAppearance => {
  if (!settings.reduceEffects && !reduced) {
    return { noteStyle: settings.noteStyle, strings: settings.strings, effects: settings.effects };
  }
  return {
    noteStyle: settings.noteStyle,
    strings: { ...settings.strings, glow: 0 },
    effects: { ...settings.effects, hitPulse: false, perfectSpark: false, comboGlow: false, noteTrail: false, reactiveBackground: false }
  };
};

// The canvas keeps this object in effects, so it must not change identity while nothing changed
let gameplayCache: { source: AppearanceSettings; reduced: boolean; value: GameplayAppearance } | null = null;

export const getGameplayAppearance = (): GameplayAppearance => {
  const source = getAppearance();
  if (!gameplayCache || gameplayCache.source !== source || gameplayCache.reduced !== reducedMotion) {
    gameplayCache = { source, reduced: reducedMotion, value: toGameplayAppearance(source, reducedMotion) };
  }
  return gameplayCache.value;
};

export const useGameplayAppearance = (): GameplayAppearance =>
  useSyncExternalStore(subscribe, getGameplayAppearance, getGameplayAppearance);
