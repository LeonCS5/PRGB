import { describe, expect, it } from 'vitest';
import { exerciseSongId } from './exerciseIds';
import {
  PROGRESS_STORAGE_KEY,
  clearProgress,
  createProgress,
  exportProgress,
  levelFor,
  loadProgress,
  parseProgress,
  recordEvent,
  recordRun,
  saveProgress,
  setCalmMode,
  setWeeklyGoal,
  starsFor,
  weekStartOf,
  weeklyProgress,
  type FinishedRun,
  type Progress
} from './progress';
import type { ScoreState } from './scoring';

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

// Local-time instants, so the tests do not depend on the machine's time zone
const at = (y: number, m: number, d: number, h = 12, min = 0): number => new Date(y, m - 1, d, h, min).getTime();

const PENTATONIC = exerciseSongId(40, 0);
const SCALE = exerciseSongId(60, 0);
const CHORDS = exerciseSongId(100, 0);

const score = (perfect: number, good: number, miss: number, maxCombo = perfect + good): ScoreState =>
  ({ score: 0, combo: 0, maxCombo, perfect, good, miss });

const run = (over: Partial<FinishedRun> = {}): FinishedRun => ({
  songId: PENTATONIC,
  partId: 0,
  score: score(100, 0, 0),
  speed: 1,
  jumped: false,
  speedChanged: false,
  laps: 1,
  playedMs: 120_000,
  ...over
});

const play = (progress: Progress, over: Partial<FinishedRun>, now = at(2026, 11, 16)) => recordRun(progress, run(over), now);

describe('starsFor thresholds', () => {
  it('gives 0, 1, 2 and 3 stars exactly at the borders', () => {
    expect(starsFor(score(69, 0, 31))).toBe(0); // 69%
    expect(starsFor(score(70, 0, 30))).toBe(1); // 70%
    expect(starsFor(score(89, 0, 11))).toBe(1); // 89%
    expect(starsFor(score(90, 0, 10))).toBe(2); // 90%
    expect(starsFor(score(96, 0, 4))).toBe(2); // 96%
    expect(starsFor(score(97, 0, 3))).toBe(2); // 97% but 3 misses: combo broken more than once
    expect(starsFor(score(98, 0, 2))).toBe(2); // 98% with 2 misses
    expect(starsFor(score(99, 0, 1))).toBe(3); // one miss is allowed
    expect(starsFor(score(100, 0, 0))).toBe(3);
  });

  it('gives nothing to a run too short to judge', () => {
    expect(starsFor(score(7, 0, 0))).toBe(0);
    expect(starsFor(score(8, 0, 0))).toBe(3);
  });

  it('counts good hits as hits', () => {
    expect(starsFor(score(10, 90, 0))).toBe(3);
  });
});

describe('recordRun stars', () => {
  it('only goes up, never down', () => {
    let progress = createProgress();
    progress = play(progress, { score: score(100, 0, 0) }).progress;
    const lower = play(progress, { score: score(70, 0, 30) });
    expect(lower.progress.contents[`${PENTATONIC}:0`].stars).toBe(3);
    expect(lower.report.stars).toBe(1);
    expect(lower.report.starsGained).toBe(0);
    expect(lower.report.previousStars).toBe(3);
  });

  it('reports stars gained over the previous best', () => {
    const first = play(createProgress(), { score: score(75, 0, 25) });
    expect(first.report.starsGained).toBe(1);
    const second = play(first.progress, { score: score(95, 0, 5) });
    expect(second.report.starsGained).toBe(1);
    expect(second.report.previousStars).toBe(1);
  });

  it('keeps the best accuracy and combo', () => {
    let progress = play(createProgress(), { score: score(95, 0, 5, 40) }).progress;
    progress = play(progress, { score: score(80, 0, 20, 70) }).progress;
    const content = progress.contents[`${PENTATONIC}:0`];
    expect(content.bestAccuracy).toBe(95);
    expect(content.bestCombo).toBe(70);
    expect(content.plays).toBe(2);
  });

  it('gives no stars for a run with a seek, but the time still counts', () => {
    const result = play(createProgress(), { jumped: true });
    expect(result.report.stars).toBe(0);
    expect(result.report.rated).toBe(false);
    expect(result.progress.contents[`${PENTATONIC}:0`].stars).toBe(0);
    expect(result.progress.totals.practiceMs).toBe(120_000);
    expect(Object.keys(result.progress.achievements)).toEqual([]);
    expect(weeklyProgress(result.progress, at(2026, 11, 16)).daysDone).toBe(1);
  });

  it('gives no stars or picks for a speed change, but the time still counts', () => {
    const result = play(createProgress(), { speedChanged: true });
    expect(result.report.stars).toBe(0);
    expect(result.report.newAchievements).toEqual([]);
    expect(result.progress.totals.practiceMs).toBe(120_000);
  });

  it('gives no stars for more than one training lap, but laps and time count', () => {
    const result = play(createProgress(), { laps: 3 });
    expect(result.report.stars).toBe(0);
    expect(result.progress.totals.trainingLaps).toBe(3);
    expect(result.progress.totals.practiceMs).toBe(120_000);
  });
});

