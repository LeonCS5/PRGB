// Test helper: a 2D context and a Path2D that record every call and property write, so a drawing can be
// compared instruction by instruction. Used only by the *.test.ts files of the canvas code.

import type { GamePalette } from './practiceLanes';

// The Original theme, as in index.css
export const ORIGINAL_PALETTE: GamePalette = {
  background: '#0d0e15', rail: '#181a26', ink: '#07070b', muted: '#8389a3', divider: '#343850',
  signal: '#34e3ff', hit: '#3ee08f', near: '#ffc94d', miss: '#ff4d6d',
  strings: ['#c49bff', '#8cf1ff', '#0a9cbb', '#3ee08f', '#ffc94d', '#ff9a4d'],
  players: ['#8cf1ff', '#c49bff']
};

export class RecordedPath2D {
  readonly log: string[] = [];
  constructor(...args: unknown[]) {
    if (args.length) this.log.push(`new(${args.join(',')})`);
  }
  roundRect(...args: number[]): void { this.log.push(`roundRect(${args.map(fmt).join(',')})`); }
  moveTo(...args: number[]): void { this.log.push(`moveTo(${args.map(fmt).join(',')})`); }
  lineTo(...args: number[]): void { this.log.push(`lineTo(${args.map(fmt).join(',')})`); }
  closePath(): void { this.log.push('closePath'); }
  arc(...args: number[]): void { this.log.push(`arc(${args.map(fmt).join(',')})`); }
}

const fmt = (value: unknown): string => {
  if (value instanceof RecordedPath2D) return `Path2D[${value.log.join(';')}]`;
  if (typeof value === 'number') return String(Math.round(value * 1e6) / 1e6);
  if (Array.isArray(value)) return `[${value.map(fmt).join(',')}]`;
  return String(value);
};

export interface Recorder {
  ctx: CanvasRenderingContext2D;
  log: string[];
}

export const createRecorder = (): Recorder => {
  const log: string[] = [];
  const target: Record<string, unknown> = {};
  const ctx = new Proxy(target, {
    get(_, prop: string) {
      if (prop in target) return target[prop];
      if (prop === 'createLinearGradient') {
        return (...args: number[]) => {
          log.push(`createLinearGradient(${args.map(fmt).join(',')})`);
          return { addColorStop: (...stop: unknown[]) => log.push(`addColorStop(${stop.map(fmt).join(',')})`) };
        };
      }
      return (...args: unknown[]) => {
        log.push(`${prop}(${args.map(fmt).join(',')})`);
      };
    },
    set(_, prop: string, value: unknown) {
      target[prop] = value;
      log.push(`${prop}=${fmt(value)}`);
      return true;
    }
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, log };
};

export const installPath2D = (): void => {
  (globalThis as unknown as { Path2D: unknown }).Path2D = RecordedPath2D;
};
