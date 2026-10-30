import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTH_STORAGE_KEY } from '../services/backend/supabaseClient';
import {
  buildLocalDataExport,
  clearLocalData,
  consumeLocalDataCleared,
  hasRankingSession,
  markLocalDataCleared
} from './localData';

// ---------------------------------------------------------------------------
// In-memory Storage implementation
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

const RECORDS_KEY = 'prgb:records:v1';
const PREFS_KEY = 'prgb:prefs:v1';

let ls: Storage;
let ss: Storage;

beforeEach(() => {
  ls = makeStorage();
  ss = makeStorage();
  vi.stubGlobal('localStorage', ls);
  vi.stubGlobal('sessionStorage', ss);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// buildLocalDataExport
// ---------------------------------------------------------------------------
describe('buildLocalDataExport', () => {
  it('returns a valid JSON string', () => {
    expect(() => JSON.parse(buildLocalDataExport())).not.toThrow();
  });

  it('includes a preferences field with the current preferences', () => {
    const result: unknown = JSON.parse(buildLocalDataExport());
    expect(result).toMatchObject({
      preferences: {
        deviceId: '',
        channelMode: 'ch1',
        tone3000: null,
        lastSong: null,
        nickname: null
      }
    });
  });

  it('includes records fields from exportLocalData', () => {
    const result: unknown = JSON.parse(buildLocalDataExport());
    // exportLocalData always produces app, description, version, exportedAt, personalBests, history
    expect(result).toMatchObject({
      app: 'PRGB',
      personalBests: [],
      history: []
    });
  });

  it('includes a description field from localData', () => {
    const result = JSON.parse(buildLocalDataExport()) as Record<string, unknown>;
    expect(typeof result.description).toBe('string');
    expect(result.description).toContain('eferências');
  });

  it('includes saved preferences when the storage has them', () => {
    ls.setItem(PREFS_KEY, JSON.stringify({ deviceId: 'dev-xyz', channelMode: 'ch2', tone3000: null, lastSong: null, nickname: null }));
    const result = JSON.parse(buildLocalDataExport()) as Record<string, unknown>;
    expect((result.preferences as Record<string, unknown>).deviceId).toBe('dev-xyz');
    expect((result.preferences as Record<string, unknown>).channelMode).toBe('ch2');
  });
});

// ---------------------------------------------------------------------------
// clearLocalData
// ---------------------------------------------------------------------------
describe('clearLocalData', () => {
  it('removes the records key from localStorage', () => {
    // Write a valid records structure so clearRecords does not treat it as a newer version
    ls.setItem(RECORDS_KEY, JSON.stringify({ version: 1, history: [], bests: [] }));
    clearLocalData();
    expect(ls.getItem(RECORDS_KEY)).toBeNull();
  });

  it('removes the prefs key from localStorage', () => {
    ls.setItem(PREFS_KEY, JSON.stringify({ deviceId: 'dev-1' }));
    clearLocalData();
    expect(ls.getItem(PREFS_KEY)).toBeNull();
  });

  it('does not remove the auth session key', () => {
    ls.setItem(AUTH_STORAGE_KEY, 'session-token');
    ls.setItem(RECORDS_KEY, JSON.stringify({ version: 1, history: [], bests: [] }));
    ls.setItem(PREFS_KEY, JSON.stringify({ deviceId: 'dev-1' }));
    clearLocalData();
    expect(ls.getItem(AUTH_STORAGE_KEY)).toBe('session-token');
  });

  it('does not throw when localStorage is already empty', () => {
    expect(() => clearLocalData()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// hasRankingSession
// ---------------------------------------------------------------------------
describe('hasRankingSession', () => {
  it('returns false when the auth key is absent', () => {
    expect(hasRankingSession()).toBe(false);
  });

  it('returns true when the auth key is present', () => {
    ls.setItem(AUTH_STORAGE_KEY, 'some-token');
    expect(hasRankingSession()).toBe(true);
  });

  it('returns false when localStorage throws', () => {
    const throwingStorage = makeStorage();
    throwingStorage.getItem = () => { throw new DOMException('SecurityError'); };
    vi.stubGlobal('localStorage', throwingStorage);
    expect(hasRankingSession()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// markLocalDataCleared / consumeLocalDataCleared
// ---------------------------------------------------------------------------
describe('markLocalDataCleared and consumeLocalDataCleared', () => {
  it('consumeLocalDataCleared returns false before the marker is set', () => {
    expect(consumeLocalDataCleared()).toBe(false);
  });

  it('consumeLocalDataCleared returns true after markLocalDataCleared', () => {
    markLocalDataCleared();
    expect(consumeLocalDataCleared()).toBe(true);
  });

  it('the marker is consumed exactly once — the second call returns false', () => {
    markLocalDataCleared();
    expect(consumeLocalDataCleared()).toBe(true);
    expect(consumeLocalDataCleared()).toBe(false);
  });

  it('markLocalDataCleared does not throw when sessionStorage throws', () => {
    const throwingStorage = makeStorage();
    throwingStorage.setItem = () => { throw new DOMException('QuotaExceededError'); };
    vi.stubGlobal('sessionStorage', throwingStorage);
    expect(() => markLocalDataCleared()).not.toThrow();
  });

  it('consumeLocalDataCleared returns false and does not throw when sessionStorage throws', () => {
    const throwingStorage = makeStorage();
    throwingStorage.getItem = () => { throw new DOMException('SecurityError'); };
    throwingStorage.removeItem = () => { throw new DOMException('SecurityError'); };
    vi.stubGlobal('sessionStorage', throwingStorage);
    expect(() => consumeLocalDataCleared()).not.toThrow();
    expect(consumeLocalDataCleared()).toBe(false);
  });
});