describe('external catalog songs', () => {
  it('count only time and the run total: never stars, picks or content', () => {
    const result = play(createProgress(), { songId: 123456, partId: 2 });
    expect(result.report.ownContent).toBe(false);
    expect(result.report.stars).toBe(0);
    expect(result.report.newAchievements).toEqual([]);
    expect(result.progress.contents).toEqual({});
    expect(result.progress.achievements).toEqual({});
    expect(result.progress.totals.practiceMs).toBe(120_000);
    expect(result.progress.totals.runs).toBe(1);
    expect(result.progress.totals.trainingLaps).toBe(0);
    expect(levelFor(result.progress).stars).toBe(0);
    expect(weeklyProgress(result.progress, at(2026, 11, 16)).daysDone).toBe(1);
  });

  it('ignore invalid ids without changing anything', () => {
    const base = createProgress();
    expect(play(base, { songId: 1.5 }).progress).toBe(base);
    expect(play(base, { partId: -1 }).progress).toBe(base);
    expect(play(base, { songId: Number.NaN }).progress).toBe(base);
  });
});

describe('recordRun purity and input hygiene', () => {
  it('does not mutate the input and is deterministic', () => {
    const base = createProgress();
    const snapshot = JSON.stringify(base);
    const a = play(base, {});
    const b = play(base, {});
    expect(JSON.stringify(base)).toBe(snapshot);
    expect(a).toEqual(b);
  });

  it('clamps absurd time and lap values', () => {
    const result = play(createProgress(), { playedMs: Number.POSITIVE_INFINITY, laps: 1e12 });
    expect(result.progress.totals.practiceMs).toBe(0);
    expect(result.progress.totals.trainingLaps).toBe(1000);
    const negative = play(createProgress(), { playedMs: -5 });
    expect(negative.progress.totals.practiceMs).toBe(0);
    const long = play(createProgress(), { playedMs: 1e12 });
    expect(long.progress.totals.practiceMs).toBe(6 * 3_600_000);
  });
});

