import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, evaluateAchievements, type AchievementContext } from './achievements';
import { createProgress, weeklyProgress } from './progress';

const emptyContext = (): AchievementContext => ({
  progress: createProgress(),
  run: null,
  event: null,
  weekly: weeklyProgress(createProgress(), new Date(2026, 10, 16, 12).getTime()),
  twoStarContents: 0
});

describe('achievements table', () => {
  it('has stable, unique, well-formed ids and pt-BR text', () => {
    const ids = ACHIEVEMENTS.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const item of ACHIEVEMENTS) {
      expect(item.id).toMatch(/^[a-z0-9-]{1,48}$/);
      expect(item.name.length).toBeGreaterThan(2);
      expect(item.description.length).toBeGreaterThan(10);
    }
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(10);
  });

  it('uses no pressure wording in names or descriptions', () => {
    const text = ACHIEVEMENTS.map((item) => `${item.name} ${item.description}`).join(' ').toLowerCase();
    for (const banned of ['perdeu', 'perder', 'streak', ' xp', 'level', 'última chance', 'só hoje', 'corra', 'falta']) {
      expect(text).not.toContain(banned);
    }
  });

  it('unlocks nothing from an empty context', () => {
    expect(evaluateAchievements(emptyContext())).toEqual([]);
  });

  it('skips the ones already unlocked', () => {
    const context = emptyContext();
    context.event = { type: 'latencyTestSaved' };
    expect(evaluateAchievements(context)).toEqual(['mao-no-tempo']);
    context.progress = { ...context.progress, achievements: { 'mao-no-tempo': 1 } };
    expect(evaluateAchievements(context)).toEqual([]);
  });
});
