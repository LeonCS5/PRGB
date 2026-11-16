// Progress kept only in this browser: stars, picks (achievements), rehearsal time and the weekly goal.
// Nothing here leaves the device. Storage can be blocked, full or tampered with, so every read is validated
// field by field and nothing throws. All logic is pure: time always comes in as `now` (epoch ms).
//
// Own content (songId <= 0: the demo, exercises, public-domain repertoire) earns stars and picks. Songs from
// the external catalog (positive ids) only add rehearsal time to the totals and the week; their personal
// record stays in records.ts.

import { ACHIEVEMENTS, evaluateAchievements, type AchievementEvent, type AchievementRun } from './achievements';
import { parseExerciseSongId, isExerciseSongId } from './exerciseIds';
import { accuracyPercent, type ScoreState } from './scoring';

export const PROGRESS_STORAGE_KEY = 'prgb:progress:v1';
const DATA_VERSION = 1;

export type WeeklyGoal = 3 | 5 | 7;
export const WEEKLY_GOALS: readonly WeeklyGoal[] = [3, 5, 7];

// Stars: 1 star from 70% accuracy, 2 from 90%, 3 from 97% with at most one broken combo (one miss).
// Accuracy is the rounded percent shown to the player, so what they read is what counts.
// Runs under MIN_STAR_NOTES notes are too short to say anything and earn no stars.
export const STAR_ACCURACY = { one: 70, two: 90, three: 97 } as const;
export const THREE_STAR_MAX_MISSES = 1;
export const MIN_STAR_NOTES = 8;
export const MAX_STARS = 3;

// A day counts as a rehearsal day once the player has played this long in it (any content, any speed)
export const MIN_DAY_MS = 60_000;

const MAX_RUN_MS = 6 * 3_600_000; // one run is never longer than this: protects the totals from bad input
const MAX_DAY_MS = 24 * 3_600_000;
const MAX_TOTAL_MS = 1_000_000 * 3_600_000;
const MAX_LAPS = 1000;
const MAX_COUNT = 1_000_000_000;
const CONTENTS_LIMIT = 2000;
const WEEKS_LIMIT = 52;
const ACHIEVEMENTS_LIMIT = 200;
const MIN_YEAR = 2000;
const MAX_YEAR = 2200;

export interface ContentProgress {
  bestAccuracy: number; // 0-100, rated runs only
  bestCombo: number;
  stars: number; // 0-3, never goes down
  plays: number;
  lastPlayedAt: number; // epoch ms
}

export interface ProgressTotals {
  runs: number; // every finished run, from any content
  practiceMs: number; // rehearsal time, from any content
  trainingLaps: number; // laps of training mode on own content, rated or not
  archivedStars: number; // stars of contents dropped by the size limit, so the level never goes down
}

export interface ProgressPrefs {
  calmMode: boolean;
  weeklyGoal: WeeklyGoal | null; // null: no goal
}

export interface Progress {
  totals: ProgressTotals;
  contents: Record<string, ContentProgress>; // key: `${songId}:${partId}`
  achievements: Record<string, number>; // stable id -> epoch ms of the unlock
  weeks: Record<string, Record<string, number>>; // Monday (local, YYYY-MM-DD) -> day (YYYY-MM-DD) -> ms played
  prefs: ProgressPrefs;
}

export interface FinishedRun {
  songId: number;
  partId: number;
  score: ScoreState;
  speed: number;
  jumped: boolean; // seeked during the run
  speedChanged: boolean;
  laps: number; // training mode laps; 1 for a normal run
  playedMs: number; // time actually played (not paused)
}

export interface WeeklyProgress {
  weekStart: string;
  daysDone: number;
  goal: WeeklyGoal | null;
  completed: boolean; // false when there is no goal
}

export interface LevelInfo {
  index: number;
  name: string;
  stars: number;
  nextName: string | null;
  starsToNext: number | null; // null at the last level
}

export interface RunReport {
  ownContent: boolean; // false: external catalog, only time counted
  rated: boolean; // stars and records were possible (no seek, no speed change, one lap)
  stars: number; // stars of this run (0-3)
  previousStars: number;
  starsGained: number; // new stars on this content (0 if not above the previous best)
  newAchievements: string[]; // ids unlocked by this run
  weekly: WeeklyProgress;
  weeklyGoalJustReached: boolean;
  level: LevelInfo;
  levelChanged: boolean;
}