describe('picks', () => {
  it('unlocks the first pick once only', () => {
    const first = play(createProgress(), {});
    expect(first.report.newAchievements).toContain('primeira-palhetada');
    const unlockedAt = first.progress.achievements['primeira-palhetada'];
    const second = play(first.progress, {}, at(2026, 11, 17));
    expect(second.report.newAchievements).not.toContain('primeira-palhetada');
    expect(second.progress.achievements['primeira-palhetada']).toBe(unlockedAt);
  });

  it('unlocks the pentatonic, scale and chord picks by category and stars', () => {
    expect(play(createProgress(), { songId: PENTATONIC, score: score(75, 0, 25) }).report.newAchievements).toContain('pentatonica-no-braco');
    expect(play(createProgress(), { songId: PENTATONIC, score: score(50, 0, 50) }).report.newAchievements).not.toContain('pentatonica-no-braco');
    expect(play(createProgress(), { songId: SCALE, score: score(95, 0, 5) }).report.newAchievements).not.toContain('escala-tres-estrelas');
    expect(play(createProgress(), { songId: SCALE, score: score(100, 0, 0) }).report.newAchievements).toContain('escala-tres-estrelas');
    expect(play(createProgress(), { songId: PENTATONIC, score: score(100, 0, 0) }).report.newAchievements).not.toContain('escala-tres-estrelas');
    expect(play(createProgress(), { songId: CHORDS, score: score(80, 0, 20) }).report.newAchievements).toContain('primeiro-acorde');
  });

  it('unlocks 50 in a row and three stars', () => {
    const result = play(createProgress(), { score: score(100, 0, 0, 100) });
    expect(result.report.newAchievements).toEqual(expect.arrayContaining(['cinquenta-seguidas', 'tres-estrelas']));
    expect(play(createProgress(), { score: score(60, 0, 40, 49) }).report.newAchievements).not.toContain('cinquenta-seguidas');
  });

  it('unlocks ten training laps by the running total', () => {
    const progress = play(createProgress(), { laps: 6 }).progress;
    expect(progress.achievements['dez-voltas']).toBeUndefined();
    const result = play(progress, { laps: 4 });
    expect(result.report.newAchievements).toContain('dez-voltas');
    expect(play(result.progress, { laps: 4 }).report.newAchievements).not.toContain('dez-voltas');
  });

  it('unlocks five exercises with two stars, counting distinct exercises, not variants', () => {
    let progress = createProgress();
    // Five variants (patterns) of the same exercise count once
    for (let pattern = 0; pattern < 5; pattern += 1) {
      progress = play(progress, { songId: exerciseSongId(40, pattern), score: score(92, 0, 8) }).progress;
    }
    expect(progress.achievements['cinco-bem-tocados']).toBeUndefined();
    for (const code of [41, 42, 60, 100]) {
      progress = play(progress, { songId: exerciseSongId(code, 0), score: score(92, 0, 8) }).progress;
    }
    expect(progress.achievements['cinco-bem-tocados']).toBeDefined();
  });

  it('unlocks the latency pick from the outside event, once', () => {
    const first = recordEvent(createProgress(), { type: 'latencyTestSaved' }, at(2026, 11, 16));
    expect(first.unlocked).toEqual(['mao-no-tempo']);
    const again = recordEvent(first.progress, { type: 'latencyTestSaved' }, at(2026, 11, 17));
    expect(again.unlocked).toEqual([]);
    expect(again.progress.achievements['mao-no-tempo']).toBe(at(2026, 11, 16));
  });

  it('unlocks one hour of rehearsal across runs from any content', () => {
    let progress = createProgress();
    for (let i = 0; i < 29; i += 1) progress = play(progress, { songId: 999, playedMs: 120_000 }).progress;
    expect(progress.achievements['uma-hora-de-palheta']).toBeUndefined();
    const result = play(progress, { playedMs: 120_000 });
    expect(result.report.newAchievements).toContain('uma-hora-de-palheta');
  });

  it('unlocks three days in the same week but not across two weeks', () => {
    let progress = play(createProgress(), {}, at(2026, 11, 14)).progress; // Saturday of the week before
    progress = play(progress, {}, at(2026, 11, 16)).progress; // Monday
    progress = play(progress, {}, at(2026, 11, 17)).progress; // Tuesday
    expect(progress.achievements['tres-dias-na-semana']).toBeUndefined();
    const result = play(progress, {}, at(2026, 11, 18));
    expect(result.report.newAchievements).toContain('tres-dias-na-semana');
  });

  it('unlocks the weekly goal pick and reports the moment it is reached', () => {
    let progress = setWeeklyGoal(createProgress(), 3);
    const reached: boolean[] = [];
    for (const day of [16, 17, 18, 19]) {
      const result = play(progress, {}, at(2026, 11, day));
      progress = result.progress;
      reached.push(result.report.weeklyGoalJustReached);
    }
    expect(reached).toEqual([false, false, true, false]);
    expect(progress.achievements['meta-da-semana']).toBeDefined();
  });

  it('never unlocks a pick on a run with a seek', () => {
    const result = play(createProgress(), { jumped: true, score: score(100, 0, 0, 100) });
    expect(result.progress.achievements).toEqual({});
  });
});

