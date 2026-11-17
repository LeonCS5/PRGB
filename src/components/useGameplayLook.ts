import { useState } from 'react';
import { useGameplayAppearance } from '../appearance/useAppearance';
import type { GameplayAppearance } from '../appearance/types';
import { useGamePalette } from '../context/useTheme';
import { buildGameplayLook, isCurrentLook, type GameplayLook } from './gameplayLook';

// The look is rebuilt only when the theme or a note/string setting really changes (compared by value),
// so the cached static layer and the note paths are not redone by an unrelated re-render.
export const useGameplayLook = (): { look: GameplayLook; appearance: GameplayAppearance } => {
  const base = useGamePalette();
  const appearance = useGameplayAppearance();
  const [look, setLook] = useState(() => buildGameplayLook(base, appearance));
  if (isCurrentLook(look, base, appearance)) return { look, appearance };
  const next = buildGameplayLook(base, appearance);
  setLook(next);
  return { look: next, appearance };
};
