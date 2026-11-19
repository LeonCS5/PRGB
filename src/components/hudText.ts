import { comboMultiplier } from '../services/scoring';

// "30 · ×4": the multiplier shows only when it is above 1, apart from the count so it does not read as a typo
export const comboText = (combo: number): string => {
  const multiplier = comboMultiplier(combo);
  return multiplier > 1 ? `${combo} · ×${multiplier}` : String(combo);
};