describe('weeks', () => {
  it('start on Monday in local time', () => {
    expect(weekStartOf(at(2026, 11, 16, 0, 0))).toBe('2026-11-16'); // Monday 00:00
    expect(weekStartOf(at(2026, 11, 16, 23, 59))).toBe('2026-11-16');
    expect(weekStartOf(at(2026, 11, 18))).toBe('2026-11-16'); // Wednesday
  });

  it('keep Sunday night in the week that is ending', () => {
    expect(weekStartOf(at(2026, 11, 15, 23, 59))).toBe('2026-11-09');
    expect(weekStartOf(at(2026, 11, 22, 23, 59))).toBe('2026-11-16');
  });

  it('cross month and year boundaries', () => {
    expect(weekStartOf(at(2026, 3, 1))).toBe('2026-02-23'); // Sunday 1 March
    expect(weekStartOf(at(2026, 12, 31))).toBe('2026-12-28'); // Thursday
    expect(weekStartOf(at(2027, 1, 1))).toBe('2026-12-28'); // Friday: same week, new year
    expect(weekStartOf(at(2027, 1, 4))).toBe('2027-01-04');
    expect(weekStartOf(at(2028, 2, 29))).toBe('2028-02-28'); // leap day, Tuesday
  });

  it('start a new week from zero, with no trace of the old one', () => {
    let progress = setWeeklyGoal(createProgress(), 3);
    for (const day of [9, 10, 11]) progress = play(progress, {}, at(2026, 11, day)).progress;
    expect(weeklyProgress(progress, at(2026, 11, 13))).toMatchObject({ daysDone: 3, completed: true });
    expect(weeklyProgress(progress, at(2026, 11, 16))).toEqual({ weekStart: '2026-11-16', daysDone: 0, goal: 3, completed: false });
  });

  it('count a day only after a minute of rehearsal, adding up several runs in the day', () => {
    let progress = play(createProgress(), { playedMs: 30_000 }).progress;
    expect(weeklyProgress(progress, at(2026, 11, 16)).daysDone).toBe(0);
    progress = play(progress, { playedMs: 30_000 }, at(2026, 11, 16, 20)).progress;
    expect(weeklyProgress(progress, at(2026, 11, 16)).daysDone).toBe(1);
  });

  it('count one day once however many runs it has', () => {
    let progress = createProgress();
    for (let i = 0; i < 5; i += 1) progress = play(progress, {}, at(2026, 11, 16, 8 + i)).progress;
    expect(weeklyProgress(progress, at(2026, 11, 16)).daysDone).toBe(1);
  });

  it('have no goal and never complete when none is chosen', () => {
    const progress = play(createProgress(), {}).progress;
    expect(weeklyProgress(progress, at(2026, 11, 16))).toMatchObject({ goal: null, completed: false });
  });

  it('accept goals 3, 5 and 7 or none, and refuse others', () => {
    const base = createProgress();
    expect(setWeeklyGoal(base, 5).prefs.weeklyGoal).toBe(5);
    expect(setWeeklyGoal(setWeeklyGoal(base, 5), null).prefs.weeklyGoal).toBeNull();
    // @ts-expect-error 4 is not a valid goal
    expect(setWeeklyGoal(setWeeklyGoal(base, 7), 4).prefs.weeklyGoal).toBe(7);
  });

  it('keep only the most recent weeks', () => {
    let progress = createProgress();
    for (let week = 0; week < 60; week += 1) progress = play(progress, {}, at(2025, 1, 6 + week * 7)).progress;
    expect(Object.keys(progress.weeks)).toHaveLength(52);
  });
});

describe('levels', () => {
  const withStars = (stars: number): Progress => ({ ...createProgress(), totals: { ...createProgress().totals, archivedStars: stars } });

  it('start at the open string with the distance to the next', () => {
    expect(levelFor(createProgress())).toMatchObject({ name: 'Corda solta', index: 0, stars: 0, nextName: 'Primeira posição', starsToNext: 10 });
  });

  it('change at the exact thresholds', () => {
    expect(levelFor(withStars(9)).name).toBe('Corda solta');
    expect(levelFor(withStars(10))).toMatchObject({ name: 'Primeira posição', starsToNext: 20 });
    expect(levelFor(withStars(30)).name).toBe('Pestana');
    expect(levelFor(withStars(70)).name).toBe('Solo de garagem');
    expect(levelFor(withStars(130)).name).toBe('Palco pequeno');
    expect(levelFor(withStars(220))).toMatchObject({ name: 'Palco grande', nextName: null, starsToNext: null });
    expect(levelFor(withStars(5000)).name).toBe('Palco grande');
  });

  it('report a level change in the run report', () => {
    let progress = createProgress();
    let changed = false;
    for (let i = 0; i < 4; i += 1) {
      const result = play(progress, { songId: exerciseSongId(40 + i, 0) });
      progress = result.progress;
      changed ||= result.report.levelChanged;
    }
    expect(levelFor(progress).stars).toBe(12);
    expect(changed).toBe(true);
  });
});