const LEVELS: readonly { name: string; minStars: number }[] = [
  { name: 'Corda solta', minStars: 0 },
  { name: 'Primeira posição', minStars: 10 },
  { name: 'Pestana', minStars: 30 },
  { name: 'Solo de garagem', minStars: 70 },
  { name: 'Palco pequeno', minStars: 130 },
  { name: 'Palco grande', minStars: 220 }
];

// ---------- helpers ----------

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isIntIn = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;

const isOwnSongId = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value <= 0;

const clampNumber = (value: number, min: number, max: number): number =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min;

export const createProgress = (): Progress => ({
  totals: { runs: 0, practiceMs: 0, trainingLaps: 0, archivedStars: 0 },
  contents: {},
  achievements: {},
  weeks: {},
  prefs: { calmMode: false, weeklyGoal: null }
});

export const contentKey = (songId: number, partId: number): string => `${songId}:${partId}`;

const CONTENT_KEY = /^(-?\d{1,9}):(\d{1,9})$/;
const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (value: number): string => String(value).padStart(2, '0');
const dayKeyOfDate = (date: Date): string => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

// Local calendar day of an instant: 'YYYY-MM-DD'
export const dayKeyOf = (now: number): string => dayKeyOfDate(new Date(now));

// Monday of the week of an instant, in the local time zone. Built from date parts, so DST never shifts it.
export const weekStartOf = (now: number): string => {
  const date = new Date(now);
  const sinceMonday = (date.getDay() + 6) % 7;
  return dayKeyOfDate(new Date(date.getFullYear(), date.getMonth(), date.getDate() - sinceMonday));
};

const parseDayKey = (key: string): Date | null => {
  const match = DAY_KEY.exec(key);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (year < MIN_YEAR || year > MAX_YEAR) return null;
  const date = new Date(year, month - 1, day);
  return dayKeyOfDate(date) === key ? date : null;
};

// ---------- stars ----------

export function starsFor(score: ScoreState): number {
  const notes = score.perfect + score.good + score.miss;
  if (notes < MIN_STAR_NOTES) return 0;
  const accuracy = accuracyPercent(score);
  if (accuracy >= STAR_ACCURACY.three && score.miss <= THREE_STAR_MAX_MISSES) return 3;
  if (accuracy >= STAR_ACCURACY.two) return 2;
  if (accuracy >= STAR_ACCURACY.one) return 1;
  return 0;
}

export function totalStars(progress: Progress): number {
  let total = progress.totals.archivedStars;
  for (const content of Object.values(progress.contents)) total += content.stars;
  return total;
}

export function levelFor(progress: Progress): LevelInfo {
  const stars = totalStars(progress);
  let index = 0;
  LEVELS.forEach((level, i) => {
    if (stars >= level.minStars) index = i;
  });
  const next = LEVELS[index + 1];
  return {
    index,
    name: LEVELS[index].name,
    stars,
    nextName: next?.name ?? null,
    starsToNext: next ? next.minStars - stars : null
  };
}

// ---------- weekly rehearsal ----------

export function weeklyProgress(progress: Progress, now: number): WeeklyProgress {
  const weekStart = weekStartOf(now);
  const days = progress.weeks[weekStart] ?? {};
  const daysDone = Object.values(days).filter((ms) => ms >= MIN_DAY_MS).length;
  const goal = progress.prefs.weeklyGoal;
  return { weekStart, daysDone, goal, completed: goal !== null && daysDone >= goal };
}

export const setWeeklyGoal = (progress: Progress, goal: WeeklyGoal | null): Progress =>
  ({ ...progress, prefs: { ...progress.prefs, weeklyGoal: goal === null || WEEKLY_GOALS.includes(goal) ? goal : progress.prefs.weeklyGoal } });

export const setCalmMode = (progress: Progress, calmMode: boolean): Progress =>
  ({ ...progress, prefs: { ...progress.prefs, calmMode } });

