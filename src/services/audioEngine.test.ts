import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioEngine, STANDARD_TUNING, computeNsdf, estimateStringAndFret, type InputChannelMode } from './audioEngine';

vi.mock('./tone3000Amp', () => ({
  Tone3000AmpEngine: class {
    inputNode = {};
    processGate = vi.fn();
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

describe('computeNsdf', () => {
  // Textbook NSDF, every sum computed from scratch for each lag
  const naiveNsdf = (buffer: Float32Array, maxLag: number): number[] =>
    Array.from({ length: maxLag + 1 }, (_, tau) => {
      let acf = 0;
      let divisor = 0;
      for (let i = 0; i < buffer.length - tau; i++) {
        acf += buffer[i] * buffer[i + tau];
        divisor += buffer[i] * buffer[i] + buffer[i + tau] * buffer[i + tau];
      }
      return divisor > 0 ? (2 * acf) / divisor : 0;
    });

  it('matches the textbook formula within 1e-9 relative, also on a fading note', () => {
    let seed = 7;
    const noise = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648 - 0.5;
    };
    const signals = [
      // Low E with harmonics and some noise
      Float32Array.from({ length: 2048 }, (_, i) =>
        0.3 * Math.sin((2 * Math.PI * 82.41 * i) / 48000) + 0.2 * Math.sin((2 * Math.PI * 164.82 * i) / 48000) + 0.05 * noise()),
      // A note fading fast: late lags divide by little energy, where a running sum loses precision first
      Float32Array.from({ length: 2048 }, (_, i) => Math.exp(-i / 200) * Math.sin((2 * Math.PI * 440 * i) / 48000))
    ];
    const maxLag = 1200; // 48 kHz / 40 Hz
    for (const signal of signals) {
      const fast = new Float64Array(maxLag + 1);
      computeNsdf(signal, maxLag, fast);
      const naive = naiveNsdf(signal, maxLag);
      let worst = 0;
      for (let tau = 0; tau <= maxLag; tau++) {
        // Relative to the NSDF scale (|nsdf| ≤ 1), so values crossing zero are not divided by ~0
        worst = Math.max(worst, Math.abs(fast[tau] - naive[tau]) / Math.max(Math.abs(naive[tau]), 1e-3));
      }
      expect(worst).toBeLessThan(1e-9);
      expect(fast[0]).toBeCloseTo(1, 12);
    }
  });

  it('writes zeros for silence', () => {
    const out = new Float64Array(11).fill(5);
    computeNsdf(new Float32Array(64), 10, out);
    expect(Array.from(out)).toEqual(Array(11).fill(0));
  });
});

// Minimal Web Audio / media stand-ins: enough for start/stop/dispose wiring, no DSP.
// Created nodes are recorded so tests can check the routing; analysers play back `signal`.
const audioNode = () => ({ connect: vi.fn(), disconnect: vi.fn() });

const analyserNode = () => ({
  ...audioNode(),
  fftSize: 0,
  smoothingTimeConstant: 0,
  signal: null as Float32Array | null,
  getFloatTimeDomainData(target: Float32Array) {
    target.fill(0);
    if (this.signal) target.set(this.signal.subarray(0, target.length));
  }
});

const gainNode = () => ({
  ...audioNode(),
  gain: { value: 1, cancelScheduledValues: vi.fn(), setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() }
});

// 2048 samples (the analyser size) of a sine at 48 kHz
const sine = (hz: number, amplitude = 0.5) =>
  Float32Array.from({ length: 2048 }, (_, i) => amplitude * Math.sin((2 * Math.PI * hz * i) / 48000));

class FakeAudioContext {
  state: AudioContextState = 'running';
  currentTime = 0;
  sampleRate = 48000;
  holdClock = false; // when true, scheduled ends don't fire (frozen clock)
  splitters: ReturnType<typeof audioNode>[] = [];
  mergers: ReturnType<typeof audioNode>[] = [];
  analysers: ReturnType<typeof analyserNode>[] = [];
  gains: ReturnType<typeof gainNode>[] = [];
  private listeners = new Set<() => void>();

  private keep<T>(list: T[], node: T): T {
    list.push(node);
    return node;
  }
  createGain() { return this.keep(this.gains, gainNode()); }
  // Web Audio's default channelCount, whatever the input delivers
  createMediaStreamSource() { return { ...audioNode(), channelCount: 2 }; }
  createChannelSplitter() { return this.keep(this.splitters, audioNode()); }
  createChannelMerger() { return this.keep(this.mergers, audioNode()); }
  createAnalyser() { return this.keep(this.analysers, analyserNode()); }
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

interface FakeTrack {
  stop: () => void;
  getSettings: () => MediaTrackSettings;
}

interface FakeStream {
  deviceId: string | undefined;
  stopped: boolean;
  getTracks: () => FakeTrack[];
  getAudioTracks: () => FakeTrack[];
}

describe('AudioEngine lifecycle', () => {
  let contexts: FakeAudioContext[];
  let streams: FakeStream[];
  let missingDevices: Set<string>;
  let trackChannels: number | undefined; // what the browser reports for the next stream
  let getUserMedia: ReturnType<typeof vi.fn>;
  let nextFrame: FrameRequestCallback | null;
  const runFrame = () => nextFrame?.(0);

  beforeEach(() => {
    contexts = [];
    streams = [];
    missingDevices = new Set();
    trackChannels = 2;
    nextFrame = null;
    getUserMedia = vi.fn(async (constraints: MediaStreamConstraints) => {
      const audio = constraints.audio as MediaTrackConstraints;
      const deviceId = (audio.deviceId as ConstrainDOMStringParameters | undefined)?.exact as string | undefined;
      if (deviceId && missingDevices.has(deviceId)) throw new DOMException('gone', 'OverconstrainedError');
      const settings: MediaTrackSettings = trackChannels === undefined ? {} : { channelCount: trackChannels };
      const track: FakeTrack = { stop: () => { stream.stopped = true; }, getSettings: () => settings };
      const stream: FakeStream = {
        deviceId,
        stopped: false,
        getTracks: () => [track],
        getAudioTracks: () => [track]
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
    // Frames only run when a test calls runFrame()
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      nextFrame = callback;
      return 1;
    }));
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

  describe('pitch detection across the neck', () => {
    // 2048 samples of a note built from harmonics; amplitudes[0] is the fundamental
    const tone = (hz: number, amplitudes: number[]) => {
      const total = amplitudes.reduce((sum, a) => sum + a, 0);
      return Float32Array.from({ length: 2048 }, (_, i) =>
        (0.4 / total) * amplitudes.reduce((sum, a, k) => sum + a * Math.sin((2 * Math.PI * hz * (k + 1) * i) / 48000), 0)
      );
    };

    const detect = async (signal: Float32Array) => {
      const onPitch = vi.fn();
      const engine = new AudioEngine();
      await engine.start('a', 'ch1', onPitch);
      contexts[0].analysers[0].signal = signal;
      onPitch.mockClear();
      runFrame();
      return onPitch.mock.calls[0][0] as { midiNote: number } | null;
    };

    it.each([
      ['E2 (6ª corda solta)', 82.41, 40],
      ['A2 (5ª corda solta)', 110, 45],
      ['D3 (4ª corda solta)', 146.83, 50],
      ['G3 (3ª corda solta)', 196, 55],
      ['B3 (2ª corda solta)', 246.94, 59],
      ['E4 (1ª corda solta)', 329.63, 64],
      ['E5 (1ª corda, casa 12)', 659.26, 76],
      ['B5 (1ª corda, casa 19)', 987.77, 83],
      ['D6 (1ª corda, casa 22)', 1174.66, 86],
      ['E6 (1ª corda, casa 24)', 1318.51, 88],
      ['A1 (baixo, 4ª corda)', 55, 33],
      ['E1 (baixo, 4ª corda solta)', 41.2, 28]
    ])('detects a pure %s', async (_name, hz, midi) => {
      expect(await detect(sine(hz))).toMatchObject({ midiNote: midi });
    });

    it.each([
      ['E2', 82.41, 40],
      ['A2', 110, 45],
      ['D3', 146.83, 50]
    ])('detects a harmonic-rich %s at its fundamental, not an octave up', async (_name, hz, midi) => {
      // Sawtooth-like spectrum, close to a picked electric guitar
      expect(await detect(tone(hz, [1, 1 / 2, 1 / 3, 1 / 4, 1 / 5, 1 / 6, 1 / 7, 1 / 8]))).toMatchObject({ midiNote: midi });
    });

    it('detects a low E whose fundamental is weaker than its harmonics', async () => {
      expect(await detect(tone(82.41, [0.3, 1, 0.8, 0.5, 0.4, 0.3]))).toMatchObject({ midiNote: 40 });
    });

    it('removes a DC offset before measuring the level and the pitch', async () => {
      const withOffset = sine(82.41).map((sample) => sample + 0.3);
      // The level is the sine's alone: amplitude / √2
      expect(await detect(withOffset)).toMatchObject({ midiNote: 40, volume: 0.35 });
    });

    it('reports no pitch for noise', async () => {
      let seed = 12345;
      const noise = Float32Array.from({ length: 2048 }, () => {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        return (seed / 2147483648 - 0.5) * 0.6;
      });
      expect(await detect(noise)).toBeNull();
    });
  });

  describe('attack tracking', () => {
    interface Heard { midiNote: number; attackId: number }

    // Plays one signal per frame on channel 1 and returns what was heard in each frame
    const playFrames = async (signals: (Float32Array | null)[]) => {
      const heard: (Heard | null)[] = [];
      const engine = new AudioEngine();
      await engine.start('a', 'ch1', (pitch) => heard.push(pitch));
      heard.length = 0;
      for (const signal of signals) {
        contexts[0].analysers[0].signal = signal;
        runFrame();
      }
      return heard;
    };

    const E2 = 82.41;
    const A2 = 110;

    it('keeps the attack of a note that rings while it fades', async () => {
      const heard = await playFrames(Array.from({ length: 20 }, (_, frame) => sine(E2, 0.5 * 0.9 ** frame)));
      expect(heard.every((pitch) => pitch?.midiNote === 40)).toBe(true);
      expect(new Set(heard.map((pitch) => pitch?.attackId)).size).toBe(1);
    });

    it('counts a new attack when the same note is picked again', async () => {
      const heard = await playFrames([
        ...Array.from({ length: 8 }, (_, frame) => sine(E2, 0.5 * 0.85 ** frame)), // fades to ~0.16
        sine(E2, 0.5), // picked again: 3× louder in one frame
        sine(E2, 0.45)
      ]);
      const ids = heard.map((pitch) => pitch?.attackId);
      expect(new Set(ids.slice(0, 8)).size).toBe(1);
      expect(ids[8]).toBeGreaterThan(ids[0] ?? Infinity);
      expect(ids[9]).toBe(ids[8]);
    });

    it('counts a new attack after silence', async () => {
      const heard = await playFrames([sine(E2, 0.3), sine(E2, 0.3), null, null, sine(E2, 0.3)]);
      expect(heard[2]).toBeNull();
      expect(heard[4]?.attackId).toBeGreaterThan(heard[0]?.attackId ?? Infinity);
    });

    it('counts a new attack when the note changes without a pick (hammer-on, slide)', async () => {
      const heard = await playFrames([...Array(5).fill(sine(E2, 0.3)), sine(A2, 0.3), sine(A2, 0.3), sine(A2, 0.3)]);
      expect(heard.map((pitch) => pitch?.midiNote)).toEqual([40, 40, 40, 40, 40, 45, 45, 45]);
      const ids = heard.map((pitch) => pitch?.attackId);
      // Two detections in a row make the new note stable, so one stray detection is not an attack
      expect(ids[5]).toBe(ids[0]);
      expect(ids[6]).toBeGreaterThan(ids[0] ?? Infinity);
      expect(ids[7]).toBe(ids[6]);
    });

    it('ignores a single stray detection of another note', async () => {
      const heard = await playFrames([sine(E2, 0.3), sine(E2, 0.3), sine(E2, 0.3), sine(A2, 0.3), sine(E2, 0.3),
        sine(E2, 0.3)]);
      expect(new Set(heard.map((pitch) => pitch?.attackId)).size).toBe(1);
    });

    it('merges attacks less than 3 frames apart', async () => {
      const heard = await playFrames([
        sine(E2, 0.05), sine(E2, 0.15), sine(E2, 0.45), // the window fills over a few frames: one pick
        sine(E2, 0.45), sine(E2, 0.45),
        sine(E2, 0.9) // a real new pick
      ]);
      const ids = heard.map((pitch) => pitch?.attackId);
      expect(new Set(ids.slice(0, 5)).size).toBe(1);
      expect(ids[5]).toBeGreaterThan(ids[0] ?? Infinity);
    });

    it('never hands out an attack id twice, across players and reconnections', async () => {
      const seen: [number[], number[]] = [[], []];
      const engine = new AudioEngine();
      await engine.start('a', 'duo', (pitch, player) => {
        if (pitch) seen[player].push(pitch.attackId);
      });
      const [first, second] = contexts[0].analysers;
      for (const amplitude of [0.1, 0.1, 0.1, 0.1, 0.5, 0.5]) {
        first.signal = sine(E2, amplitude);
        second.signal = sine(A2, amplitude);
        runFrame();
      }
      await engine.start('a', 'ch1');
      contexts[0].analysers[2].signal = sine(E2, 0.3);
      runFrame();
      const [player1, player2] = seen;
      // Each player's ids only grow
      for (const ids of seen) expect(ids).toEqual([...ids].sort((a, b) => a - b));
      expect(new Set(player1.slice(0, 6)).size).toBe(2); // first sound, then the jump to 0.5
      expect(new Set([...player1.slice(0, 6), ...player2]).size).toBe(4);
      // After reconnecting, the first attack is newer than every id before it
      expect(player1[6]).toBeGreaterThan(Math.max(...player1.slice(0, 6), ...player2));
    });
  });

  describe('input channel modes', () => {
    const A3 = sine(220);
    const E4 = sine(329.63);

    it.each<{ mode: InputChannelMode; channels: number[] }>([
      { mode: 'ch1', channels: [0] },
      { mode: 'ch2', channels: [1] },
      { mode: 'both', channels: [0, 1] }
    ])('$mode keeps a single detector and reports it as player 0', async ({ mode, channels }) => {
      const onPitch = vi.fn();
      const engine = new AudioEngine();
      await engine.start('a', mode, onPitch);
      const ctx = contexts[0];
      const [splitter] = ctx.splitters;
      const [merger] = ctx.mergers;
      expect(splitter.connect.mock.calls).toEqual(channels.map((channel) => [merger, channel, 0]));
      expect(ctx.analysers).toHaveLength(1);
      expect(merger.connect).toHaveBeenCalledTimes(2);
      expect(merger.connect).toHaveBeenCalledWith(ctx.analysers[0]);
      expect(merger.connect).toHaveBeenCalledWith(ctx.gains[0]);

      ctx.analysers[0].signal = A3;
      onPitch.mockClear();
      runFrame();
      expect(onPitch.mock.calls).toEqual([[expect.objectContaining({ midiNote: 57 }), 0]]);
    });

    it('duo feeds each channel to its own detector and both to the amp', async () => {
      const engine = new AudioEngine();
      await engine.start('a', 'duo');
      const ctx = contexts[0];
      const [splitter] = ctx.splitters;
      const [merger] = ctx.mergers;
      expect(ctx.analysers).toHaveLength(2);
      expect(splitter.connect).toHaveBeenCalledWith(ctx.analysers[0], 0);
      expect(splitter.connect).toHaveBeenCalledWith(ctx.analysers[1], 1);
      // The amp hears both guitars, but that mix feeds no detector
      expect(splitter.connect).toHaveBeenCalledWith(merger, 0, 0);
      expect(splitter.connect).toHaveBeenCalledWith(merger, 1, 0);
      expect(merger.connect.mock.calls).toEqual([[ctx.gains[0]]]);
    });

    it('duo detects each guitar on its own and tags the player', async () => {
      const onPitch = vi.fn();
      const engine = new AudioEngine();
      await engine.start('a', 'duo', onPitch);
      const [first, second] = contexts[0].analysers;
      first.signal = A3;
      second.signal = E4;
      onPitch.mockClear();
      runFrame();
      expect(onPitch.mock.calls).toEqual([
        [expect.objectContaining({ midiNote: 57 }), 0],
        [expect.objectContaining({ midiNote: 64 }), 1]
      ]);

      second.signal = null; // player 2 stops playing
      onPitch.mockClear();
      runFrame();
      expect(onPitch.mock.calls).toEqual([[expect.objectContaining({ midiNote: 57 }), 0], [null, 1]]);
    });

    it('duo opens the amp gate with the louder guitar', async () => {
      const engine = new AudioEngine();
      await engine.start('a', 'duo');
      const gate = vi.mocked(engine.getTone3000()!.processGate);
      const [first, second] = contexts[0].analysers;
      first.signal = sine(220, 0.1);
      second.signal = sine(329.63, 0.5);
      runFrame();
      // The RMS of a sine is its amplitude / √2
      expect(gate).toHaveBeenLastCalledWith(expect.closeTo(0.5 / Math.SQRT2, 2));
      first.signal = sine(220, 0.6);
      runFrame();
      expect(gate).toHaveBeenLastCalledWith(expect.closeTo(0.6 / Math.SQRT2, 2));
    });

    it("estimates string and fret with each player's tuning", async () => {
      const onPitch = vi.fn();
      const engine = new AudioEngine();
      const dStandard = [62, 57, 53, 48, 43, 38]; // a whole step down
      engine.setTuning(dStandard, 1);
      await engine.start('a', 'duo', onPitch);
      const [first, second] = contexts[0].analysers;
      first.signal = A3;
      second.signal = A3;
      onPitch.mockClear();
      runFrame();
      // The same A3 is string 3 fret 2 in standard tuning, but the open 2nd string a whole step down
      expect(onPitch.mock.calls).toEqual([
        [expect.objectContaining({ midiNote: 57, stringEstimate: 3, fretEstimate: 2 }), 0],
        [expect.objectContaining({ midiNote: 57, stringEstimate: 2, fretEstimate: 0 }), 1]
      ]);

      engine.setTuning(dStandard); // no player: player 0
      engine.setTuning([], 1); // empty: back to standard
      onPitch.mockClear();
      runFrame();
      expect(onPitch.mock.calls).toEqual([
        [expect.objectContaining({ stringEstimate: 2, fretEstimate: 0 }), 0],
        [expect.objectContaining({ stringEstimate: 3, fretEstimate: 2 }), 1]
      ]);
    });

    describe('areDuoChannelsMirrored', () => {
      // Runs one frame per pair of signals on the two duo channels
      const startDuo = async () => {
        const engine = new AudioEngine();
        await engine.start('a', 'duo');
        const [first, second] = contexts[0].analysers;
        const play = (frames: number, signal1: Float32Array | null, signal2: Float32Array | null) => {
          for (let i = 0; i < frames; i++) {
            first.signal = signal1;
            second.signal = signal2;
            runFrame();
          }
        };
        return { engine, play };
      };

      it('detects an interface that copies one input to both channels, after 60 frames of playing', async () => {
        const { engine, play } = await startDuo();
        expect(engine.areDuoChannelsMirrored()).toBe(false);
        play(59, A3, A3);
        expect(engine.areDuoChannelsMirrored()).toBe(false);
        play(1, A3, A3);
        expect(engine.areDuoChannelsMirrored()).toBe(true);
      });

      it('allows a gain difference under 2% but not a real second guitar', async () => {
        const { engine, play } = await startDuo();
        play(60, sine(220, 0.5), sine(220, 0.495)); // 1% quieter: still the same signal
        expect(engine.areDuoChannelsMirrored()).toBe(true);
        play(60, sine(220, 0.5), sine(220, 0.45)); // 10% quieter
        expect(engine.areDuoChannelsMirrored()).toBe(false);
        play(60, A3, E4); // two guitars
        expect(engine.areDuoChannelsMirrored()).toBe(false);
      });

      it('needs at least 90% of the last 60 frames to match', async () => {
        const { engine, play } = await startDuo();
        play(54, A3, A3);
        play(6, A3, E4);
        expect(engine.areDuoChannelsMirrored()).toBe(true);
        play(1, A3, E4); // 53 of the last 60
        expect(engine.areDuoChannelsMirrored()).toBe(false);
      });

      it('only counts frames in which both channels play', async () => {
        const { engine, play } = await startDuo();
        play(100, A3, null); // player 2 silent: says nothing about the interface
        play(100, null, null);
        expect(engine.areDuoChannelsMirrored()).toBe(false);
        play(60, A3, A3);
        expect(engine.areDuoChannelsMirrored()).toBe(true);
        play(100, A3, null); // still the last 60 frames with both playing
        expect(engine.areDuoChannelsMirrored()).toBe(true);
      });

      it('is false outside duo mode, when stopped, and starts over on each start()', async () => {
        const { engine, play } = await startDuo();
        play(60, A3, A3);
        expect(engine.areDuoChannelsMirrored()).toBe(true);
        await engine.start('a', 'duo');
        expect(engine.areDuoChannelsMirrored()).toBe(false);
        const [, , first, second] = contexts[0].analysers;
        for (let i = 0; i < 60; i++) {
          first.signal = A3;
          second.signal = A3;
          runFrame();
        }
        expect(engine.areDuoChannelsMirrored()).toBe(true);
        await engine.stop();
        expect(engine.areDuoChannelsMirrored()).toBe(false);
        await engine.start('a', 'both');
        contexts[0].analysers[4].signal = A3;
        for (let i = 0; i < 60; i++) runFrame();
        expect(engine.areDuoChannelsMirrored()).toBe(false);
      });
    });

    it('reports how many channels the input delivers', async () => {
      const engine = new AudioEngine();
      expect(engine.getInputChannelCount()).toBe(0);
      await engine.start('a', 'duo');
      expect(engine.getInputChannelCount()).toBe(2);
      trackChannels = 1; // e.g. a USB microphone
      await engine.start('mic');
      expect(engine.getInputChannelCount()).toBe(1);
      // Not reported by the browser: 1, not the source node's channelCount (always 2)
      trackChannels = undefined;
      await engine.start('a');
      expect(engine.getInputChannelCount()).toBe(1);
      await engine.stop();
      expect(engine.getInputChannelCount()).toBe(0);
    });

    it.each(['stop', 'dispose'] as const)('%s fades out and releases both duo detectors', async (method) => {
      const onPitch = vi.fn();
      const engine = new AudioEngine();
      await engine.start('a', 'duo', onPitch);
      const ctx = contexts[0];
      const queuedFrame = nextFrame;
      await engine[method]();
      expect(ctx.gains[0].gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(0, expect.any(Number));
      for (const analyser of ctx.analysers) expect(analyser.disconnect).toHaveBeenCalled();
      ctx.analysers[0].signal = A3;
      onPitch.mockClear();
      queuedFrame?.(0);
      expect(onPitch).not.toHaveBeenCalled();
    });

    it('switching from duo to one channel drops player 2', async () => {
      const onPitch = vi.fn();
      const engine = new AudioEngine();
      await engine.start('a', 'duo', onPitch);
      await engine.start('a', 'ch1');
      const ctx = contexts[0];
      expect(ctx.analysers).toHaveLength(3);
      expect(ctx.analysers[0].disconnect).toHaveBeenCalled();
      expect(ctx.analysers[1].disconnect).toHaveBeenCalled();
      ctx.analysers[2].signal = A3;
      onPitch.mockClear();
      runFrame();
      expect(onPitch.mock.calls).toEqual([[expect.objectContaining({ midiNote: 57 }), 0]]);
    });

    it('duo goes through the same start queue and device fallback', async () => {
      missingDevices.add('unplugged');
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const engine = new AudioEngine();
      await Promise.all([engine.start('a', 'duo'), engine.start('unplugged', 'duo')]);
      warn.mockRestore();
      expect(streams.filter((s) => !s.stopped)).toHaveLength(1);
      expect(engine.getSelectedDeviceId()).toBe('');
      expect(contexts[0].analysers.filter((a) => a.disconnect.mock.calls.length === 0)).toHaveLength(2);
    });
  });
});