describe('storage', () => {
  it('round-trips through save and load', () => {
    const storage = memoryStorage();
    let progress = setWeeklyGoal(setCalmMode(createProgress(), true), 5);
    progress = play(progress, { score: score(100, 0, 0, 80) }).progress;
    saveProgress(progress, storage);
    expect(loadProgress(storage)).toEqual(progress);
  });

  it('starts new for missing or unparseable data', () => {
    expect(loadProgress(memoryStorage())).toEqual(createProgress());
    for (const garbage of ['', '{', 'null', '[]', '42', '"x"', 'true', '{"version":1', '\u0000\u0001']) {
      expect(loadProgress(memoryStorage({ [PROGRESS_STORAGE_KEY]: garbage }))).toEqual(createProgress());
    }
  });

  it('starts new for an unknown version and never overwrites a newer one', () => {
    for (const version of [0, 2, 99, '1', null]) {
      const raw = JSON.stringify({ version, totals: { runs: 5, practiceMs: 1, trainingLaps: 0, archivedStars: 0 } });
      expect(loadProgress(memoryStorage({ [PROGRESS_STORAGE_KEY]: raw }))).toEqual(createProgress());
    }
    const newer = JSON.stringify({ version: 2, extra: true });
    const storage = memoryStorage({ [PROGRESS_STORAGE_KEY]: newer });
    saveProgress(play(createProgress(), {}).progress, storage);
    clearProgress(storage);
    expect(storage.getItem(PROGRESS_STORAGE_KEY)).toBe(newer);
  });

  it('keeps the valid fields and resets only the wrong ones', () => {
    const good = play(createProgress(), {}).progress;
    const raw = {
      version: 1,
      ...good,
      totals: { runs: 'many', practiceMs: 5000, trainingLaps: -1, archivedStars: 2.5 },
      prefs: { calmMode: 'yes', weeklyGoal: 5 }
    };
    const loaded = parseProgress(JSON.parse(JSON.stringify(raw)));
    expect(loaded.totals).toEqual({ runs: 0, practiceMs: 5000, trainingLaps: 0, archivedStars: 0 });
    expect(loaded.prefs).toEqual({ calmMode: false, weeklyGoal: 5 });
    expect(loaded.contents).toEqual(good.contents);
    expect(loaded.achievements).toEqual(good.achievements);
    expect(loaded.weeks).toEqual(good.weeks);
  });

  it('drops invalid entries one by one', () => {
    const key = `${PENTATONIC}:0`;
    const json = `{
      "version": 1,
      "contents": {
        "${key}": { "bestAccuracy": 90, "bestCombo": 10, "stars": 2, "plays": 3, "lastPlayedAt": 1000 },
        "123:0": { "bestAccuracy": 90, "bestCombo": 10, "stars": 2, "plays": 3, "lastPlayedAt": 1000 },
        "__proto__": { "bestAccuracy": 90, "bestCombo": 10, "stars": 2, "plays": 3, "lastPlayedAt": 1000 },
        "-1:0": { "bestAccuracy": 150, "bestCombo": 10, "stars": 2, "plays": 3, "lastPlayedAt": 1000 },
        "-2:0": { "bestAccuracy": 90, "bestCombo": 10, "stars": 4, "plays": 3, "lastPlayedAt": 1000 },
        "-3:0": "text",
        "-4:0": null,
        "x:y": {}
      },
      "achievements": { "primeira-palhetada": 5, "Bad Id!": 5, "__proto__": 5, "ok-id": "today", "other-id": -1 },
      "weeks": {
        "2026-11-16": { "2026-11-16": 90000, "2026-11-17": "lots", "2026-11-25": 60000, "junk": 1 },
        "2026-11-17": { "2026-11-17": 60000 },
        "2026-02-30": { "2026-02-30": 60000 },
        "1999-01-04": { "1999-01-04": 60000 }
      }
    }`;
    const loaded = parseProgress(JSON.parse(json));
    expect(Object.keys(loaded.contents)).toEqual([key]); // catalog id, bad ranges, wrong types: dropped
    expect(loaded.achievements).toEqual({ 'primeira-palhetada': 5 });
    // Only the Monday week with its own valid day survives: not a Monday, not a date, out of range
    expect(loaded.weeks).toEqual({ '2026-11-16': { '2026-11-16': 90_000 } });
    expect(Object.getPrototypeOf(loaded.contents)).toBe(Object.prototype);
  });

  it('survives a throwing or blocked storage', () => {
    const throwing: Storage = {
      ...memoryStorage(),
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('full');
      },
      removeItem: () => {
        throw new Error('blocked');
      }
    };
    expect(loadProgress(throwing)).toEqual(createProgress());
    expect(() => saveProgress(createProgress(), throwing)).not.toThrow();
    expect(() => clearProgress(throwing)).not.toThrow();
    expect(() => exportProgress(throwing)).not.toThrow();
  });

  it('caps the stored contents and keeps their stars in the level', () => {
    const contents: Record<string, unknown> = {};
    for (let i = 0; i < 2100; i += 1) {
      contents[`${-1000 - i}:0`] = { bestAccuracy: 80, bestCombo: 1, stars: 1, plays: 1, lastPlayedAt: i };
    }
    const loaded = parseProgress(JSON.parse(JSON.stringify({ version: 1, contents })));
    expect(Object.keys(loaded.contents)).toHaveLength(2000);
    expect(loaded.contents[`${-1000 - 2099}:0`]).toBeDefined(); // newest kept
    expect(loaded.contents['-1000:0']).toBeUndefined(); // oldest dropped
    expect(levelFor(loaded).stars).toBe(2100);
  });

  it('clears everything it saved', () => {
    const storage = memoryStorage();
    saveProgress(play(createProgress(), {}).progress, storage);
    expect(storage.getItem(PROGRESS_STORAGE_KEY)).not.toBeNull();
    clearProgress(storage);
    expect(storage.getItem(PROGRESS_STORAGE_KEY)).toBeNull();
    expect(loadProgress(storage)).toEqual(createProgress());
  });

  it('exports a serializable object with readable dates and pick names', () => {
    const storage = memoryStorage();
    saveProgress(play(createProgress(), {}).progress, storage);
    const exported = exportProgress(storage);
    expect(JSON.parse(JSON.stringify(exported))).toEqual(exported);
    expect(JSON.stringify(exported)).toContain('Primeira palhetada');
    expect(JSON.stringify(exported)).toMatch(/"unlockedAt":"\d{4}-\d{2}-\d{2}T/);
  });
});

