import type { CSSProperties } from 'react';
import type { EffectSettings } from '../appearance/types';
import { comboGlowTarget } from './gameEffects';

// Same ceiling as the glow on the canvas (gameEffects): never brighter than 30%
export const HUD_GLOW_MAX_ALPHA = 0.3;
// Longer than the 400 ms the canvas glow takes to follow the combo, so a streak breaking fades out instead of blinking
export const HUD_GLOW_TRANSITION = 'text-shadow 500ms ease-out';

const intensityFactor = (intensity: 1 | 2 | 3): number => (intensity === 1 ? 0.6 : intensity === 2 ? 1 : 1.5);

/** Alpha of the combo glow, 0..HUD_GLOW_MAX_ALPHA. Zero when the effect is off (reduced effects already turn it off upstream). */
export const comboGlowAlpha = (combo: number, effects: EffectSettings): number => {
  if (!effects.comboGlow) return 0;
  return HUD_GLOW_MAX_ALPHA * comboGlowTarget(combo) * Math.min(1, intensityFactor(effects.intensity));
};

/** Style for the COMBO number: a text-shadow that grows with the streak. undefined when there is nothing to show. */
export const comboGlowStyle = (combo: number, effects: EffectSettings): CSSProperties | undefined => {
  if (!effects.comboGlow) return undefined;
  // Quantised to 2% so the shadow only changes when the eye could tell; the transition covers the rest
  const alpha = Math.round(comboGlowAlpha(combo, effects) * 50) / 50;
  const percent = Math.round(alpha * 100);
  const radius = 6 + Math.round(comboGlowTarget(combo) * 10);
  return {
    textShadow: `0 0 ${radius}px color-mix(in srgb, var(--color-signal-400) ${percent}%, transparent)`,
    transition: HUD_GLOW_TRANSITION
  };
};
