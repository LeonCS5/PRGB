import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTH_STORAGE_KEY } from '../services/backend/supabaseClient';
import { DEFAULT_APPEARANCE } from '../appearance/defaults';
import { getAppearance, reloadAppearance, setAppearance } from '../appearance/useAppearance';
import { APPEARANCE_STORAGE_KEY } from '../appearance/validate';
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
const PROGRESS_KEY = 'prgb:progress:v1';

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
        ampEngine: null,
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

  it('includes the progress and says so in the description', () => {
    ls.setItem(PROGRESS_KEY, JSON.stringify({ version: 1, totals: { runs: 4, practiceMs: 90000, trainingLaps: 0, archivedStars: 0 } }));
    const result = JSON.parse(buildLocalDataExport()) as Record<string, unknown>;
    expect(result.progress).toMatchObject({ version: 1, totals: { runs: 4, practiceMs: 90000 }, level: 'Corda solta' });
    expect(result.description).toContain('progresso');
  });

  it('includes the saved appearance, null when there is none, and says so in the description', () => {
    expect((JSON.parse(buildLocalDataExport()) as Record<string, unknown>).appearance).toBeNull();
    reloadAppearance();
    setAppearance({ themeId: 'midnight-arcade' });
    const result = JSON.parse(buildLocalDataExport()) as Record<string, unknown>;
    expect(result.appearance).toMatchObject({ version: 1, settings: { themeId: 'midnight-arcade' } });
    expect(result.description).toContain('aparência');
  });

  it('includes saved preferences when the storage has them', () => {
    ls.setItem(PREFS_KEY, JSON.stringify({ deviceId: 'dev-xyz', channelMode: 'ch2', ampEngine: null, lastSong: null, nickname: null }));
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

  it('removes the progress key from localStorage', () => {
    ls.setItem(PROGRESS_KEY, JSON.stringify({ version: 1 }));
    clearLocalData();
    expect(ls.getItem(PROGRESS_KEY)).toBeNull();
  });

  it('removes the saved appearance and goes back to the default look at once', () => {
    reloadAppearance();
    setAppearance({ themeId: 'midnight-arcade' });
    expect(ls.getItem(APPEARANCE_STORAGE_KEY)).not.toBeNull();
    clearLocalData();
    expect(ls.getItem(APPEARANCE_STORAGE_KEY)).toBeNull();
    expect(getAppearance()).toEqual(DEFAULT_APPEARANCE);
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
