import { describe, expect, it } from 'vitest';
import { exerciseSongId } from '../services/exerciseIds';
import { loadProgress, PROGRESS_STORAGE_KEY, type FinishedRun } from '../services/progress';
import type { ScoreState } from '../services/scoring';
import { recordLatencyTestSaved, recordRunProgress, saveWeeklyGoal } from './progressStore';

const memoryStorage = (): Storage => {
  const items = new Map<string, string>();
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

const NOW = new Date(2026, 10, 16, 12).getTime();
const EXERCISE = exerciseSongId(40, 0);
const score = (perfect: number, good: number, miss: number): ScoreState => ({ score: 0, combo: 0, maxCombo: perfect, perfect, good, miss });
const run = (over: Partial<FinishedRun> = {}): FinishedRun => ({
  songId: EXERCISE, partId: 0, score: score(100, 0, 0), speed: 1, jumped: false, speedChanged: false, laps: 1, playedMs: 120_000, ...over
});

describe('recordRunProgress', () => {
  it('saves a solo run and reports stars, time and the first pick', () => {
    const storage = memoryStorage();
    const outcome = recordRunProgress('solo', run(), NOW, storage);
    expect(outcome?.report).toMatchObject({ ownContent: true, rated: true, stars: 3, starsGained: 3 });
    expect(outcome?.report.newAchievements).toContain('primeira-palhetada');
    expect(outcome?.countedMs).toBe(120_000);
    const saved = loadProgress(storage);
    expect(saved.totals.runs).toBe(1);
    expect(saved.contents[`${EXERCISE}:0`].stars).toBe(3);
  });

  it('adds up across runs', () => {
    const storage = memoryStorage();
    recordRunProgress('solo', run(), NOW, storage);
    const second = recordRunProgress('solo', run({ playedMs: 30_000 }), NOW + 1000, storage);
    expect(second?.countedMs).toBe(30_000);
    expect(loadProgress(storage).totals).toMatchObject({ runs: 2, practiceMs: 150_000 });
  });

  it('counts the time of a run with a seek but gives it no star', () => {
    const storage = memoryStorage();
    const outcome = recordRunProgress('solo', run({ jumped: true }), NOW, storage);
    expect(outcome?.report).toMatchObject({ rated: false, stars: 0, starsGained: 0 });
    expect(outcome?.countedMs).toBe(120_000);
    expect(loadProgress(storage).totals.practiceMs).toBe(120_000);
  });

  it('counts only time for a song of the external catalog', () => {
    const storage = memoryStorage();
    const outcome = recordRunProgress('solo', run({ songId: 1234 }), NOW, storage);
    expect(outcome?.report).toMatchObject({ ownContent: false, stars: 0 });
    expect(outcome?.countedMs).toBe(120_000);
    expect(loadProgress(storage).contents).toEqual({});
  });

  it.each(['duo', 'online', 'preview'] as const)('never records a %s run', (mode) => {
    const storage = memoryStorage();
    expect(recordRunProgress(mode, run(), NOW, storage)).toBeUndefined();
    expect(storage.getItem(PROGRESS_STORAGE_KEY)).toBeNull();
  });
});

describe('recordLatencyTestSaved', () => {
  it('unlocks the latency pick once and saves it', () => {
    const storage = memoryStorage();
    expect(recordLatencyTestSaved(NOW, storage)).toEqual(['mao-no-tempo']);
    expect(Object.keys(loadProgress(storage).achievements)).toEqual(['mao-no-tempo']);
    expect(recordLatencyTestSaved(NOW + 1000, storage)).toEqual([]);
  });
});

describe('saveWeeklyGoal', () => {
  it('saves the goal and keeps the rest of the progress', () => {
    const storage = memoryStorage();
    recordRunProgress('solo', run(), NOW, storage);
    expect(saveWeeklyGoal(5, storage).prefs.weeklyGoal).toBe(5);
    const saved = loadProgress(storage);
    expect(saved.prefs.weeklyGoal).toBe(5);
    expect(saved.totals.runs).toBe(1);
  });

  it('is read back by the next run, whose summary shows the goal', () => {
    const storage = memoryStorage();
    saveWeeklyGoal(3, storage);
    expect(recordRunProgress('solo', run(), NOW, storage)?.report.weekly.goal).toBe(3);
  });

  it('clears the goal with null and rejects a value outside 3, 5, 7', () => {
    const storage = memoryStorage();
    saveWeeklyGoal(7, storage);
    // @ts-expect-error 4 is not a WeeklyGoal: the pure setter must ignore it
    expect(saveWeeklyGoal(4, storage).prefs.weeklyGoal).toBe(7);
    expect(saveWeeklyGoal(null, storage).prefs.weeklyGoal).toBeNull();
    expect(loadProgress(storage).prefs.weeklyGoal).toBeNull();
  });

  it('does not throw when storage is blocked', () => {
    const blocked = { ...memoryStorage(), setItem: () => { throw new Error('full'); } } as Storage;
    expect(saveWeeklyGoal(5, blocked).prefs.weeklyGoal).toBe(5);
  });
});