const addPracticeTime = (weeks: Progress['weeks'], now: number, ms: number): Progress['weeks'] => {
  const weekStart = weekStartOf(now);
  const day = dayKeyOf(now);
  const week = weeks[weekStart] ?? {};
  const next = { ...weeks, [weekStart]: { ...week, [day]: Math.min(MAX_DAY_MS, (week[day] ?? 0) + ms) } };
  // Keep the most recent weeks only (keys sort as dates)
  const keys = Object.keys(next).sort();
  for (const key of keys.slice(0, Math.max(0, keys.length - WEEKS_LIMIT))) delete next[key];
  return next;
};

// ---------- recording ----------

const trimContents = (contents: Record<string, ContentProgress>, archivedStars: number) => {
  const keys = Object.keys(contents);
  if (keys.length <= CONTENTS_LIMIT) return { contents, archivedStars };
  const kept = { ...contents };
  let archived = archivedStars;
  const oldest = keys.sort((a, b) => contents[a].lastPlayedAt - contents[b].lastPlayedAt || (a < b ? -1 : 1));
  for (const key of oldest.slice(0, keys.length - CONTENTS_LIMIT)) {
    archived += kept[key].stars;
    delete kept[key];
  }
  return { contents: kept, archivedStars: Math.min(MAX_COUNT, archived) };
};

/**
 * Apply a finished run. Pure: returns the new state and what changed.
 * Rehearsal time always counts. Stars and picks only come from own content (songId <= 0), and only when the
 * run was not seeked and its speed did not change (the same rule as personal records); stars also need a
 * single lap, since training laps add up. A run with invalid ids changes nothing.
 */
export function recordRun(progress: Progress, run: FinishedRun, now: number): { progress: Progress; report: RunReport } {
  const levelBefore = levelFor(progress);
  const weeklyBefore = weeklyProgress(progress, now);
  if (!isIntIn(run.songId, -MAX_COUNT, MAX_COUNT) || !isIntIn(run.partId, 0, MAX_COUNT) || !Number.isFinite(now)) {
    return { progress, report: emptyReport(progress, now, false) };
  }
  const ownContent = isOwnSongId(run.songId);
  const playedMs = Math.round(clampNumber(run.playedMs, 0, MAX_RUN_MS));
  const laps = Math.round(clampNumber(run.laps, 1, MAX_LAPS));
  const valid = !run.jumped && !run.speedChanged;
  const rated = ownContent && valid && laps === 1;

  const key = contentKey(run.songId, run.partId);
  const previous = progress.contents[key];
  const previousStars = previous?.stars ?? 0;
  let contents = progress.contents;
  let archivedStars = progress.totals.archivedStars;
  const stars = rated ? starsFor(run.score) : 0;

  if (ownContent) {
    const base: ContentProgress = previous ?? { bestAccuracy: 0, bestCombo: 0, stars: 0, plays: 0, lastPlayedAt: 0 };
    const updated: ContentProgress = {
      bestAccuracy: rated ? Math.max(base.bestAccuracy, accuracyPercent(run.score)) : base.bestAccuracy,
      bestCombo: rated ? Math.max(base.bestCombo, Math.min(MAX_COUNT, run.score.maxCombo)) : base.bestCombo,
      stars: Math.max(base.stars, stars),
      plays: Math.min(MAX_COUNT, base.plays + 1),
      lastPlayedAt: now
    };
    ({ contents, archivedStars } = trimContents({ ...progress.contents, [key]: updated }, archivedStars));
  }

  const totals: ProgressTotals = {
    runs: Math.min(MAX_COUNT, progress.totals.runs + 1),
    practiceMs: Math.min(MAX_TOTAL_MS, progress.totals.practiceMs + playedMs),
    trainingLaps: ownContent && valid ? Math.min(MAX_COUNT, progress.totals.trainingLaps + laps) : progress.totals.trainingLaps,
    archivedStars
  };
  const next: Progress = { ...progress, totals, contents, weeks: addPracticeTime(progress.weeks, now, playedMs) };

  const unlocked = ownContent && valid
    ? evaluate(next, { songId: run.songId, partId: run.partId, stars, score: run.score, laps }, null, now)
    : [];
  const finalProgress = unlocked.length > 0 ? unlockAchievements(next, unlocked, now) : next;

  const weekly = weeklyProgress(finalProgress, now);
  const level = levelFor(finalProgress);
  return {
    progress: finalProgress,
    report: {
      ownContent,
      rated,
      stars,
      previousStars,
      starsGained: Math.max(0, stars - previousStars),
      newAchievements: unlocked,
      weekly,
      weeklyGoalJustReached: weekly.completed && !weeklyBefore.completed,
      level,
      levelChanged: level.index !== levelBefore.index
    }
  };
}

