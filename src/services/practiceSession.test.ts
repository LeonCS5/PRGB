import { describe, expect, it, vi } from 'vitest';
import { categoryOf, exerciseByCode } from './exercises';
import { contentKey, createProgress, type Progress } from './progress';
import {
  advance, customSession, DEFAULT_EXPAND, expandItem, isLastItem, isValidItem, itemDurationMs, itemPart, itemTitle, MAX_SESSION_ITEMS,
  nextItem, sessionDurationMs, SESSION_MINUTES, stageSession, startQueue, summarizeQueue, timedSession, withResult, type SessionItem
} from './practiceSession';
import { RESOLVED_TRAIL, TRAIL } from './trail';

vi.setConfig({ testTimeout: 30000 });

const SCALE: SessionItem = { code: 60, key: 0 }; // C major: keyed, with five patterns
const ARPEGGIO: SessionItem = { code: 80, key: 0 }; // keyed, no patterns
const OPEN_STRINGS: SessionItem = { code: 188, key: 0 }; // fixed place on the neck, no patterns
const CHORDS: SessionItem = { code: 100, key: 0 }; // fixed, two patterns (strum, picked)

const starsFor = (steps: { songId: number; partId: number }[], stars: number): Progress => ({
  ...createProgress(),
  contents: Object.fromEntries(steps.map((step) => [contentKey(step.songId, step.partId), { bestAccuracy: 90, bestCombo: 20, stars, plays: 1, lastPlayedAt: 1 }]))
});

describe('expandItem: more of the same exercise', () => {
  it('leaves an item alone with the defaults', () => {
    expect(expandItem(SCALE, DEFAULT_EXPAND)).toEqual([SCALE]);
  });

  it('walks the keys a fourth apart, from the chosen one', () => {
    expect(expandItem({ code: 60, key: 0 }, { keys: 3, allPatterns: false }).map((item) => item.key)).toEqual([0, 5, 10]);
    expect(expandItem({ code: 60, key: 7 }, { keys: 12, allPatterns: false }).map((item) => item.key)).toEqual([7, 0, 5, 10, 3, 8, 1, 6, 11, 4, 9, 2]);
  });

  it('visits all twelve keys once at 12', () => {
    expect(new Set(expandItem(ARPEGGIO, { keys: 12, allPatterns: false }).map((item) => item.key)).size).toBe(12);
  });

  it('plays every pattern the exercise has, key by key', () => {
    const items = expandItem(SCALE, { keys: 2, allPatterns: true });
    expect(items.map((item) => `${item.key}:${item.pattern}`)).toEqual([
      '0:updown', '0:threes', '0:fours', '0:thirds', '0:perString',
      '5:updown', '5:threes', '5:fours', '5:thirds', '5:perString'
    ]);
    expect(expandItem(CHORDS, { keys: 1, allPatterns: true }).map((item) => item.pattern)).toEqual(['strum', 'picked']);
  });

  it('keeps fixed exercises to one entry, whatever is asked', () => {
    expect(expandItem(OPEN_STRINGS, { keys: 12, allPatterns: true })).toEqual([OPEN_STRINGS]);
    expect(expandItem(ARPEGGIO, { keys: 1, allPatterns: true })).toEqual([ARPEGGIO]);
  });

  it('never makes an item that cannot be played', () => {
    for (const item of expandItem(SCALE, { keys: 12, allPatterns: true })) {
      expect(isValidItem(item)).toBe(true);
      expect(itemPart(item)).not.toBeNull();
    }
  });
});

