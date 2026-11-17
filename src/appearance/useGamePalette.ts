import { useMemo } from 'react';
import { readPalette, type GamePalette } from '../components/practiceLanes';
import { useAppearance } from './useAppearance';

// The canvas palette is read from CSS once per theme, not per frame; a theme change reads it again
export const useGamePalette = (): GamePalette => {
  const { themeId } = useAppearance();
  // themeId is the only input: readPalette reads the variables the theme has just written
  return useMemo(readPalette, [themeId]);
};
