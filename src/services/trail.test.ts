import { describe, expect, it, vi } from 'vitest';
import { buildExerciseTab, categoryOf, EXERCISE_CATEGORIES, exercisePart } from './exercises';
import { contentKey, createProgress, type ContentProgress, type Progress } from './progress';
import { RESOLVED_TRAIL, stepProgress, summarizeTrail, TRAIL, TRAIL_STEP_COUNT } from './trail';

vi.setConfig({ testTimeout: 30000 });

const everyStep = RESOLVED_TRAIL.flatMap(({ steps }) => steps);
const FORBIDDEN = /\b(perdeu|perder|streak|xp|level|última chance|só hoje|corra|falta|faltam)\b/i;

const saved = (stars: number, over: Partial<ContentProgress> = {}): ContentProgress =>
  ({ bestAccuracy: 90, bestCombo: 20, stars, plays: 2, lastPlayedAt: 1, ...over });

const withStars = (steps: typeof everyStep, stars: number): Progress => ({
  ...createProgress(),
  contents: Object.fromEntries(steps.map((step) => [contentKey(step.songId, step.partId), saved(stars)]))
});

describe('the trail', () => {
  it('is a real path: many steps, each one an exercise that exists', () => {
    expect(TRAIL_STEP_COUNT).toBeGreaterThanOrEqual(100);
    expect(everyStep).toHaveLength(TRAIL_STEP_COUNT);
    expect(everyStep.map((step) => step.index)).toEqual(everyStep.map((_, position) => position + 1));
  });

  it('never repeats a stage or a step: each step is its own record', () => {
    expect(new Set(TRAIL.map((stage) => stage.id)).size).toBe(TRAIL.length);
    expect(new Set(everyStep.map((step) => `${step.songId}:${step.partId}`)).size).toBe(everyStep.length);
  });

  it('names each step like the tab it plays, with the same id, so progress and records line up', () => {
    for (const step of everyStep) {
      const tab = buildExerciseTab(step.exercise, step.key, step.pattern);
      expect(tab.songId, step.title).toBe(step.songId);
      expect(tab.title, step.title).toBe(step.title);
      expect(tab.trackName, step.title).toBe(step.trackName);
      expect(exercisePart(step.exercise, step.key, step.pattern).partId, step.title).toBe(step.partId);
    }
  });

  it('only asks for a way of playing that the exercise has, and for real keys', () => {
    for (const { code, key, pattern } of TRAIL.flatMap((stage) => stage.steps)) {
      expect(Number.isInteger(key) && key >= 0 && key <= 11, `key of ${code}`).toBe(true);
      if (pattern) {
        const step = everyStep.find((item) => item.exercise.code === code && item.pattern === pattern);
        expect(categoryOf(step!.exercise).patterns, `pattern of ${code}`).toContain(pattern);
      }
    }
  });

  it('gets harder: no step is easier than the one before it in its stage, and no stage is easier than the one before', () => {
    let previousMean = 0;
    for (const { stage, steps } of RESOLVED_TRAIL) {
      const levels = steps.map((step) => step.level);
      expect(levels, stage.title).toEqual([...levels].sort((a, b) => a - b));
      const mean = levels.reduce((sum, level) => sum + level, 0) / levels.length;
      // A tolerance of a tenth of a level: a new topic may open with one easier step (the first major pentatonic box)
      expect(mean, stage.title).toBeGreaterThanOrEqual(previousMean - 0.1);
      previousMean = mean;
    }
  });

  it('starts at the beginner level and keeps the hardest material for the end', () => {
    expect(RESOLVED_TRAIL.slice(0, 4).flatMap(({ steps }) => steps).every((step) => step.level === 1)).toBe(true);
    expect(RESOLVED_TRAIL.slice(0, 9).flatMap(({ steps }) => steps).some((step) => step.level === 3)).toBe(false);
    expect(RESOLVED_TRAIL.slice(-3).flatMap(({ steps }) => steps).every((step) => step.level === 3)).toBe(true);
  });

  it('keeps the first three stages near the nut: open strings, open chords and low power chords, nothing above fret 9', () => {
    for (const { steps } of RESOLVED_TRAIL.slice(0, 3)) {
      for (const step of steps) {
        const frets = buildExerciseTab(step.exercise, step.key, step.pattern).notes.map((note) => note.fret);
        expect(Math.max(...frets), step.title).toBeLessThanOrEqual(9);
      }
    }
  });

  it('puts the progressions that need barre chords after the barre stage, and none before it', () => {
    const barre = RESOLVED_TRAIL.findIndex(({ stage }) => stage.id === 'pestana-e-blues');
    const movable = [130, 131, 132, 133, 136, 140, 141, 145];
    const placed = (code: number) => RESOLVED_TRAIL.findIndex(({ steps }) => steps.some((step) => step.exercise.code === code));
    for (const code of movable) expect(placed(code), `exercise ${code}`).toBeGreaterThan(barre);
  });

  it('plays the first progressions with open chords', () => {
    const stage = RESOLVED_TRAIL.find(({ stage: item }) => item.id === 'ritmo-e-progressoes')!;
    expect(stage.steps.some((step) => step.exercise.code === 115)).toBe(true);
    expect(stage.steps.some((step) => step.exercise.code === 116)).toBe(true);
  });

  it('uses most of the library, so the path is not a short list', () => {
    const inLibrary = EXERCISE_CATEGORIES.flatMap((category) => category.groups.flatMap((group) => group.exercises)).length;
    const inTrail = new Set(everyStep.map((step) => step.exercise.code)).size;
    expect(inTrail / inLibrary).toBeGreaterThan(0.85);
  });

  it('has text that says what the player gains, without pressure', () => {
    for (const stage of TRAIL) {
      expect(stage.title.length).toBeGreaterThan(3);
      expect(stage.goal.endsWith('.')).toBe(true);
      expect(`${stage.title} ${stage.goal}`).not.toMatch(FORBIDDEN);
    }
  });
});

