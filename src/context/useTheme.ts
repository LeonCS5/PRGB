import { useMemo, useSyncExternalStore } from 'react';
import { readPalette, type GamePalette } from '../components/practiceLanes';
import { getThemeId, subscribeTheme } from '../services/themes';

// TEMPORARY theme lab (see services/themes.ts)
export const useThemeId = (): string => useSyncExternalStore(subscribeTheme, getThemeId, getThemeId);

// The canvas palette is read from CSS once per theme, not per frame; a theme change reads it again
export const useGamePalette = (): GamePalette => {
  const themeId = useThemeId();
  // themeId is the only input: readPalette reads the variables the theme has just written
  return useMemo(readPalette, [themeId]);
};
