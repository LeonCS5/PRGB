// Optional gameplay effects drawn on the practice canvas. They only listen to events the game already produces
// (a judged note, the combo, the input level it already reads) and never feed anything back into the game.
// All state lives in preallocated pools, so a frame allocates nothing; every effect is short, capped and smooth.

import type { EffectSettings } from '../appearance/types';

export const MAX_SPARKS = 24;
export const SPARKS_PER_PERFECT = 8;
export const SPARK_LIFE_MS = 420;
export const PULSE_LIFE_MS = 350;
const MAX_PULSES = 4;
const MAX_DT_MS = 50;
export const COMBO_GLOW_FULL_AT = 50; // combo that reaches the top of the glow
const COMBO_GLOW_ALPHA = 0.3;         // top of the glow, times the intensity factor
const BACKGROUND_MAX_ALPHA = 0.07;    // the reactive background never goes brighter than this
const BACKGROUND_SLEW_PER_S = 4;      // fastest change of the reaction: a full swing takes 250 ms
const BACKGROUND_DECAY_PER_S = 1.6;

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

interface Pulse { alive: boolean; y: number; born: number; color: string }
interface Spark { alive: boolean; x: number; y: number; vx: number; vy: number; born: number; color: string }

export interface EffectArea {
  hitLineX: number;
  width: number;
  height: number;
  top: number;    // vertical extent of the hit line
  bottom: number;
}

const factor = (intensity: 1 | 2 | 3): number => (intensity === 1 ? 0.6 : intensity === 2 ? 1 : 1.5);

export const anyEffectOn = (settings: EffectSettings): boolean =>
  settings.hitPulse || settings.perfectSpark || settings.comboGlow || settings.noteTrail || settings.reactiveBackground;

// 0..1, rising with the streak up to a cap
export const comboGlowTarget = (combo: number): number => Math.max(0, Math.min(1, combo / COMBO_GLOW_FULL_AT));

