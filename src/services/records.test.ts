import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearRecords,
  exportLocalData,
  getHistory,
  getPersonalBest,
  recordRun,
  type RunMode,
  type RunResult
} from './records';

const STORAGE_KEY = 'prgb:records:v1';

// In-memory Storage, so each test starts from a known state
const memoryStorage = (initial: Record<string, string> = {}): Storage => {
  const items = new Map(Object.entries(initial));
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => {
      items.delete(key);
    },
    setItem: (key, value) => {
      items.set(key, String(value));
    }
  };
};

// Every call fails, like a browser with site data blocked
const blockedStorage = (): Storage => {
  const fail = () => {
    throw new DOMException('blocked', 'SecurityError');
  };
  return { length: 0, clear: fail, getItem: fail, key: fail, removeItem: fail, setItem: fail };
};

const run = (overrides: Partial<RunResult> = {}): RunResult => ({
  songId: 123,
  partId: 0,
  title: 'Master of Puppets',
  artist: 'Metallica',
  trackName: 'James Hetfield',
  score: 1000,
  accuracy: 90,
  maxCombo: 20,
  perfect: 10,
  good: 5,
  miss: 2,
  speed: 1,
  mode: 'solo',
  playedAt: '2026-10-28T12:00:00.000Z',
  ...overrides
});

const saved = (storage: Storage): unknown => JSON.parse(storage.getItem(STORAGE_KEY) ?? 'null');

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('recordRun and getPersonalBest', () => {
  it('makes the first run with points the personal best', () => {
    const storage = memoryStorage();
    expect(recordRun(run(), storage)).toEqual({ isPersonalBest: true, previousBest: null });
    expect(getPersonalBest(123, 0, 1, storage)).toEqual(run());
  });

  it('counts only a strictly higher score as a new record (a tie is not)', () => {
    const storage = memoryStorage();
    recordRun(run({ score: 1000 }), storage);
    expect(recordRun(run({ score: 900 }), storage)).toEqual({ isPersonalBest: false, previousBest: run({ score: 1000 }) });
    expect(recordRun(run({ score: 1000, accuracy: 99 }), storage))
      .toEqual({ isPersonalBest: false, previousBest: run({ score: 1000 }) });
    expect(recordRun(run({ score: 1001 }), storage)).toEqual({ isPersonalBest: true, previousBest: run({ score: 1000 }) });
    expect(getPersonalBest(123, 0, 1, storage)?.score).toBe(1001);
  });

  it('never makes a run with 0 points a record, but keeps it in the history', () => {
    const storage = memoryStorage();
    expect(recordRun(run({ score: 0 }), storage)).toEqual({ isPersonalBest: false, previousBest: null });
    expect(getPersonalBest(123, 0, 1, storage)).toBeNull();
    expect(getHistory(undefined, storage)).toEqual([run({ score: 0 })]);
  });

  it('keeps one record per song, part and speed, so slower speeds never compete with 1x', () => {
    const storage = memoryStorage();
    recordRun(run({ score: 1000 }), storage);
    expect(recordRun(run({ score: 5000, speed: 0.5 }), storage)).toEqual({ isPersonalBest: true, previousBest: null });
    expect(recordRun(run({ score: 200, partId: 1 }), storage).isPersonalBest).toBe(true);
    expect(getPersonalBest(123, 0, undefined, storage)?.score).toBe(1000);
    expect(getPersonalBest(123, 0, 0.5, storage)?.score).toBe(5000);
    expect(getPersonalBest(123, 0, 0.75, storage)).toBeNull();
    expect(getPersonalBest(123, 1, 1, storage)?.score).toBe(200);
  });

  it('accepts the offline demo, every speed and mode, and fractional accuracy', () => {
    const storage = memoryStorage();
    const demo = run({ songId: -1, speed: 0.75, mode: 'duo-online', accuracy: 87.5 });
    expect(recordRun(demo, storage).isPersonalBest).toBe(true);
    expect(getPersonalBest(-1, 0, 0.75, storage)).toEqual(demo);
    expect(recordRun(run({ mode: 'duo-local', accuracy: 100 }), storage).isPersonalBest).toBe(true);
  });

  it('keeps at most 500 records, dropping the songs left unplayed the longest', () => {
    // Most recently played first: song 500 is the one left unplayed the longest
    const bests = Array.from({ length: 500 }, (_, i) => run({ songId: i + 1 }));
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify({ version: 1, history: [], bests }) });
    expect(recordRun(run({ songId: 500, score: 10 }), storage).isPersonalBest).toBe(false);
    expect(recordRun(run({ songId: 501 }), storage).isPersonalBest).toBe(true);
    expect(saved(storage)).toHaveProperty('bests.length', 500);
    expect(getPersonalBest(499, 0, 1, storage)).toBeNull();
    expect(getPersonalBest(500, 0, 1, storage)).not.toBeNull();
    expect(getPersonalBest(501, 0, 1, storage)).not.toBeNull();
  });
});

