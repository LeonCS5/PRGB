import { DEFAULT_APPEARANCE } from './defaults';
import type { AppearanceSettings, GameplayAppearance } from './types';

// SKELETON: the core task (claude/aparencia-nucleo) replaces this with the real store (useSyncExternalStore,
// persistence, validation). The two exported signatures are the contract other parts already import.
export const useAppearance = (): AppearanceSettings => DEFAULT_APPEARANCE;

export const toGameplayAppearance = (settings: AppearanceSettings): GameplayAppearance => ({
  noteStyle: settings.noteStyle,
  strings: settings.strings,
  effects: settings.reduceEffects
    ? { ...settings.effects, hitPulse: false, perfectSpark: false, comboGlow: false, noteTrail: false, reactiveBackground: false }
    : settings.effects
});

export const useGameplayAppearance = (): GameplayAppearance => toGameplayAppearance(DEFAULT_APPEARANCE);
