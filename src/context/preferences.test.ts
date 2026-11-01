import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AMP_DEFAULT_SETTINGS } from '../services/ampEngine';
import { DEFAULT_AUDIO_OPTIONS } from '../services/audioDevices';
import { clearPreferences, readPreferences, savePreferences } from './preferences';

// ---------------------------------------------------------------------------
// Minimal in-memory Storage implementation
// ---------------------------------------------------------------------------
const makeStorage = (initial: Record<string, string> = {}): Storage => {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    get length() { return store.size; },
    key: (i: number) => [...store.keys()][i] ?? null,
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); }
  } as Storage;
};

const STORAGE_KEY = 'prgb:prefs:v1';

// Valid PRGB Amp settings that satisfy every range check
const VALID_AMP = {
  isMonitoringEnabled: true,
  preset: 'metal',
  gain: 65,
  bass: 2,
  mid: -1,
  treble: 3,
  presence: 4,
  masterVolume: 0.75,
  gateThreshold: -45,
  reverbMix: 0.15,
  cabSim: '4x12_metal'
};

let ls: Storage;

beforeEach(() => {
  ls = makeStorage();
  vi.stubGlobal('localStorage', ls);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// readPreferences — defaults
// ---------------------------------------------------------------------------
describe('readPreferences defaults', () => {
  it('returns defaults when localStorage is empty', () => {
    expect(readPreferences()).toEqual({
      deviceId: '',
      inputChosen: false,
      outputDeviceId: '',
      audioOptions: DEFAULT_AUDIO_OPTIONS,
      channelMode: 'ch1',
      ampEngine: null,
      lastSong: null,
      nickname: null
    });
  });

  it('returns defaults when the stored value is not a JSON object', () => {
    ls.setItem(STORAGE_KEY, JSON.stringify([1, 2, 3]));
    expect(readPreferences()).toEqual({
      deviceId: '',
      inputChosen: false,
      outputDeviceId: '',
      audioOptions: DEFAULT_AUDIO_OPTIONS,
      channelMode: 'ch1',
      ampEngine: null,
      lastSong: null,
      nickname: null
    });
  });
});

// ---------------------------------------------------------------------------
// readPreferences — corrupted / wrong-type data
// ---------------------------------------------------------------------------
describe('readPreferences with corrupted data', () => {
  it('returns defaults when the stored JSON is invalid', () => {
    ls.setItem(STORAGE_KEY, '{ not valid json }');
    expect(readPreferences()).toEqual({
      deviceId: '',
      inputChosen: false,
      outputDeviceId: '',
      audioOptions: DEFAULT_AUDIO_OPTIONS,
      channelMode: 'ch1',
      ampEngine: null,
      lastSong: null,
      nickname: null
    });
  });

  it('falls back to default deviceId when the stored value is not a string', () => {
    ls.setItem(STORAGE_KEY, JSON.stringify({ deviceId: 42 }));
    expect(readPreferences().deviceId).toBe('');
  });

  it('falls back to default channelMode when the stored value is invalid', () => {
    ls.setItem(STORAGE_KEY, JSON.stringify({ channelMode: 'duo' }));
    expect(readPreferences().channelMode).toBe('ch1');
  });

  it('falls back to default channelMode when the value is a number', () => {
    ls.setItem(STORAGE_KEY, JSON.stringify({ channelMode: 1 }));
    expect(readPreferences().channelMode).toBe('ch1');
  });

  it('reads valid channelMode values ch1, ch2 and both', () => {
    for (const mode of ['ch1', 'ch2', 'both']) {
      ls.setItem(STORAGE_KEY, JSON.stringify({ channelMode: mode }));
      expect(readPreferences().channelMode).toBe(mode);
    }
  });
});

// ---------------------------------------------------------------------------
// readPreferences — PRGB Amp validation
// ---------------------------------------------------------------------------
describe('readPreferences ampEngine validation', () => {
  it('reads a fully valid ampEngine object', () => {
    ls.setItem(STORAGE_KEY, JSON.stringify({ ampEngine: VALID_AMP }));
    expect(readPreferences().ampEngine).toEqual(VALID_AMP);
  });

  it('discards ampEngine when gain is out of range', () => {
    ls.setItem(STORAGE_KEY, JSON.stringify({ ampEngine: { ...VALID_AMP, gain: 101 } }));
    expect(readPreferences().ampEngine).toBeNull();
  });

  it('discards ampEngine when bass is out of range', () => {
    ls.setItem(STORAGE_KEY, JSON.stringify({ ampEngine: { ...VALID_AMP, bass: 13 } }));
    expect(readPreferences().ampEngine).toBeNull();
  });

  it('discards ampEngine when gateThreshold is out of range', () => {
    ls.setItem(STORAGE_KEY, JSON.stringify({ ampEngine: { ...VALID_AMP, gateThreshold: -19 } }));
    expect(readPreferences().ampEngine).toBeNull();
  });

  it('discards ampEngine when masterVolume is out of range', () => {
    ls.setItem(STORAGE_KEY, JSON.stringify({ ampEngine: { ...VALID_AMP, masterVolume: 1.1 } }));
    expect(readPreferences().ampEngine).toBeNull();
  });

  it('discards ampEngine when cabSim is an unknown value', () => {
    ls.setItem(STORAGE_KEY, JSON.stringify({ ampEngine: { ...VALID_AMP, cabSim: '8x10_bass' } }));
    expect(readPreferences().ampEngine).toBeNull();
  });

  it('discards ampEngine when preset is not a known AMP_PRESETS key', () => {
    ls.setItem(STORAGE_KEY, JSON.stringify({ ampEngine: { ...VALID_AMP, preset: 'jazz' } }));
    expect(readPreferences().ampEngine).toBeNull();
  });

  it('discards ampEngine when isMonitoringEnabled is not a boolean', () => {
    ls.setItem(STORAGE_KEY, JSON.stringify({ ampEngine: { ...VALID_AMP, isMonitoringEnabled: 1 } }));
    expect(readPreferences().ampEngine).toBeNull();
  });

  it('discards ampEngine when a numeric field is not finite', () => {
    ls.setItem(STORAGE_KEY, JSON.stringify({ ampEngine: { ...VALID_AMP, gain: null } }));
    expect(readPreferences().ampEngine).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// readPreferences — lastSong validation
// ---------------------------------------------------------------------------
describe('readPreferences lastSong validation', () => {
  it('reads a valid lastSong', () => {
    ls.setItem(STORAGE_KEY, JSON.stringify({ lastSong: { songId: 1, partId: 0 } }));
    expect(readPreferences().lastSong).toEqual({ songId: 1, partId: 0 });
  });

  it('discards lastSong when songId is 0 (must be >= 1)', () => {
    ls.setItem(STORAGE_KEY, JSON.stringify({ lastSong: { songId: 0, partId: 0 } }));
    expect(readPreferences().lastSong).toBeNull();
  });

  it('discards lastSong when songId is not an integer', () => {
    ls.setItem(STORAGE_KEY, JSON.stringify({ lastSong: { songId: 1.5, partId: 0 } }));
    expect(readPreferences().lastSong).toBeNull();
  });

  it('discards lastSong when partId is negative', () => {
    ls.setItem(STORAGE_KEY, JSON.stringify({ lastSong: { songId: 1, partId: -1 } }));
    expect(readPreferences().lastSong).toBeNull();
  });

  it('keeps the title shown on the landing', () => {
    ls.setItem(STORAGE_KEY, JSON.stringify({ lastSong: { songId: 1, partId: 0, title: 'Minha música' } }));
    expect(readPreferences().lastSong).toEqual({ songId: 1, partId: 0, title: 'Minha música' });
  });

  it('discards lastSong when the title is not text, since it goes straight to the page', () => {
    ls.setItem(STORAGE_KEY, JSON.stringify({ lastSong: { songId: 1, partId: 0, title: { html: 'x' } } }));
    expect(readPreferences().lastSong).toBeNull();
  });

  it('discards lastSong when it is not an object', () => {
    ls.setItem(STORAGE_KEY, JSON.stringify({ lastSong: 42 }));
    expect(readPreferences().lastSong).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// readPreferences — nickname validation
// ---------------------------------------------------------------------------
describe('readPreferences nickname validation', () => {
  it('reads a valid nickname', () => {
    ls.setItem(STORAGE_KEY, JSON.stringify({ nickname: 'Joao123' }));
    expect(readPreferences().nickname).toBe('Joao123');
  });

  it('discards a nickname that is too short', () => {
    ls.setItem(STORAGE_KEY, JSON.stringify({ nickname: 'ab' }));
    expect(readPreferences().nickname).toBeNull();
  });

  it('discards a nickname with invalid characters', () => {
    ls.setItem(STORAGE_KEY, JSON.stringify({ nickname: 'user@name!' }));
    expect(readPreferences().nickname).toBeNull();
  });

  it('discards an offensive nickname', () => {
    ls.setItem(STORAGE_KEY, JSON.stringify({ nickname: 'Hitler' }));
    expect(readPreferences().nickname).toBeNull();
  });

  it('discards a nickname that is not a string', () => {
    ls.setItem(STORAGE_KEY, JSON.stringify({ nickname: 99 }));
    expect(readPreferences().nickname).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// savePreferences — partial update preserves existing keys
// ---------------------------------------------------------------------------
describe('savePreferences partial update', () => {
  it('saves a partial change without losing previously stored fields', () => {
    ls.setItem(STORAGE_KEY, JSON.stringify({
      deviceId: 'dev-1',
      channelMode: 'ch2',
      ampEngine: VALID_AMP,
      lastSong: { songId: 5, partId: 1 },
      nickname: null
    }));
    savePreferences({ channelMode: 'both' });
    const prefs = readPreferences();
    expect(prefs.deviceId).toBe('dev-1');
    expect(prefs.channelMode).toBe('both');
    expect(prefs.ampEngine).toEqual(VALID_AMP);
    expect(prefs.lastSong).toEqual({ songId: 5, partId: 1 });
  });

  it('saves default PRGB Amp settings correctly', () => {
    savePreferences({ ampEngine: AMP_DEFAULT_SETTINGS });
    expect(readPreferences().ampEngine).toEqual(AMP_DEFAULT_SETTINGS);
  });
});

// ---------------------------------------------------------------------------
// savePreferences — localStorage that throws does not break the call
// ---------------------------------------------------------------------------
describe('savePreferences with throwing localStorage', () => {
  it('does not throw when setItem throws (e.g. quota exceeded)', () => {
    const throwingStorage = makeStorage();
    throwingStorage.setItem = () => { throw new DOMException('QuotaExceededError'); };
    vi.stubGlobal('localStorage', throwingStorage);
    expect(() => savePreferences({ deviceId: 'dev-x' })).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// clearPreferences
// ---------------------------------------------------------------------------
describe('clearPreferences', () => {
  it('removes the preferences key from localStorage', () => {
    ls.setItem(STORAGE_KEY, JSON.stringify({ deviceId: 'dev-1' }));
    clearPreferences();
    expect(ls.getItem(STORAGE_KEY)).toBeNull();
  });

  it('does not throw when localStorage is empty', () => {
    expect(() => clearPreferences()).not.toThrow();
  });

  it('does not throw when removeItem throws', () => {
    const throwingStorage = makeStorage({ [STORAGE_KEY]: '{}' });
    throwingStorage.removeItem = () => { throw new DOMException('SecurityError'); };
    vi.stubGlobal('localStorage', throwingStorage);
    expect(() => clearPreferences()).not.toThrow();
  });

  it('returns defaults after clearing', () => {
    ls.setItem(STORAGE_KEY, JSON.stringify({ deviceId: 'dev-1', channelMode: 'ch2' }));
    clearPreferences();
    expect(readPreferences()).toEqual({
      deviceId: '',
      inputChosen: false,
      outputDeviceId: '',
      audioOptions: DEFAULT_AUDIO_OPTIONS,
      channelMode: 'ch1',
      ampEngine: null,
      lastSong: null,
      nickname: null
    });
  });
});