describe('the three ways to build a session', () => {
  it('a trail stage becomes its steps, in order', () => {
    const stage = RESOLVED_TRAIL[1];
    const items = stageSession(stage.stage.id);
    expect(items.map((item) => item.code)).toEqual(stage.steps.map((step) => step.exercise.code));
    expect(stageSession('nao-existe')).toEqual([]);
  });

  it('a stage grows with the keys and patterns asked for', () => {
    const plain = stageSession('escalas-e-modos');
    expect(stageSession('escalas-e-modos', { keys: 3, allPatterns: true }).length).toBeGreaterThan(plain.length * 3);
  });

  it('a timed session lasts about as long as asked, for each length and for a new player', () => {
    for (const minutes of SESSION_MINUTES) {
      const items = timedSession(minutes, createProgress());
      const estimate = sessionDurationMs(items);
      expect(items.length, `${minutes} min`).toBeGreaterThan(2);
      expect(estimate, `${minutes} min`).toBeGreaterThan(minutes * 60_000 * 0.6);
      expect(estimate, `${minutes} min`).toBeLessThan(minutes * 60_000 * 1.5);
      expect(items.every(isValidItem)).toBe(true);
    }
  });

  it('a timed session has the warm-up first and every kind of work in a longer one', () => {
    const items = timedSession(20, createProgress());
    const kinds = items.map((item) => categoryOf(exerciseByCode(item.code)!).id);
    expect(kinds[0]).toBe('aquecimento');
    expect(new Set(kinds).size).toBeGreaterThanOrEqual(4);
  });

  it('never repeats an exercise inside a timed session', () => {
    const items = timedSession(20, createProgress());
    expect(new Set(items.map((item) => `${item.code}:${item.key}:${item.pattern ?? ''}`)).size).toBe(items.length);
  });

  it('a timed session follows the player along the trail', () => {
    const everyStep = RESOLVED_TRAIL.flatMap(({ steps }) => steps);
    const beginner = timedSession(15, createProgress());
    const advanced = timedSession(15, starsFor(everyStep.slice(0, 60), 3));
    const level = (items: SessionItem[]) => items.reduce((sum, item) => sum + exerciseByCode(item.code)!.level, 0) / items.length;
    expect(level(advanced)).toBeGreaterThan(level(beginner));
    // Nothing from far beyond where the player is
    expect(beginner.every((item) => exerciseByCode(item.code)!.level <= 2)).toBe(true);
  });

  it('is the same for the same player on the same day, and changes the review on another', () => {
    const everyStep = RESOLVED_TRAIL.flatMap(({ steps }) => steps);
    const done = starsFor(everyStep, 3);
    expect(timedSession(15, done, DEFAULT_EXPAND, 0)).toEqual(timedSession(15, done, DEFAULT_EXPAND, 0));
    expect(timedSession(15, done, DEFAULT_EXPAND, 0)).not.toEqual(timedSession(15, done, DEFAULT_EXPAND, 3 * 86_400_000));
  });

  it('applies the longer-session options to a timed session too', () => {
    const midway = starsFor(RESOLVED_TRAIL.flatMap(({ steps }) => steps).slice(0, 55), 2);
    const plain = timedSession(10, midway);
    const rich = timedSession(10, midway, { keys: 3, allPatterns: true });
    const keysOfOne = (items: SessionItem[]) => Math.max(...[...new Set(items.map((item) => item.code))].map((code) => new Set(items.filter((item) => item.code === code).map((item) => item.key)).size));
    expect(keysOfOne(plain)).toBe(1);
    expect(keysOfOne(rich)).toBe(3);
    expect(rich.length).toBeLessThanOrEqual(MAX_SESSION_ITEMS);
  });

  it('a list by hand keeps the order, expands, and drops what is not an exercise', () => {
    const items = customSession([OPEN_STRINGS, { code: 999999, key: 0 }, { code: 60, key: 12 }, { code: 188, key: 0, pattern: 'strum' }, SCALE]);
    expect(items).toEqual([OPEN_STRINGS, SCALE]);
    expect(customSession([ARPEGGIO, SCALE], { keys: 2, allPatterns: false }).map((item) => `${item.code}:${item.key}`)).toEqual(['80:0', '80:5', '60:0', '60:5']);
  });

  it('never goes past the limit', () => {
    const many = Array.from({ length: 40 }, () => SCALE);
    expect(customSession(many, { keys: 12, allPatterns: true })).toHaveLength(MAX_SESSION_ITEMS);
  });
});

describe('time and names', () => {
  it('adds the count-ins and the pauses between exercises to the exercises themselves', () => {
    const items = [OPEN_STRINGS, ARPEGGIO];
    const playing = itemDurationMs(OPEN_STRINGS) + itemDurationMs(ARPEGGIO);
    expect(playing).toBeGreaterThan(5000);
    expect(sessionDurationMs(items)).toBeGreaterThan(playing + 5000);
    expect(sessionDurationMs([])).toBe(0);
  });

  it('names an item like the exercise card, with its key', () => {
    expect(itemTitle({ code: 60, key: 7 })).toBe('Escala maior em G');
    expect(itemTitle(OPEN_STRINGS)).toBe('Cordas soltas');
  });
});

describe('a queue being played', () => {
  const items = [OPEN_STRINGS, ARPEGGIO, SCALE];
  const result = (stars: number, accuracy: number) => ({ title: 'x', stars, accuracy, score: 100 });

  it('goes item by item and stops at the last one', () => {
    let queue = startQueue(items, 1000);
    expect(queue.index).toBe(0);
    expect(nextItem(queue)).toEqual(ARPEGGIO);
    queue = advance(advance(queue));
    expect(isLastItem(queue)).toBe(true);
    expect(nextItem(queue)).toBeNull();
    expect(advance(queue).index).toBe(2);
  });

  it('gives every session its own id', () => {
    expect(startQueue(items, 0).id).not.toBe(startQueue(items, 0).id);
  });

  it('counts a replayed item once', () => {
    let queue = startQueue(items, 0);
    queue = withResult(queue, result(1, 70));
    queue = withResult(queue, result(3, 98));
    expect(queue.results).toHaveLength(1);
    expect(summarizeQueue(queue, 5000).stars).toBe(3);
  });

  it('sums stars and averages accuracy over what was played, and tells how long it took', () => {
    let queue = startQueue(items, 1000);
    queue = withResult(queue, result(3, 98));
    queue = withResult(advance(queue), result(1, 72));
    const summary = summarizeQueue(queue, 61_000);
    expect(summary).toEqual({ played: 2, total: 3, stars: 4, maxStars: 6, averageAccuracy: 85, elapsedMs: 60_000 });
  });

  it('has no average before anything was played', () => {
    expect(summarizeQueue(startQueue(items, 0), 0).averageAccuracy).toBeNull();
  });

  it('every trail stage can be turned into a session', () => {
    for (const { stage } of TRAIL.map((entry) => ({ stage: entry }))) {
      expect(stageSession(stage.id).length, stage.id).toBeGreaterThan(0);
    }
  });
});
