import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TONE3000_DEFAULT_SETTINGS } from '../services/tone3000Amp';
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

// Valid TONE3000 settings that satisfy every range check
const VALID_TONE3000 = {
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
      channelMode: 'ch1',
      tone3000: null,
      lastSong: null,
      nickname: null
    });
  });

  it('returns defaults when the stored value is not a JSON object', () => {
    ls.setItem(STORAGE_KEY, JSON.stringify([1, 2, 3]));
    expect(readPreferences()).toEqual({
      deviceId: '',
      channelMode: 'ch1',
      tone3000: null,
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
      channelMode: 'ch1',
      tone3000: null,
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
// readPreferences — TONE3000 validation
// ---------------------------------------------------------------------------
describe('readPreferences tone3000 validation', () => {
  it('reads a fully valid tone3000 object', () => {
    ls.setItem(STORAGE_KEY, JSON.stringify({ tone3000: VALID_TONE3000 }));
    expect(readPreferences().tone3000).toEqual(VALID_TONE3000);
  });

  it('discards tone3000 when gain is out of range', () => {
    ls.setItem(STORAGE_KEY, JSON.stringify({ tone3000: { ...VALID_TONE3000, gain: 101 } }));
    expect(readPreferences().tone3000).toBeNull();
  });

  it('discards tone3000 when bass is out of range', () => {
    ls.setItem(STORAGE_KEY, JSON.stringify({ tone3000: { ...VALID_TONE3000, bass: 13 } }));
    expect(readPreferences().tone3000).toBeNull();
  });

  it('discards tone3000 when gateThreshold is out of range', () => {
    ls.setItem(STORAGE_KEY, JSON.stringify({ tone3000: { ...VALID_TONE3000, gateThreshold: -19 } }));
    expect(readPreferences().tone3000).toBeNull();
  });

  it('discards tone3000 when masterVolume is out of range', () => {
    ls.setItem(STORAGE_KEY, JSON.stringify({ tone3000: { ...VALID_TONE3000, masterVolume: 1.1 } }));
    expect(readPreferences().tone3000).toBeNull();
  });

  it('discards tone3000 when cabSim is an unknown value', () => {
    ls.setItem(STORAGE_KEY, JSON.stringify({ tone3000: { ...VALID_TONE3000, cabSim: '8x10_bass' } }));
    expect(readPreferences().tone3000).toBeNull();
  });

  it('discards tone3000 when preset is not a known AMP_PRESETS key', () => {
    ls.setItem(STORAGE_KEY, JSON.stringify({ tone3000: { ...VALID_TONE3000, preset: 'jazz' } }));
    expect(readPreferences().tone3000).toBeNull();
  });

  it('discards tone3000 when isMonitoringEnabled is not a boolean', () => {
    ls.setItem(STORAGE_KEY, JSON.stringify({ tone3000: { ...VALID_TONE3000, isMonitoringEnabled: 1 } }));
    expect(readPreferences().tone3000).toBeNull();
  });

  it('discards tone3000 when a numeric field is not finite', () => {
    ls.setItem(STORAGE_KEY, JSON.stringify({ tone3000: { ...VALID_TONE3000, gain: null } }));
    expect(readPreferences().tone3000).toBeNull();
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
      tone3000: VALID_TONE3000,
      lastSong: { songId: 5, partId: 1 },
      nickname: null
    }));
    savePreferences({ channelMode: 'both' });
    const prefs = readPreferences();
    expect(prefs.deviceId).toBe('dev-1');
    expect(prefs.channelMode).toBe('both');
    expect(prefs.tone3000).toEqual(VALID_TONE3000);
    expect(prefs.lastSong).toEqual({ songId: 5, partId: 1 });
  });

  it('saves default TONE3000 settings correctly', () => {
    savePreferences({ tone3000: TONE3000_DEFAULT_SETTINGS });
    expect(readPreferences().tone3000).toEqual(TONE3000_DEFAULT_SETTINGS);
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
      channelMode: 'ch1',
      tone3000: null,
      lastSong: null,
      nickname: null
    });
  });
});
