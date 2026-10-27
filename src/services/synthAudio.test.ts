import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MetronomeScheduler, SoundFX } from './synthAudio';
import type { BeatMark } from './songsterrApi';

interface FakeOscillator {
  startAt: number;
  stopped: boolean;
  accentHz: number;
}

// Audio clock under test control; oscillators record when they were scheduled to sound
class FakeAudioContext {
  state: AudioContextState = 'running';
  currentTime = 0;
  destination = {};
  oscillators: FakeOscillator[] = [];

  createOscillator() {
    const record: FakeOscillator = { startAt: -1, stopped: false, accentHz: 0 };
    this.oscillators.push(record);
    return {
      type: 'sine',
      frequency: { setValueAtTime: (hz: number) => { record.accentHz = hz; } },
      connect: vi.fn(),
      start: (at: number) => { record.startAt = at; },
      stop: (at?: number) => { if (at === undefined) record.stopped = true; }
    };
  }
  createGain() {
    return { gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn() };
  }
  async resume() {}
}

const grid = (count: number, stepMs: number, perMeasure = 4): BeatMark[] =>
  Array.from({ length: count }, (_, i) => ({ timeMs: i * stepMs, accent: i % perMeasure === 0 }));

describe('MetronomeScheduler', () => {
  let ctx: FakeAudioContext;
  const live = () => ctx.oscillators.filter((o) => !o.stopped);

  beforeEach(() => {
    vi.stubGlobal('window', { AudioContext: FakeAudioContext });
    ctx = SoundFX.getContext() as unknown as FakeAudioContext;
    ctx.oscillators = [];
    ctx.currentTime = 10;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('schedules clicks ahead on the audio clock, accenting downbeats', () => {
    const metronome = new MetronomeScheduler();
    metronome.start(grid(8, 500), 0, 1);
    metronome.update(0);
    expect(live().map((o) => o.startAt)).toEqual([10]);
    expect(live()[0].accentHz).toBe(1200);

    ctx.currentTime = 10.45;
    metronome.update(450);
    expect(live().map((o) => o.startAt)).toEqual([10, 10.5]);
    expect(live()[1].accentHz).toBe(800);
  });

  it('maps song time through the playback speed', () => {
    const metronome = new MetronomeScheduler();
    metronome.start(grid(8, 500), 0, 0.5);
    metronome.update(0);
    ctx.currentTime = 10.95;
    metronome.update(475);
    // At half speed the 500 ms beat sounds 1 s later on the audio clock
    expect(live().map((o) => o.startAt)).toEqual([10, 11]);
  });

  it('cancels queued clicks and re-anchors when the song position jumps', () => {
    const metronome = new MetronomeScheduler();
    metronome.start(grid(20, 500), 0, 1);
    ctx.currentTime = 10.45;
    metronome.update(450); // queues the click for 500 ms at 10.5
    metronome.update(4000); // seek: far from the expected 450 ms
    const pending = live().filter((o) => o.startAt >= 10.45);
    expect(pending.map((o) => o.startAt)).toEqual([10.45]); // the 4000 ms downbeat, right now
    expect(ctx.oscillators.find((o) => o.startAt === 10.5)?.stopped).toBe(true);
  });

  it('stops pending clicks on stop() and ignores updates afterwards', () => {
    const metronome = new MetronomeScheduler();
    metronome.start(grid(8, 100), 0, 1);
    metronome.update(0);
    const queued = live().length;
    expect(queued).toBeGreaterThan(1);
    metronome.stop();
    expect(live().filter((o) => o.startAt > ctx.currentTime)).toHaveLength(0);
    metronome.update(50);
    expect(ctx.oscillators).toHaveLength(queued);
  });
});