// Ring on the hit line: grows from the line to a radius and fades; shared with the preview
export const drawPulseRing = (ctx: Ctx2D, x: number, y: number, progress: number, color: string, intensity: 1 | 2 | 3): void => {
  const k = factor(intensity);
  ctx.globalAlpha = (1 - progress) * 0.85 * Math.min(1, k);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3 * k * (1 - progress * 0.6);
  ctx.beginPath();
  ctx.arc(x, y, 8 + progress * 30 * k, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
};

export class GameEffects {
  private readonly pulses: Pulse[] = Array.from({ length: MAX_PULSES }, () => ({ alive: false, y: 0, born: 0, color: '' }));
  private readonly sparks: Spark[] = Array.from({ length: MAX_SPARKS }, () => ({ alive: false, x: 0, y: 0, vx: 0, vy: 0, born: 0, color: '' }));
  private comboLevel = 0;
  private reaction = 0; // what the background shows now (0..1)
  private drive = 0;    // what it is heading to; decays by itself
  private lastNow = -1;
  private hitLineX = 0;

  get aliveSparks(): number {
    let count = 0;
    for (const spark of this.sparks) if (spark.alive) count++;
    return count;
  }

  get alivePulses(): number {
    let count = 0;
    for (const pulse of this.pulses) if (pulse.alive) count++;
    return count;
  }

  reset(): void {
    for (const pulse of this.pulses) pulse.alive = false;
    for (const spark of this.sparks) spark.alive = false;
    this.comboLevel = 0;
    this.reaction = 0;
    this.drive = 0;
    this.lastNow = -1;
  }

  // A note was judged at (hitLineX, y). A miss never spawns anything.
  onJudgement(judgement: 'perfect' | 'good' | 'miss', hitLineX: number, y: number, now: number, settings: EffectSettings, hitColor: string, nearColor: string): void {
    if (judgement === 'miss') return;
    this.hitLineX = hitLineX;
    const color = judgement === 'perfect' ? hitColor : nearColor;
    if (settings.hitPulse) {
      const slot = this.pulses.find((pulse) => !pulse.alive);
      if (slot) {
        slot.alive = true;
        slot.y = y;
        slot.born = now;
        slot.color = color;
      }
    }
    if (settings.perfectSpark && judgement === 'perfect') {
      let spawned = 0;
      for (const spark of this.sparks) {
        if (spawned === SPARKS_PER_PERFECT) break;
        if (spark.alive) continue;
        // Fan to the right of the line, spread evenly: no randomness, so a frame can be reproduced
        const angle = -Math.PI * 0.45 + (Math.PI * 0.9 * spawned) / (SPARKS_PER_PERFECT - 1);
        const speed = (0.12 + (spawned % 3) * 0.04) * factor(settings.intensity);
        spark.alive = true;
        spark.x = hitLineX;
        spark.y = y;
        spark.vx = Math.cos(angle) * speed;
        spark.vy = Math.sin(angle) * speed;
        spark.born = now;
        spark.color = color;
        spawned++;
      }
    }
    if (settings.reactiveBackground) this.drive = Math.max(this.drive, judgement === 'perfect' ? 1 : 0.6);
  }

  // Behind the notes: reactive background and combo glow
  drawUnder(ctx: Ctx2D, now: number, settings: EffectSettings, area: EffectArea, combo: number, inputLevel: number, signal: string): void {
    const dt = this.tick(now, settings);
    if (dt < 0) return;
    const k = factor(settings.intensity);
    if (settings.reactiveBackground) {
      this.drive = Math.max(0, this.drive - BACKGROUND_DECAY_PER_S * dt / 1000);
      // The level the game already reads adds a gentle floor; the slew limit keeps every change smooth
      const target = Math.max(this.drive, Math.min(1, inputLevel) * 0.5);
      const step = BACKGROUND_SLEW_PER_S * dt / 1000;
      this.reaction += Math.max(-step, Math.min(step, target - this.reaction));
      const alpha = Math.min(BACKGROUND_MAX_ALPHA, BACKGROUND_MAX_ALPHA * this.reaction * k);
      if (alpha > 0.002) {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = signal;
        ctx.fillRect(0, 0, area.width, area.height);
        ctx.globalAlpha = 1;
      }
    }
    if (settings.comboGlow) {
      const target = comboGlowTarget(combo);
      this.comboLevel += (target - this.comboLevel) * Math.min(1, dt / 400);
      if (this.comboLevel > 0.02) {
        const alpha = COMBO_GLOW_ALPHA * this.comboLevel * Math.min(1, k);
        const height = area.bottom - area.top;
        ctx.strokeStyle = signal;
        ctx.beginPath();
        ctx.moveTo(area.hitLineX, area.top);
        ctx.lineTo(area.hitLineX, area.top + height);
        ctx.lineWidth = 22 * k;
        ctx.globalAlpha = alpha * 0.35;
        ctx.stroke();
        ctx.lineWidth = 10 * k;
        ctx.globalAlpha = alpha;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  }

  // Over the notes: pulse rings and sparks
  drawOver(ctx: Ctx2D, now: number, settings: EffectSettings): void {
    if (!this.alivePulsesOrSparks()) return;
    for (const pulse of this.pulses) {
      if (!pulse.alive) continue;
      const age = now - pulse.born;
      if (age >= PULSE_LIFE_MS || !settings.hitPulse) {
        pulse.alive = false;
        continue;
      }
      drawPulseRing(ctx, this.hitLineX, pulse.y, age / PULSE_LIFE_MS, pulse.color, settings.intensity);
    }
    const k = factor(settings.intensity);
    for (const spark of this.sparks) {
      if (!spark.alive) continue;
      const age = now - spark.born;
      if (age >= SPARK_LIFE_MS || !settings.perfectSpark) {
        spark.alive = false;
        continue;
      }
      const progress = age / SPARK_LIFE_MS;
      ctx.globalAlpha = (1 - progress) * 0.9;
      ctx.fillStyle = spark.color;
      const size = (3.5 - progress * 2) * Math.min(1.3, k);
      ctx.fillRect(spark.x + spark.vx * age - size / 2, spark.y + spark.vy * age - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  }

  private alivePulsesOrSparks(): boolean {
    return this.alivePulses > 0 || this.aliveSparks > 0;
  }

  // Elapsed ms since the last call, or -1 when no effect is on (the state is cleared, nothing is drawn)
  private tick(now: number, settings: EffectSettings): number {
    if (!anyEffectOn(settings)) {
      if (this.lastNow >= 0) this.reset();
      return -1;
    }
    const dt = this.lastNow < 0 ? 16 : Math.max(0, Math.min(MAX_DT_MS, now - this.lastNow));
    this.lastNow = now;
    return dt;
  }
}