const emptyReport = (progress: Progress, now: number, ownContent: boolean): RunReport => ({
  ownContent,
  rated: false,
  stars: 0,
  previousStars: 0,
  starsGained: 0,
  newAchievements: [],
  weekly: weeklyProgress(progress, now),
  weeklyGoalJustReached: false,
  level: levelFor(progress),
  levelChanged: false
});

const evaluate = (progress: Progress, run: AchievementRun | null, event: AchievementEvent | null, now: number): string[] =>
  evaluateAchievements({
    progress,
    run,
    event,
    weekly: weeklyProgress(progress, now),
    twoStarContents: countContentsWithStars(progress, 2)
  });

const unlockAchievements = (progress: Progress, ids: string[], now: number): Progress => {
  const achievements = { ...progress.achievements };
  for (const id of ids) if (!(id in achievements)) achievements[id] = now;
  return { ...progress, achievements };
};

/** An event that comes from outside the game (e.g. the latency test was saved). Unlocks each pick once. */
export function recordEvent(progress: Progress, event: AchievementEvent, now: number): { progress: Progress; unlocked: string[] } {
  if (!Number.isFinite(now)) return { progress, unlocked: [] };
  const unlocked = evaluate(progress, null, event, now);
  return unlocked.length > 0 ? { progress: unlockAchievements(progress, unlocked, now), unlocked } : { progress, unlocked };
}

// Distinct exercises (not variants: key and pattern) or songs that reached at least `stars`
export function countContentsWithStars(progress: Progress, stars: number): number {
  const seen = new Set<string>();
  for (const [key, content] of Object.entries(progress.contents)) {
    if (content.stars < stars) continue;
    const match = CONTENT_KEY.exec(key);
    if (!match) continue;
    const songId = Number(match[1]);
    seen.add(isExerciseSongId(songId) ? `exercise:${parseExerciseSongId(songId).code}` : key);
  }
  return seen.size;
}

// ---------- storage ----------

const parseContent = (value: unknown): ContentProgress | null => {
  if (!isRecord(value)) return null;
  const { bestAccuracy, bestCombo, stars, plays, lastPlayedAt } = value;
  if (typeof bestAccuracy !== 'number' || !Number.isFinite(bestAccuracy) || bestAccuracy < 0 || bestAccuracy > 100
    || !isIntIn(bestCombo, 0, MAX_COUNT) || !isIntIn(stars, 0, MAX_STARS) || !isIntIn(plays, 0, MAX_COUNT)
    || !isIntIn(lastPlayedAt, 0, 8.64e15)) return null;
  return { bestAccuracy, bestCombo, stars, plays, lastPlayedAt };
};

const parseWeeks = (value: unknown): Progress['weeks'] => {
  const weeks: Progress['weeks'] = {};
  if (!isRecord(value)) return weeks;
  for (const [weekKey, days] of Object.entries(value)) {
    const monday = parseDayKey(weekKey);
    if (!monday || monday.getDay() !== 1 || !isRecord(days)) continue;
    const week: Record<string, number> = {};
    for (const [dayKey, ms] of Object.entries(days)) {
      const day = parseDayKey(dayKey);
      if (!day || !isIntIn(ms, 0, MAX_DAY_MS)) continue;
      if (weekStartOf(day.getTime()) === weekKey) week[dayKey] = ms;
    }
    if (Object.keys(week).length > 0) weeks[weekKey] = week;
  }
  const keys = Object.keys(weeks).sort();
  for (const key of keys.slice(0, Math.max(0, keys.length - WEEKS_LIMIT))) delete weeks[key];
  return weeks;
};

const ACHIEVEMENT_ID = /^[a-z0-9-]{1,48}$/;

