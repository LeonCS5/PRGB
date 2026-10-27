import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioEngine, STANDARD_TUNING, estimateStringAndFret } from './audioEngine';

vi.mock('./tone3000Amp', () => ({
  Tone3000AmpEngine: class {
    inputNode = {};
    processGate() {}
  }
}));

describe('estimateStringAndFret', () => {
  it('picks the lowest fret position in standard tuning', () => {
    expect(estimateStringAndFret(40)).toEqual({ string: 6, fret: 0 });
    expect(estimateStringAndFret(45)).toEqual({ string: 5, fret: 0 });
    expect(estimateStringAndFret(64)).toEqual({ string: 1, fret: 0 });
    expect(estimateStringAndFret(66)).toEqual({ string: 1, fret: 2 });
  });

  it('follows a custom tuning', () => {
    const dropD = [64, 59, 55, 50, 45, 38];
    expect(estimateStringAndFret(38, dropD)).toEqual({ string: 6, fret: 0 });
    expect(estimateStringAndFret(38, STANDARD_TUNING)).toBeNull();
  });

  it('returns null outside the neck range', () => {
    expect(estimateStringAndFret(39)).toBeNull();
    expect(estimateStringAndFret(64 + 25)).toBeNull();
  });
});

// Minimal Web Audio / media stand-ins: enough for start/stop/dispose wiring, no DSP.
const audioNode = () => ({ connect: vi.fn(), disconnect: vi.fn() });

class FakeAudioContext {
  state: AudioContextState = 'running';
  currentTime = 0;
  sampleRate = 48000;
  holdClock = false; // when true, scheduled ends don't fire (frozen clock)
  private listeners = new Set<() => void>();

  createGain() {
    return {
      ...audioNode(),
      gain: { value: 1, cancelScheduledValues: vi.fn(), setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() }
    };
  }
  createMediaStreamSource() { return audioNode(); }
  createChannelSplitter() { return audioNode(); }
  createChannelMerger() { return audioNode(); }
  createAnalyser() { return { ...audioNode(), fftSize: 0, smoothingTimeConstant: 0, getFloatTimeDomainData: vi.fn() }; }
  createConstantSource() {
    const source = {
      offset: { value: 0 },
      onended: null as (() => void) | null,
      start: vi.fn(),
      stop: () => {
        if (!this.holdClock) queueMicrotask(() => source.onended?.());
      }
    };
    return source;
  }
  addEventListener(_type: string, listener: () => void) { this.listeners.add(listener); }
  removeEventListener(_type: string, listener: () => void) { this.listeners.delete(listener); }
  async resume() { this.state = 'running'; }
  async close() { this.state = 'closed'; }
  setState(state: AudioContextState) {
    this.state = state;
    this.listeners.forEach((listener) => listener());
  }
}

interface FakeStream {
  deviceId: string | undefined;
  stopped: boolean;
  getTracks: () => { stop: () => void }[];
}

describe('AudioEngine lifecycle', () => {
  let contexts: FakeAudioContext[];
  let streams: FakeStream[];
  let missingDevices: Set<string>;
  let getUserMedia: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    contexts = [];
    streams = [];
    missingDevices = new Set();
    getUserMedia = vi.fn(async (constraints: MediaStreamConstraints) => {
      const audio = constraints.audio as MediaTrackConstraints;
      const deviceId = (audio.deviceId as ConstrainDOMStringParameters | undefined)?.exact as string | undefined;
      if (deviceId && missingDevices.has(deviceId)) throw new DOMException('gone', 'OverconstrainedError');
      const stream: FakeStream = {
        deviceId,
        stopped: false,
        getTracks: () => [{ stop: () => { stream.stopped = true; } }]
      };
      streams.push(stream);
      return stream;
    });
    vi.stubGlobal('window', {
      AudioContext: class extends FakeAudioContext {
        constructor() {
          super();
          contexts.push(this);
        }
      }
    });
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reuses the AudioContext and amp across reconnections', async () => {
    const engine = new AudioEngine();
    await engine.start('a', 'ch1');
    const amp = engine.getTone3000();
    await engine.start('b', 'ch2');
    expect(contexts).toHaveLength(1);
    expect(engine.getTone3000()).toBe(amp);
    expect(streams.map((s) => s.stopped)).toEqual([true, false]);
  });

  it('serializes overlapping start calls so only one stream stays open', async () => {
    const engine = new AudioEngine();
    await engine.start('a');
    await Promise.all([engine.start('b'), engine.start('c'), engine.stop(), engine.start('d')]);
    const open = streams.filter((s) => !s.stopped);
    expect(open).toHaveLength(1);
    expect(open[0].deviceId).toBe('d');
    expect(engine.getIsRunning()).toBe(true);
  });

  it("start('') switches back to the system default device", async () => {
    const engine = new AudioEngine();
    await engine.start('usb-interface');
    await engine.start('');
    expect(streams.at(-1)?.deviceId).toBeUndefined();
    expect(engine.getSelectedDeviceId()).toBe('');
  });

  it('falls back to the default input when the remembered device is gone', async () => {
    missingDevices.add('unplugged');
    const engine = new AudioEngine();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await engine.start('unplugged');
    expect(streams).toHaveLength(1);
    expect(streams[0].deviceId).toBeUndefined();
    expect(engine.getSelectedDeviceId()).toBe('');
  });

  it('still rejects real permission errors', async () => {
    getUserMedia.mockRejectedValueOnce(new DOMException('denied', 'NotAllowedError'));
    const engine = new AudioEngine();
    await expect(engine.start('usb-interface')).rejects.toThrow('denied');
    // The queue keeps working after a failed start
    await engine.start('usb-interface');
    expect(engine.getIsRunning()).toBe(true);
  });

  it('does not hang stop() when the context suspends during the fade', async () => {
    const engine = new AudioEngine();
    await engine.start('a');
    const ctx = contexts[0];
    ctx.holdClock = true;
    const stopped = engine.stop();
    ctx.setState('suspended');
    await expect(stopped).resolves.toBeUndefined();
    expect(streams[0].stopped).toBe(true);
  });

  it('dispose closes the context and the next start builds a fresh one', async () => {
    const engine = new AudioEngine();
    await engine.start('a');
    await engine.dispose();
    expect(contexts[0].state).toBe('closed');
    expect(engine.getTone3000()).toBeNull();
    await engine.start('a');
    expect(contexts).toHaveLength(2);
  });
});