describe('calm mode', () => {
  it('is a stored preference that does not change what is earned', () => {
    const calm = setCalmMode(createProgress(), true);
    expect(calm.prefs.calmMode).toBe(true);
    expect(play(calm, {}).report.newAchievements).toContain('primeira-palhetada');
  });
});

describe('review fixes', () => {
  it('normal runs do not count as training laps', () => {
    let progress = createProgress();
    for (let i = 0; i < 10; i++) progress = play(progress, { laps: 1 }, at(2026, 11, 16 + (i % 3))).progress;
    expect(progress.totals.trainingLaps).toBe(0);
    expect(progress.achievements['dez-voltas']).toBeUndefined();
  });

  it('training runs with several laps still count', () => {
    const progress = play(createProgress(), { laps: 4 }).progress;
    expect(progress.totals.trainingLaps).toBe(4);
  });

  it('drops stored contents whose ids are not own content', () => {
    const good = `${PENTATONIC}:0`;
    const entry = { bestAccuracy: 90, bestCombo: 10, stars: 3, plays: 1, lastPlayedAt: 1 };
    const raw = { version: 1, ...JSON.parse(JSON.stringify(createProgress())), contents: { [good]: entry, '0:0': entry, '-42:0': entry } };
    const loaded = parseProgress(raw);
    expect(Object.keys(loaded.contents)).toEqual([good]);
  });
});
