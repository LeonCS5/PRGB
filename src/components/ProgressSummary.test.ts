import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { formatCountedTime, type RunProgress } from '../context/progressStore';
import { exerciseSongId } from '../services/exerciseIds';
import { createProgress, recordRun, type FinishedRun } from '../services/progress';
import type { ScoreState } from '../services/scoring';
import { ProgressSummary } from './ProgressSummary';

const NOW = new Date(2026, 10, 16, 12).getTime();
const score = (perfect: number, good: number, miss: number): ScoreState => ({ score: 0, combo: 0, maxCombo: perfect, perfect, good, miss });
const run = (over: Partial<FinishedRun> = {}): FinishedRun => ({
  songId: exerciseSongId(40, 0), partId: 0, score: score(100, 0, 0), speed: 1, jumped: false, speedChanged: false, laps: 1, playedMs: 120_000, ...over
});
const markup = (progress: RunProgress): string => renderToStaticMarkup(createElement(ProgressSummary, { progress }));
const render = (over: Partial<FinishedRun> = {}, goal: 3 | 5 | 7 | null = null): string => {
  const start = createProgress();
  start.prefs.weeklyGoal = goal;
  const { report } = recordRun(start, run(over), NOW);
  return markup({ report, countedMs: over.playedMs ?? 120_000 });
};

describe('ProgressSummary', () => {
  it('shows the stars of the run in words, the new pick with its description, and the level by name', () => {
    const html = render();
    expect(html).toContain('3 de 3 estrelas');
    expect(html).toContain('3 estrelas novas');
    expect(html).toContain('Palheta nova: Primeira palhetada');
    expect(html).toContain('Tocou o primeiro exercício até o fim.');
    expect(html).toContain('Corda solta');
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
  });

  it('shows the weekly rehearsal as days of the goal, with no loss wording when it was not reached', () => {
    const html = render({}, 3);
    expect(html).toContain('Ensaio da semana: 1 de 3 dias.');
    expect(html).not.toMatch(/perd|faltam|falta |quebr|sequência|expira|última chance/i);
  });

  it('says the goal was reached once it is', () => {
    let progress = createProgress();
    progress.prefs.weeklyGoal = 3;
    let report = recordRun(progress, run(), NOW).report;
    for (const day of [16, 17, 18]) {
      const next = recordRun(progress, run(), new Date(2026, 10, day, 12).getTime());
      progress = next.progress;
      report = next.report;
    }
    expect(markup({ report, countedMs: 120_000 })).toContain('meta cumprida');
  });

  it('shows only the time for a song of the external catalog, with no stars', () => {
    const html = render({ songId: 1234 });
    expect(html).toContain('Tempo contado');
    expect(html).toContain('sem estrelas');
    expect(html).not.toContain('de 3 estrelas');
    expect(html).not.toContain('<svg');
    expect(html).not.toContain('Palheta nova');
  });

  it('shows no star for a run with a seek but counts its time', () => {
    const html = render({ jumped: true });
    expect(html).toContain('não conta estrelas');
    expect(html).not.toContain('de 3 estrelas');
    expect(html).toContain('2 min');
  });

  it('is gentle when a rated run earns no star', () => {
    expect(render({ score: score(40, 0, 60) })).toContain('Sem estrela desta vez');
  });
});

describe('formatCountedTime', () => {
  it('writes minutes and seconds in pt-BR', () => {
    expect(formatCountedTime(20_000)).toBe('menos de 1 minuto');
    expect(formatCountedTime(120_000)).toBe('2 min');
    expect(formatCountedTime(200_000)).toBe('3 min 20 s');
    expect(formatCountedTime(3_900_000)).toBe('1 h 05 min');
  });
});