// Builds a fresh object with only the known fields; what is invalid falls back to the new-state default
export function parseProgress(value: unknown): Progress {
  const progress = createProgress();
  if (!isRecord(value) || value.version !== DATA_VERSION) return progress;

  if (isRecord(value.totals)) {
    const { runs, practiceMs, trainingLaps, archivedStars } = value.totals;
    progress.totals = {
      runs: isIntIn(runs, 0, MAX_COUNT) ? runs : 0,
      practiceMs: isIntIn(practiceMs, 0, MAX_TOTAL_MS) ? practiceMs : 0,
      trainingLaps: isIntIn(trainingLaps, 0, MAX_COUNT) ? trainingLaps : 0,
      archivedStars: isIntIn(archivedStars, 0, MAX_COUNT) ? archivedStars : 0
    };
  }

  if (isRecord(value.contents)) {
    const contents: Record<string, ContentProgress> = {};
    for (const [key, raw] of Object.entries(value.contents)) {
      const match = CONTENT_KEY.exec(key);
      if (!match || !isOwnSongId(Number(match[1])) || contentKey(Number(match[1]), Number(match[2])) !== key) continue;
      const content = parseContent(raw);
      if (content) contents[key] = content;
    }
    const trimmed = trimContents(contents, progress.totals.archivedStars);
    progress.contents = trimmed.contents;
    progress.totals.archivedStars = trimmed.archivedStars;
  }

  if (isRecord(value.achievements)) {
    for (const [id, at] of Object.entries(value.achievements).slice(0, ACHIEVEMENTS_LIMIT)) {
      if (ACHIEVEMENT_ID.test(id) && isIntIn(at, 0, 8.64e15)) progress.achievements[id] = at;
    }
  }

  progress.weeks = parseWeeks(value.weeks);

  if (isRecord(value.prefs)) {
    const { calmMode, weeklyGoal } = value.prefs;
    progress.prefs = {
      calmMode: calmMode === true,
      weeklyGoal: WEEKLY_GOALS.find((goal) => goal === weeklyGoal) ?? null
    };
  }
  return progress;
}

const resolveStorage = (storage?: Storage): Storage | null => {
  if (storage) return storage;
  try {
    // Reading window.localStorage itself throws in some browsers when site data is blocked
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

// Saved by a newer PRGB (e.g. another tab already updated): read as new and never overwritten
const isFromNewerVersion = (storage: Storage | null): boolean => {
  if (!storage) return false;
  try {
    const raw = storage.getItem(PROGRESS_STORAGE_KEY);
    const value: unknown = raw ? JSON.parse(raw) : null;
    return isRecord(value) && typeof value.version === 'number' && value.version > DATA_VERSION;
  } catch {
    return false;
  }
};

export function loadProgress(storage?: Storage): Progress {
  const target = resolveStorage(storage);
  if (!target) return createProgress();
  try {
    const raw = target.getItem(PROGRESS_STORAGE_KEY);
    return raw ? parseProgress(JSON.parse(raw)) : createProgress();
  } catch {
    return createProgress();
  }
}

export function saveProgress(progress: Progress, storage?: Storage): void {
  const target = resolveStorage(storage);
  if (!target || isFromNewerVersion(target)) return;
  try {
    target.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ version: DATA_VERSION, ...progress }));
  } catch {
    // Progress is optional when storage is blocked or full.
  }
}

// Leaves progress saved by a newer PRGB untouched, like the records
export function clearProgress(storage?: Storage): void {
  const target = resolveStorage(storage);
  if (!target || isFromNewerVersion(target)) return;
  try {
    target.removeItem(PROGRESS_STORAGE_KEY);
  } catch {
    // Nothing to clear when storage is blocked.
  }
}

// Serializable copy of everything kept here, for the local data export (data portability)
export function exportProgress(storage?: Storage): Record<string, unknown> {
  const progress = loadProgress(storage);
  return {
    description: 'Progresso (estrelas, palhetas, ensaio da semana) guardado neste navegador.',
    version: DATA_VERSION,
    totals: progress.totals,
    level: levelFor(progress).name,
    contents: Object.entries(progress.contents).map(([key, content]) => {
      const [songId, partId] = key.split(':').map(Number);
      return { songId, partId, ...content, lastPlayedAt: new Date(content.lastPlayedAt).toISOString() };
    }),
    achievements: Object.entries(progress.achievements).map(([id, at]) => ({
      id,
      name: ACHIEVEMENTS.find((item) => item.id === id)?.name ?? id,
      unlockedAt: new Date(at).toISOString()
    })),
    weeks: progress.weeks,
    prefs: progress.prefs
  };
}