describe('getHistory', () => {
  it('lists runs most recent first and keeps only the last 50', () => {
    const storage = memoryStorage();
    for (let score = 1; score <= 60; score++) recordRun(run({ score }), storage);
    const history = getHistory(undefined, storage);
    expect(history).toHaveLength(50);
    expect(history[0].score).toBe(60);
    expect(history[49].score).toBe(11);
    expect(getHistory(3, storage).map((entry) => entry.score)).toEqual([60, 59, 58]);
    expect(getHistory(0, storage)).toEqual([]);
    expect(getHistory(-1, storage)).toEqual([]);
  });
});

describe('validation', () => {
  it('refuses runs with invalid numbers without saving or throwing', () => {
    const storage = memoryStorage();
    recordRun(run({ score: 1000 }), storage);
    const invalid: Partial<RunResult>[] = [
      { score: -1 }, { score: 1.5 }, { score: Number.NaN }, { score: Number.POSITIVE_INFINITY },
      { accuracy: 101 }, { accuracy: -1 }, { accuracy: Number.NaN },
      { maxCombo: 2.5 }, { perfect: -3 }, { good: Number.NaN }, { miss: 1e300 },
      { speed: 2 }, { speed: 0 }, { songId: 0 }, { songId: -2 }, { songId: 1.5 }, { partId: -1 },
      { mode: 'online' as unknown as RunMode }, { playedAt: 'ontem' }, { playedAt: '2026-13-45T99:99:99Z' }
    ];
    for (const overrides of invalid) {
      expect(recordRun(run({ score: 5000, ...overrides }), storage).isPersonalBest, JSON.stringify(overrides)).toBe(false);
    }
    expect(getHistory(undefined, storage)).toHaveLength(1);
    expect(getPersonalBest(123, 0, 1, storage)?.score).toBe(1000);
  });

  it('trims long text and strips control characters instead of losing the run', () => {
    const storage = memoryStorage();
    const outcome = recordRun(run({ title: '🎸'.repeat(200), artist: 'AC\u0000DC‮', trackName: 'Lead\nGuitar' }), storage);
    expect(outcome.isPersonalBest).toBe(true);
    const best = getPersonalBest(123, 0, 1, storage);
    expect(best?.title).toBe('🎸'.repeat(120));
    expect(best?.artist).toBe('ACDC');
    expect(best?.trackName).toBe('LeadGuitar');
  });

  it('stores playedAt as UTC ISO 8601', () => {
    const storage = memoryStorage();
    recordRun(run({ playedAt: '2026-10-28T09:00:00-03:00' }), storage);
    expect(getHistory(1, storage)[0].playedAt).toBe('2026-10-28T12:00:00.000Z');
  });
});

