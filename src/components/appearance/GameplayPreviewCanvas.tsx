import React, { useEffect, useRef } from 'react';
import type { GameplayAppearance } from '../../appearance/types';
import { anyEffectOn, drawPulseRing } from '../gameEffects';
import { drawGameplayPreview, drawPreviewGuide, PREVIEW_GUIDE_LOOP_MS } from '../gameplayPreview';
import { stringY, layoutLanes, type GamePalette } from '../practiceLanes';

export interface GameplayPreviewCanvasProps {
  appearance: GameplayAppearance;
  palette: GamePalette;
  className?: string;
}

const FRAME_MS = 1000 / 24;
const PULSE_PERIOD_MS = 1400; // well under 3 flashes per second
const SWELL_PERIOD_MS = 2600;
const SPARKS = 8;

// Light cycle for the effects that are on. Only the hit line area is touched and nothing blinks: every
// motion is a slow swell or an expanding ring, never a full-canvas luminance jump.
const drawEffectsFrame = (ctx: CanvasRenderingContext2D, width: number, height: number, appearance: GameplayAppearance, palette: GamePalette, now: number): void => {
  const { effects } = appearance;
  const hitLineX = Math.round(width * 0.38);
  const [layout] = layoutLanes(height, [6]);
  const swell = 0.5 + 0.5 * Math.sin((now / SWELL_PERIOD_MS) * Math.PI * 2);
  const gain = effects.intensity === 1 ? 0.6 : effects.intensity === 2 ? 1 : 1.5;
  if (effects.reactiveBackground) {
    ctx.globalAlpha = 0.02 + 0.04 * swell * gain;
    ctx.fillStyle = palette.signal;
    ctx.fillRect(0, layout.top, width, layout.height);
    ctx.globalAlpha = 1;
  }
  if (effects.comboGlow) {
    const gradient = ctx.createLinearGradient(hitLineX - 18, 0, hitLineX + 18, 0);
    gradient.addColorStop(0, 'transparent');
    gradient.addColorStop(0.5, palette.signal);
    gradient.addColorStop(1, 'transparent');
    ctx.globalAlpha = (0.12 + 0.2 * swell) * Math.min(1, gain);
    ctx.fillStyle = gradient;
    ctx.fillRect(hitLineX - 18, layout.top, 36, layout.height);
    ctx.globalAlpha = 1;
  }
  const progress = (now % PULSE_PERIOD_MS) / PULSE_PERIOD_MS;
  const y = stringY(layout, 3);
  if (effects.hitPulse) drawPulseRing(ctx, hitLineX, y, progress, palette.hit, effects.intensity);
  if (effects.perfectSpark) {
    ctx.fillStyle = palette.hit;
    ctx.globalAlpha = 1 - progress;
    for (let spark = 0; spark < SPARKS; spark += 1) {
      const angle = (spark / SPARKS) * Math.PI * 2;
      const distance = (6 + progress * 22) * gain;
      ctx.beginPath();
      ctx.arc(hitLineX + Math.cos(angle) * distance, y + Math.sin(angle) * distance, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
};

/**
 * Six strings and example notes, drawn by the same code as the game. Drawn again only when the settings or the
 * size change; it animates (requestAnimationFrame, canceled on unmount) only while a decorative effect is on.
 */
export const GameplayPreviewCanvas: React.FC<GameplayPreviewCanvasProps> = ({ appearance, palette, className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    // The guide hops on its own loop unless motion is reduced; then it sits still in the base picture
    const guideMoves = appearance.guide.enabled && !appearance.reducedMotion;
    const animated = anyEffectOn(appearance.effects) || guideMoves;
    let base: OffscreenCanvas | null = null;
    let frame = 0;
    let lastDraw = -Infinity;

    const paint = (now: number | null) => {
      const ctx = canvas.getContext('2d');
      if (!ctx || !base) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(base, 0, 0);
      if (now !== null) {
        const dpr = canvas.width / Math.max(1, container.clientWidth);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawEffectsFrame(ctx, container.clientWidth, container.clientHeight, appearance, palette, now);
        if (guideMoves) drawPreviewGuide(ctx, container.clientWidth, container.clientHeight, appearance, palette, now % PREVIEW_GUIDE_LOOP_MS);
      }
    };

    const rebuild = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (!width || !height) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      base = new OffscreenCanvas(canvas.width, canvas.height);
      const ctx = base.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // The pulse ring is part of the static drawing; in the animated case the loop draws it moving instead
      drawGameplayPreview(ctx, width, height, animated ? { ...appearance, effects: { ...appearance.effects, hitPulse: false } } : appearance, palette, guideMoves ? null : undefined);
      paint(animated ? performance.now() : null);
    };

    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      if (now - lastDraw < FRAME_MS) return;
      lastDraw = now;
      paint(now);
    };

    rebuild();
    const observer = new ResizeObserver(rebuild);
    observer.observe(container);
    if (animated) frame = requestAnimationFrame(loop);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [appearance, palette]);

  return (
    <div ref={containerRef} className={`relative overflow-hidden rounded-xl border border-ink-600 ${className}`}>
      <canvas ref={canvasRef} role="img" aria-label="Pré-visualização das seis cordas com notas de exemplo" className="absolute inset-0 size-full" />
    </div>
  );
};
