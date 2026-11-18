// A practice session: exercises played one after the other, without going back to a menu. This file is the pure part:
// what a session is made of, how one is built (from a trail stage, by time, or by hand) and the two ways to make it
// longer without a new exercise: walking through several keys, and playing each exercise in all its patterns.

import type { GamePart } from '../context/gameSession';
import {
  buildExerciseTab, categoryOf, exerciseByCode, exercisePart, exerciseVariant,
  type ExerciseCategoryId, type ExercisePattern
} from './exercises';
import { contentKey, type Progress } from './progress';
import { RESOLVED_TRAIL, summarizeTrail, TRAIL_STEP_COUNT, type ResolvedStep } from './trail';

export interface SessionItem {
  code: number;
  key: number; // the tonic (0 = C); ignored by exercises with a fixed place on the neck
  pattern?: ExercisePattern;
}

export type KeyCycle = 1 | 3 | 6 | 12;
export const KEY_CYCLES: readonly KeyCycle[] = [1, 3, 6, 12];

export interface ExpandOptions {
  keys: number; // how many keys each exercise visits, a fourth apart (C, F, Bb, Eb…): 1 to 12
  allPatterns: boolean; // each pattern the exercise offers, one after the other
}

export const DEFAULT_EXPAND: ExpandOptions = { keys: 1, allPatterns: false };

export const MAX_SESSION_ITEMS = 120;

// Before each exercise the game counts in, and after each one the player sees the result before the next begins
export const FIRST_LEAD_IN_MS = 5000;
export const NEXT_LEAD_IN_MS = 3000;
export const TRANSITION_MS = 10000;

const FOURTH = 5;

export const isValidItem = (item: SessionItem): boolean => {
  const exercise = exerciseByCode(item.code);
  if (!exercise || !Number.isInteger(item.key) || item.key < 0 || item.key > 11) return false;
  return item.pattern === undefined || categoryOf(exercise).patterns.includes(item.pattern);
};

/** One exercise as several: the keys a fourth apart, and (if asked) each of its patterns, key by key. */
export function expandItem(item: SessionItem, { keys, allPatterns }: ExpandOptions): SessionItem[] {
  const exercise = exerciseByCode(item.code);
  if (!exercise) return [];
  const category = categoryOf(exercise);
  const count = Math.min(12, Math.max(1, Math.floor(keys)));
  const keyList = exercise.keyed ? Array.from({ length: count }, (_, index) => (item.key + FOURTH * index) % 12) : [item.key];
  const patterns: (ExercisePattern | undefined)[] = allPatterns && category.patterns.length > 1 ? [...category.patterns] : [item.pattern];
  return keyList.flatMap((key) => patterns.map((pattern) => ({ code: item.code, key, pattern })));
}

const expandAll = (items: SessionItem[], options: ExpandOptions): SessionItem[] =>
  items.flatMap((item) => expandItem(item, options)).slice(0, MAX_SESSION_ITEMS);

const durations = new Map<string, number>();

/** The length of the exercise itself, from its tab. */
export function itemDurationMs(item: SessionItem): number {
  const id = `${item.code}:${item.key}:${item.pattern ?? ''}`;
  let known = durations.get(id);
  if (known === undefined) {
    const exercise = exerciseByCode(item.code);
    known = exercise ? buildExerciseTab(exercise, item.key, item.pattern).totalDurationMs : 0;
    durations.set(id, known);
  }
  return known;
}

/** About how long the whole session takes, count-ins and the pauses between exercises included. */
export function sessionDurationMs(items: readonly SessionItem[]): number {
  if (items.length === 0) return 0;
  const playing = items.reduce((total, item) => total + itemDurationMs(item), 0);
  return playing + FIRST_LEAD_IN_MS + (items.length - 1) * (NEXT_LEAD_IN_MS + TRANSITION_MS);
}

export const formatMinutes = (ms: number): string => {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  return `${minutes} min`;
};

export const itemTitle = (item: SessionItem): string => {
  const exercise = exerciseByCode(item.code);
  return exercise ? exerciseVariant(exercise, item.key, item.pattern).title : 'Exercício';
};

/** The game part of an item, built when it is its turn. */
export function itemPart(item: SessionItem): GamePart | null {
  const exercise = exerciseByCode(item.code);
  return exercise ? exercisePart(exercise, item.key, item.pattern) : null;
}

// ---------- three ways to build a session ----------

const toItem = ({ exercise, key, pattern }: ResolvedStep): SessionItem => ({ code: exercise.code, key, pattern });

/** 1. A whole stage of the trail, in its order. */
export function stageSession(stageId: string, options: ExpandOptions = DEFAULT_EXPAND): SessionItem[] {
  const stage = RESOLVED_TRAIL.find((entry) => entry.stage.id === stageId);
  return stage ? expandAll(stage.steps.map(toItem), options) : [];
}

export const SESSION_MINUTES = [10, 15, 20] as const;
export type SessionMinutes = (typeof SESSION_MINUTES)[number];

interface Slot {
  id: string;
  categories: ExerciseCategoryId[];
  share: number; // of the time
  easyFirst?: boolean; // a warm-up starts with the easiest
}

// The order of a good session: loosen up, one technique, notes and scales, chords, rhythm
const SLOTS: readonly Slot[] = [
  { id: 'aquecimento', categories: ['aquecimento'], share: 0.15, easyFirst: true },
  { id: 'tecnica', categories: ['tecnicas'], share: 0.15 },
  { id: 'notas', categories: ['pentatonicas', 'escalas', 'arpejos', 'braco'], share: 0.3 },
  { id: 'harmonia', categories: ['acordes', 'progressoes'], share: 0.25 },
  { id: 'ritmo', categories: ['ritmo'], share: 0.15 }
];