describe('reading stored data', () => {
  it('treats corrupted or outdated data as empty and replaces it on the next save', () => {
    const broken = ['not json', 'null', '[]', '42', '{"version":0,"history":[],"bests":[]}', '{"version":1,"history":{},"bests":[]}',
      '{"version":1}'];
    for (const raw of broken) {
      const storage = memoryStorage({ [STORAGE_KEY]: raw });
      expect(getHistory(undefined, storage), raw).toEqual([]);
      expect(getPersonalBest(123, 0, 1, storage), raw).toBeNull();
      expect(recordRun(run(), storage), raw).toEqual({ isPersonalBest: true, previousBest: null });
      expect(getHistory(undefined, storage), raw).toEqual([run()]);
    }
  });

  it('never overwrites or clears data saved by a newer version', () => {
    const newer = JSON.stringify({
      version: 2,
      history: [run({ score: 7000 })],
      bests: [run({ score: 7000 })],
      somethingNew: { kept: true }
    });
    const storage = memoryStorage({ [STORAGE_KEY]: newer });
    expect(getHistory(undefined, storage)).toEqual([]);
    expect(getPersonalBest(123, 0, 1, storage)).toBeNull();
    expect(recordRun(run({ score: 9000 }), storage)).toEqual({ isPersonalBest: false, previousBest: null });
    clearRecords(storage);
    expect(storage.getItem(STORAGE_KEY)).toBe(newer);
    expect(JSON.parse(exportLocalData(storage))).toMatchObject({ personalBests: [], history: [] });
  });

  it('drops invalid, duplicated and unknown data but keeps the valid entries', () => {
    const storage = memoryStorage({
      [STORAGE_KEY]: JSON.stringify({
        version: 1,
        history: [run({ score: 1 }), { nope: true }, run({ accuracy: 200 }), run({ title: 'x'.repeat(121) }),
          run({ trackName: 'a\u0007' }), 'text', null, run({ score: 2 })],
        bests: [run({ score: 300 }), run({ score: 999 }), { ...run({ songId: 7 }), extra: 'field' }]
      })
    });
    expect(getHistory(undefined, storage).map((entry) => entry.score)).toEqual([1, 2]);
    expect(getPersonalBest(123, 0, 1, storage)?.score).toBe(300);
    expect(getPersonalBest(7, 0, 1, storage)).toEqual(run({ songId: 7 }));
  });
});

describe('storage failures', () => {
  it('never throws when storage is blocked', () => {
    const storage = blockedStorage();
    expect(recordRun(run(), storage)).toEqual({ isPersonalBest: true, previousBest: null });
    expect(getPersonalBest(123, 0, 1, storage)).toBeNull();
    expect(getHistory(undefined, storage)).toEqual([]);
    expect(() => clearRecords(storage)).not.toThrow();
    expect(JSON.parse(exportLocalData(storage))).toMatchObject({ personalBests: [], history: [] });
  });

  it('still reports the outcome when storage is full', () => {
    const storage = memoryStorage();
    recordRun(run({ score: 1000 }), storage);
    storage.setItem = () => {
      throw new DOMException('full', 'QuotaExceededError');
    };
    expect(recordRun(run({ score: 2000 }), storage)).toEqual({ isPersonalBest: true, previousBest: run({ score: 1000 }) });
    expect(getPersonalBest(123, 0, 1, storage)?.score).toBe(1000);
  });

  it('uses localStorage by default', () => {
    const storage = memoryStorage();
    vi.stubGlobal('localStorage', storage);
    recordRun(run());
    expect(getHistory()).toEqual([run()]);
    expect(getPersonalBest(123, 0)).toEqual(run());
    clearRecords();
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('keeps working when reading localStorage itself throws', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get: () => {
        throw new DOMException('blocked', 'SecurityError');
      }
    });
    try {
      expect(recordRun(run())).toEqual({ isPersonalBest: true, previousBest: null });
      expect(getHistory()).toEqual([]);
      expect(() => clearRecords()).not.toThrow();
    } finally {
      if (original) Object.defineProperty(globalThis, 'localStorage', original);
      else Reflect.deleteProperty(globalThis, 'localStorage');
    }
  });
});

describe('clearRecords and exportLocalData', () => {
  it('clearRecords erases records and history', () => {
    const storage = memoryStorage({ other: 'kept' });
    recordRun(run(), storage);
    clearRecords(storage);
    expect(getHistory(undefined, storage)).toEqual([]);
    expect(getPersonalBest(123, 0, 1, storage)).toBeNull();
    expect(storage.getItem('other')).toBe('kept');
  });

  it('exportLocalData returns readable JSON with the personal bests and the history', () => {
    const storage = memoryStorage();
    recordRun(run({ score: 1000 }), storage);
    recordRun(run({ score: 500 }), storage);
    const text = exportLocalData(storage);
    expect(text).toContain('\n  "personalBests": [');
    const data: unknown = JSON.parse(text);
    expect(data).toMatchObject({
      app: 'PRGB',
      version: 1,
      personalBests: [run({ score: 1000 })],
      history: [run({ score: 500 }), run({ score: 1000 })]
    });
    expect(data).toHaveProperty('exportedAt', expect.stringMatching(/^\d{4}-\d{2}-\d{2}T.+Z$/));
  });
});
