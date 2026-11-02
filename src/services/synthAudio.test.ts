import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MetronomeScheduler, SoundFX, buildCountIn } from './synthAudio';
import type { BeatMark } from './tabsApi';

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

  it('plays the beat at the start position immediately, even if the first update is a frame late', () => {
    const metronome = new MetronomeScheduler();
    metronome.start(grid(8, 500), 0, 1);
    expect(live().map((o) => o.startAt)).toEqual([10]);

    const resumed = new MetronomeScheduler();
    ctx.oscillators = [];
    resumed.start(grid(8, 500), 1000, 1);
    ctx.currentTime = 10.016;
    resumed.update(1016);
    expect(live()).toHaveLength(1);
  });

  it('queues nothing while the context is suspended and does not pile clicks up for resume', () => {
    const metronome = new MetronomeScheduler();
    metronome.start(grid(40, 100), 0, 1);
    ctx.state = 'suspended';
    for (let songMs = 16; songMs < 1000; songMs += 16) metronome.update(songMs);
    expect(live().filter((o) => o.startAt >= ctx.currentTime)).toHaveLength(0);

    ctx.state = 'running';
    ctx.currentTime = 11;
    metronome.update(1000);
    const upcoming = live().filter((o) => o.startAt >= 11);
    expect(new Set(upcoming.map((o) => o.startAt)).size).toBe(upcoming.length);
  });

  it('reschedules beats cancelled by a short suspension when the context resumes', () => {
    const metronome = new MetronomeScheduler();
    metronome.start(grid(10, 100), 0, 1); // queues 0 and 100 ms
    ctx.state = 'suspended';
    metronome.update(10); // cancels them
    ctx.state = 'running';
    ctx.currentTime = 10.016;
    metronome.update(16); // no drift beyond 30 ms, but the 100 ms beat must come back
    expect(live().some((o) => Math.abs(o.startAt - 10.1) < 1e-9)).toBe(true);
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

describe('buildCountIn', () => {
  const grid = (beatsPerBar: number, beatMs: number, bars = 2): BeatMark[] =>
    Array.from({ length: beatsPerBar * bars }, (_, index) => ({ timeMs: index * beatMs, accent: index % beatsPerBar === 0 }));

  it('clicks one bar right before the first beat, with the bar marked', () => {
    expect(buildCountIn(grid(4, 500), 120)).toEqual([
      { timeMs: -2000, accent: true },
      { timeMs: -1500, accent: false },
      { timeMs: -1000, accent: false },
      { timeMs: -500, accent: false }
    ]);
  });

  it('follows the meter of the song', () => {
    expect(buildCountIn(grid(3, 400), 150)).toHaveLength(3);
  });

  it('falls back on the tempo when the song is too short to read the grid', () => {
    expect(buildCountIn([{ timeMs: 0, accent: true }], 60).map((beat) => beat.timeMs)).toEqual([-4000, -3000, -2000, -1000]);
    expect(buildCountIn([], 120).map((beat) => beat.timeMs)).toEqual([-2000, -1500, -1000, -500]);
  });

  it('lands the last click one beat before a song that opens with a pickup', () => {
    const pickup: BeatMark[] = [{ timeMs: 300, accent: false }, { timeMs: 800, accent: true }, { timeMs: 1300, accent: false }];
    expect(buildCountIn(pickup, 120).at(-1)?.timeMs).toBe(-200);
  });

  it('measures the bar between downbeats and keeps the place in it when the song opens with a pickup', () => {
    // One beat of pickup in 4/4, as the parser writes it
    const pickup: BeatMark[] = [
      { timeMs: 0, accent: false },
      ...Array.from({ length: 8 }, (_, index) => ({ timeMs: 500 + index * 500, accent: index % 4 === 0 }))
    ];
    expect(buildCountIn(pickup, 120)).toEqual([
      { timeMs: -2000, accent: false },
      { timeMs: -1500, accent: true },
      { timeMs: -1000, accent: false },
      { timeMs: -500, accent: false }
    ]);
  });
});