describe('summarizeTrail', () => {
  it('starts at the first step when nothing was played', () => {
    const summary = summarizeTrail(createProgress());
    expect(summary.withStars).toBe(0);
    expect(summary.totalStars).toBe(0);
    expect(summary.next?.index).toBe(1);
    expect(summary.nextStageId).toBe(TRAIL[0].id);
    expect(summary.maxStars).toBe(TRAIL_STEP_COUNT * 3);
  });

  it('goes on from the first step without stars, even if later ones were played', () => {
    const summary = summarizeTrail(withStars([everyStep[0], everyStep[1], everyStep[9]], 2));
    expect(summary.withStars).toBe(3);
    expect(summary.totalStars).toBe(6);
    expect(summary.next?.index).toBe(3);
  });

  it('points at the stage of the next step, and at nothing once every step has a star', () => {
    const upToSecondStage = RESOLVED_TRAIL[0].steps.length + RESOLVED_TRAIL[1].steps.length;
    expect(summarizeTrail(withStars(everyStep.slice(0, upToSecondStage), 1)).nextStageId).toBe(TRAIL[2].id);
    const done = summarizeTrail(withStars(everyStep, 3));
    expect(done.next).toBeNull();
    expect(done.nextStageId).toBeNull();
    expect(done.totalStars).toBe(done.maxStars);
  });

  it('counts a step with plays but no stars as played, not as done', () => {
    const progress = { ...createProgress(), contents: { [contentKey(everyStep[0].songId, everyStep[0].partId)]: saved(0, { plays: 1, bestAccuracy: 40 }) } };
    expect(stepProgress(progress, everyStep[0])).toEqual({ stars: 0, bestAccuracy: 40, plays: 1 });
    expect(summarizeTrail(progress).next?.index).toBe(1);
    expect(stepProgress(createProgress(), everyStep[0])).toEqual({ stars: 0, bestAccuracy: null, plays: 0 });
  });
});
