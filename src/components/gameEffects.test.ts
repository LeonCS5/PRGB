import { describe, expect, it } from 'vitest';
import { DEFAULT_EFFECTS } from '../appearance/defaults';
import type { EffectSettings } from '../appearance/types';
import {
  COMBO_GLOW_FULL_AT, comboGlowTarget, GameEffects, MAX_SPARKS, PULSE_LIFE_MS, SPARK_LIFE_MS, SPARKS_PER_PERFECT, type EffectArea
} from './gameEffects';
import { createRecorder } from './testCanvas';

const ALL_ON: EffectSettings = { hitPulse: true, perfectSpark: true, comboGlow: true, noteTrail: true, reactiveBackground: true, intensity: 3 };
const AREA: EffectArea = { hitLineX: 140, width: 1000, height: 400, top: 40, bottom: 360 };

const judge = (effects: GameEffects, judgement: 'perfect' | 'good' | 'miss', now: number, settings = ALL_ON) =>
  effects.onJudgement(judgement, 140, 100, now, settings, '#3ee08f', '#ffc94d');

describe('GameEffects', () => {
  it('does nothing when every effect is off: no spawn and no drawing call', () => {
    const effects = new GameEffects();
    judge(effects, 'perfect', 0, DEFAULT_EFFECTS);
    expect(effects.aliveSparks).toBe(0);
    expect(effects.alivePulses).toBe(0);
    const { ctx, log } = createRecorder();
    effects.drawUnder(ctx, 16, DEFAULT_EFFECTS, AREA, 80, 1, '#34e3ff');
    effects.drawOver(ctx, 16, DEFAULT_EFFECTS);
    expect(log).toEqual([]);
  });

  it('spawns at most 8 sparks per perfect and only for a perfect', () => {
    const effects = new GameEffects();
    judge(effects, 'good', 0);
    judge(effects, 'miss', 0);
    expect(effects.aliveSparks).toBe(0);
    judge(effects, 'perfect', 0);
    expect(effects.aliveSparks).toBe(SPARKS_PER_PERFECT);
    expect(SPARKS_PER_PERFECT).toBeLessThanOrEqual(8);
  });

  it('never keeps more than 24 sparks alive however fast the notes come', () => {
    const effects = new GameEffects();
    for (let i = 0; i < 20; i++) judge(effects, 'perfect', i);
    expect(effects.aliveSparks).toBe(MAX_SPARKS);
    expect(MAX_SPARKS).toBe(24);
  });

  it('retires pulses and sparks within their short life (at most 450 ms)', () => {
    expect(PULSE_LIFE_MS).toBeLessThanOrEqual(350);
    expect(SPARK_LIFE_MS).toBeLessThanOrEqual(450);
    const effects = new GameEffects();
    judge(effects, 'perfect', 1000);
    const { ctx } = createRecorder();
    effects.drawOver(ctx, 1000 + PULSE_LIFE_MS - 1, ALL_ON);
    expect(effects.alivePulses).toBe(1);
    effects.drawOver(ctx, 1000 + PULSE_LIFE_MS, ALL_ON);
    expect(effects.alivePulses).toBe(0);
    expect(effects.aliveSparks).toBe(SPARKS_PER_PERFECT);
    effects.drawOver(ctx, 1000 + SPARK_LIFE_MS, ALL_ON);
    expect(effects.aliveSparks).toBe(0);
  });

  it('turning an effect off while it plays removes it', () => {
    const effects = new GameEffects();
    judge(effects, 'perfect', 0);
    const { ctx } = createRecorder();
    effects.drawOver(ctx, 10, { ...ALL_ON, hitPulse: false, perfectSpark: false });
    expect(effects.alivePulses).toBe(0);
    expect(effects.aliveSparks).toBe(0);
  });

  it('the combo glow grows with the streak up to a cap and draws nothing at combo 0', () => {
    expect(comboGlowTarget(0)).toBe(0);
    expect(comboGlowTarget(COMBO_GLOW_FULL_AT / 2)).toBe(0.5);
    expect(comboGlowTarget(10_000)).toBe(1);
    const only: EffectSettings = { ...DEFAULT_EFFECTS, comboGlow: true };
    const alphaAt = (combo: number) => {
      const effects = new GameEffects();
      const { ctx, log } = createRecorder();
      for (let frame = 0; frame < 120; frame++) effects.drawUnder(ctx, frame * 16, only, AREA, combo, 0, '#34e3ff');
      const alphas = log.filter((line) => line.startsWith('globalAlpha=')).map((line) => Number(line.slice(12))).filter((value) => value < 1);
      return alphas.length ? Math.max(...alphas) : 0;
    };
    expect(alphaAt(0)).toBe(0);
    expect(alphaAt(25)).toBeGreaterThan(0);
    expect(alphaAt(50)).toBeGreaterThan(alphaAt(25));
    expect(alphaAt(500)).toBe(alphaAt(50)); // the cap
    expect(alphaAt(500)).toBeLessThanOrEqual(0.3);
  });

  it('the combo glow follows the combo smoothly: no jump when it breaks', () => {
    const effects = new GameEffects();
    const only: EffectSettings = { ...DEFAULT_EFFECTS, comboGlow: true };
    const { ctx, log } = createRecorder();
    for (let frame = 0; frame < 200; frame++) effects.drawUnder(ctx, frame * 16, only, AREA, 50, 0, '#34e3ff');
    log.length = 0;
    effects.drawUnder(ctx, 200 * 16, only, AREA, 0, 0, '#34e3ff'); // the combo just broke
    const first = Math.max(...log.filter((l) => l.startsWith('globalAlpha=')).map((l) => Number(l.slice(12))).filter((v) => v < 1));
    expect(first).toBeGreaterThan(0.2); // still almost at the top one frame later
  });

  it('the reactive background stays dim, changes by small steps, and settles back', () => {
    const effects = new GameEffects();
    const only: EffectSettings = { ...DEFAULT_EFFECTS, reactiveBackground: true, intensity: 3 };
    const { ctx, log } = createRecorder();
    let last = 0;
    let biggestStep = 0;
    let peak = 0;
    for (let frame = 0; frame < 120; frame++) {
      const now = frame * 16;
      if (frame === 10) judge(effects, 'perfect', now, only);
      log.length = 0;
      effects.drawUnder(ctx, now, only, AREA, 0, 0, '#34e3ff');
      const alpha = Number(log.find((l) => l.startsWith('globalAlpha=') && l !== 'globalAlpha=1')?.slice(12) ?? 0);
      biggestStep = Math.max(biggestStep, Math.abs(alpha - last));
      peak = Math.max(peak, alpha);
      last = alpha;
    }
    expect(peak).toBeGreaterThan(0.02);
    expect(peak).toBeLessThanOrEqual(0.07);
    expect(biggestStep).toBeLessThanOrEqual(0.07 * 4 * 0.05 + 1e-9); // slew limit: 4 per second, 50 ms at most
    expect(last).toBeLessThan(peak); // it faded
  });

  it('the input level lifts the background gently but never past the cap', () => {
    const effects = new GameEffects();
    const only: EffectSettings = { ...DEFAULT_EFFECTS, reactiveBackground: true, intensity: 3 };
    const { ctx, log } = createRecorder();
    for (let frame = 0; frame < 200; frame++) effects.drawUnder(ctx, frame * 16, only, AREA, 0, 1, '#34e3ff');
    const alphas = log.filter((l) => l.startsWith('globalAlpha=') && l !== 'globalAlpha=1').map((l) => Number(l.slice(12)));
    expect(Math.max(...alphas)).toBeLessThanOrEqual(0.07);
  });

  it('a long run allocates nothing the pools do not own: the counts stay bounded', () => {
    const effects = new GameEffects();
    const { ctx } = createRecorder();
    let widest = 0;
    for (let frame = 0; frame < 2000; frame++) {
      const now = frame * 16;
      if (frame % 3 === 0) judge(effects, 'perfect', now);
      effects.drawUnder(ctx, now, ALL_ON, AREA, frame % 90, 0.4, '#34e3ff');
      effects.drawOver(ctx, now, ALL_ON);
      widest = Math.max(widest, effects.aliveSparks);
    }
    expect(widest).toBeLessThanOrEqual(MAX_SPARKS);
  });
});