// How far past the next step a session may reach. A little ahead keeps a session from being all review; it widens
// only when what is near is not enough to fill the time (a new player has few steps in reach)
const REACH = [12, 24, 40, 80, 400];

/**
 * 2. A session of about `minutes`, built around where the player is on the trail: steps without stars first and
 * nearest to the next one, then the ones already played, so a session also reviews. Same input and day, same session.
 */
export function timedSession(minutes: SessionMinutes, progress: Progress, options: ExpandOptions = DEFAULT_EXPAND, now = 0): SessionItem[] {
  const reference = summarizeTrail(progress).next?.index ?? TRAIL_STEP_COUNT;
  const stars = (step: ResolvedStep): number => progress.contents[contentKey(step.songId, step.partId)]?.stars ?? 0;
  const everyStep = RESOLVED_TRAIL.flatMap(({ steps }) => steps);
  // A rotation by the day, so the same player does not get the very same review every time
  const turn = Math.floor(now / 86_400_000);
  const rank = (step: ResolvedStep, easyFirst: boolean): number[] => easyFirst
    ? [step.level, stars(step), step.index]
    : [stars(step) === 0 ? 0 : 1, stars(step) === 0 ? Math.abs(step.index - reference) : (step.index + turn) % 17, step.index];
  const compare = (a: number[], b: number[]): number => a.reduce((result, value, position) => result || value - b[position], 0);
  const budget = minutes * 60_000;

  const build = (reach: number): { items: SessionItem[]; ms: number } => {
    const pool = everyStep.filter((step) => step.index <= reference + reach);
    const chosen: SessionItem[] = [];
    const taken = new Set<number>();
    let ms = 0;
    const add = (step: ResolvedStep): number => {
      const items = expandItem(toItem(step), options);
      const cost = sessionDurationMs(items) - FIRST_LEAD_IN_MS + NEXT_LEAD_IN_MS + TRANSITION_MS;
      chosen.push(...items);
      taken.add(step.index);
      ms += cost;
      return cost;
    };
    const candidatesOf = (slot: Slot): ResolvedStep[] =>
      pool.filter((step) => slot.categories.includes(categoryOf(step.exercise).id) && !taken.has(step.index))
        .sort((a, b) => compare(rank(a, slot.easyFirst === true), rank(b, slot.easyFirst === true)));
    for (const slot of SLOTS) {
      let left = budget * slot.share;
      // A slot always gets its first exercise, so a short session still has every part
      let first = true;
      for (const step of candidatesOf(slot)) {
        if ((!first && left <= 0) || chosen.length >= MAX_SESSION_ITEMS) break;
        left -= add(step);
        first = false;
      }
    }
    // Time left over: more of the same kind of work, from wherever there is something
    for (const step of pool.filter((candidate) => !taken.has(candidate.index)).sort((a, b) => compare(rank(a, false), rank(b, false)))) {
      if (ms >= budget * 0.85 || chosen.length >= MAX_SESSION_ITEMS) break;
      add(step);
    }
    return { items: chosen.slice(0, MAX_SESSION_ITEMS), ms };
  };

  let result = build(REACH[0]);
  for (const reach of REACH.slice(1)) {
    if (result.ms >= budget * 0.85) break;
    result = build(reach);
  }
  return result.items;
}

/** 3. A list made by hand. Anything that is not a real exercise is dropped. */
export function customSession(entries: readonly SessionItem[], options: ExpandOptions = DEFAULT_EXPAND): SessionItem[] {
  return expandAll(entries.filter(isValidItem), options);
}

// ---------- a session being played ----------

export interface SessionResult {
  title: string;
  stars: number; // of this run, 0 to 3; 0 too when the run could not be rated
  accuracy: number;
  score: number;
}

export interface PracticeQueue {
  id: number; // a new session is a new id
  items: SessionItem[];
  index: number;
  results: SessionResult[];
  startedAt: number;
}

let lastQueueId = 0;

export const startQueue = (items: SessionItem[], now: number): PracticeQueue => ({ id: ++lastQueueId, items, index: 0, results: [], startedAt: now });

export const isLastItem = (queue: PracticeQueue): boolean => queue.index >= queue.items.length - 1;

export const nextItem = (queue: PracticeQueue): SessionItem | null => (isLastItem(queue) ? null : queue.items[queue.index + 1]);

/** Records how the current item went. Calling it again for the same item replaces the result, so a replay counts once. */
export const withResult = (queue: PracticeQueue, result: SessionResult): PracticeQueue => {
  const results = [...queue.results];
  results[queue.index] = result;
  return { ...queue, results };
};

export const advance = (queue: PracticeQueue): PracticeQueue => (isLastItem(queue) ? queue : { ...queue, index: queue.index + 1 });

export interface SessionSummary {
  played: number;
  total: number;
  stars: number;
  maxStars: number;
  averageAccuracy: number | null;
  elapsedMs: number;
}

export function summarizeQueue(queue: PracticeQueue, now: number): SessionSummary {
  const results = queue.results.filter((result): result is SessionResult => result !== undefined);
  const accuracy = results.length > 0 ? Math.round(results.reduce((sum, result) => sum + result.accuracy, 0) / results.length) : null;
  return {
    played: results.length,
    total: queue.items.length,
    stars: results.reduce((sum, result) => sum + result.stars, 0),
    maxStars: results.length * 3,
    averageAccuracy: accuracy,
    elapsedMs: Math.max(0, now - queue.startedAt)
  };
}
