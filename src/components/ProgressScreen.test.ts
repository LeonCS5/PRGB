import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { exerciseSongId } from '../services/exerciseIds';
import { createProgress, dayKeyOf, MIN_DAY_MS, weekStartOf, type ContentProgress, type Progress, type WeeklyGoal } from '../services/progress';
import { ACHIEVEMENTS } from '../services/achievements';
import { songSongId } from '../services/songIds';
import { ProgressView } from './ProgressScreen';
import { CONTENT_PAGE_SIZE, contentTitle, playedContents, weekDays } from './progress/viewModel';

const noop = () => {};
// Wednesday, 2026-11-18, midday: the week is Mon 16 to Sun 22
const NOW = new Date(2026, 10, 18, 12).getTime();
const DAY = 24 * 3_600_000;

const render = (progress: Progress, now = NOW): string =>
  renderToStaticMarkup(createElement(ProgressView, { progress, now, onGoalChange: noop, onExit: noop, onOpenExercises: noop }));

const content = (over: Partial<ContentProgress> = {}): ContentProgress =>
  ({ bestAccuracy: 92, bestCombo: 30, stars: 2, plays: 3, lastPlayedAt: NOW, ...over });

const withDays = (progress: Progress, offsets: number[], ms = MIN_DAY_MS): Progress => {
  const weeks = { ...progress.weeks };
  const monday = new Date(2026, 10, 16);
  for (const offset of offsets) {
    const day = dayKeyOf(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + offset, 12).getTime());
    const key = weekStartOf(NOW);
    weeks[key] = { ...weeks[key], [day]: ms };
  }
  return { ...progress, weeks };
};

const withGoal = (progress: Progress, weeklyGoal: WeeklyGoal | null): Progress => ({ ...progress, prefs: { ...progress.prefs, weeklyGoal } });

const exercise = exerciseSongId(40, 0);
const played = (): Progress => ({
  ...createProgress(),
  totals: { runs: 4, practiceMs: 600_000, trainingLaps: 0, archivedStars: 0 },
  contents: { [`${exercise}:0`]: content(), '-1:0': content({ stars: 1, lastPlayedAt: NOW - DAY }) },
  achievements: { 'primeira-palhetada': NOW - DAY }
});

describe('ProgressView', () => {
  it('names the screen, has landmarks and a heading to focus', () => {
    const html = render(played());
    expect(html).toContain('>Meu progresso</h1>');
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain('<main');
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain('Voltar ao início');
  });

  it('shows the empty state with the way to the exercises when nothing was played', () => {
    const html = render(createProgress());
    expect(html).toContain('Toque um exercício para começar a colecionar estrelas e palhetas.');
    expect(html).toContain('Abrir os exercícios');
    expect(html).not.toContain('Conteúdo tocado');
    expect(html).toContain('Corda solta');
    expect(html).toContain('0 de 12 palhetas conquistadas.');
  });

  it('shows level, total stars and the next level in text', () => {
    const html = render(played());
    expect(html).toContain('Corda solta');
    expect(html).toContain('3</span> estrelas no total');
    expect(html).toContain('Próximo nível: Primeira posição, com mais 7 estrelas.');
    expect(html).not.toContain('Abrir os exercícios');
  });

  it('shows the last level without a next one', () => {
    const html = render({ ...createProgress(), totals: { runs: 1, practiceMs: 1, trainingLaps: 0, archivedStars: 230 } });
    expect(html).toContain('Palco grande');
    expect(html).toContain('Você chegou ao último nível.');
  });

  it('lists every pick: unlocked with a pt-BR date, the others with what to do', () => {
    const html = render(played());
    for (const item of ACHIEVEMENTS) {
      expect(html).toContain(item.name);
      expect(html).toContain(item.description);
    }
    expect(html).toContain('1 de 12 palhetas conquistadas.');
    expect(html).toMatch(/Conquistada em 17\/11\/2026/);
    expect(html.match(/Ainda não conquistada/g)).toHaveLength(ACHIEVEMENTS.length - 1);
    expect(html).not.toMatch(/bloquead|perdid/i);
  });

  it('marks the rehearsal days in text, Monday to Sunday', () => {
    const html = render(withDays(played(), [0, 2]));
    expect(html).toContain('segunda-feira: ensaiou');
    expect(html).toContain('terça-feira: sem ensaio');
    expect(html).toContain('quarta-feira: ensaiou, hoje');
    expect(html).toContain('2 dias de ensaio nesta semana.');
    for (const label of ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom']) expect(html).toContain(`>${label}</span>`);
  });

  it('counts a day only from one minute played', () => {
    const html = render(withDays(played(), [0], MIN_DAY_MS - 1));
    expect(html).toContain('0 dias de ensaio nesta semana.');
    expect(html).toContain('segunda-feira: sem ensaio');
  });

  it.each([
    [3, '3 de 3 dias', 'Meta cumprida: 3 dias'],
    [5, '2 de 5 dias de ensaio nesta semana.', null],
    [7, '2 de 7 dias de ensaio nesta semana.', null],
    [null, '2 dias de ensaio nesta semana.', null]
  ] as const)('reflects the goal %s', (goal, text, done) => {
    const html = render(withGoal(withDays(played(), [0, 1, ...(goal === 3 ? [2] : [])]), goal));
    expect(html).toContain(done ?? text.replace('3 de 3 dias', ''));
    if (goal === 5 || goal === 7 || goal === null) expect(html).toContain(text);
    expect(html).toMatch(new RegExp(`value="${goal ?? 0}"[^>]*checked|checked=""[^>]*value="${goal ?? 0}"`));
    expect(html.match(/checked=""/g)).toHaveLength(1);
  });

  it('offers the goal as a radio group with a legend and the four choices', () => {
    const html = render(played());
    expect(html).toContain('<fieldset');
    expect(html).toContain('>Meta de dias por semana</legend>');
    expect(html.match(/type="radio"/g)).toHaveLength(4);
    for (const label of ['3 dias', '5 dias', '7 dias', 'Sem meta']) expect(html).toContain(label);
  });

  it('starts a new week from zero, without any message about the old one', () => {
    const old = withDays(played(), [0, 1, 2, 3, 4]);
    const html = render(withGoal(old, 5), NOW + 7 * DAY);
    expect(html).toContain('0 de 5 dias de ensaio nesta semana.');
    expect(html).not.toMatch(/semana passada|anterior/i);
    expect(html).not.toContain('ensaiou<');
  });

  it('lists played content, newest first, with stars in text, accuracy and plays', () => {
    const html = render(played());
    expect(html.indexOf('Pentatônica em Lá menor')).toBeGreaterThan(html.indexOf(contentTitle(exercise, 0)));
    expect(html).toContain('2 de 3 estrelas');
    expect(html).toContain('1 de 3 estrelas');
    expect(html).toContain('92%</span>');
    expect(html).toContain('3</span> vezes');
  });

  it('counts only the external catalog time: no content list, no stars', () => {
    const html = render({ ...createProgress(), totals: { runs: 2, practiceMs: 900_000, trainingLaps: 0, archivedStars: 0 } });
    expect(html).toContain('Conteúdo tocado');
    expect(html).toContain('Os exercícios e as peças que você tocar aparecem aqui');
    expect(html).not.toContain('Abrir os exercícios');
  });

  it('shows at most 30 contents and offers "Ver mais" for the rest', () => {
    const contents: Record<string, ContentProgress> = {};
    for (let part = 0; part < 45; part += 1) contents[`-1:${part}`] = content({ lastPlayedAt: NOW - part });
    const html = render({ ...createProgress(), contents, totals: { runs: 45, practiceMs: 1, trainingLaps: 0, archivedStars: 0 } });
    expect(html.match(/Tocou <span/g)).toHaveLength(CONTENT_PAGE_SIZE);
    expect(html).toContain('Ver mais (15)');
  });

  it('has no calm mode switch (it had no effect to switch)', () => {
    expect(render(played())).not.toMatch(/calm|calmo/i);
  });

  it('never uses words of loss, urgency or guilt', () => {
    const forbidden = /perdeu|perder|streak|\bxp\b|level|última chance|só hoje|corra|\bfalta|faltam/i;
    const states = [
      createProgress(),
      played(),
      withGoal(withDays(played(), [0, 1, 2, 3, 4, 5, 6]), 7),
      withGoal(withDays(played(), [0]), 5),
      withGoal(played(), null)
    ];
    for (const progress of states) expect(render(progress).replace(/<[^>]+>/g, ' ')).not.toMatch(forbidden);
  });
});

describe('progress view model', () => {
  it('builds Monday to Sunday and flags today', () => {
    const days = weekDays(createProgress(), NOW);
    expect(days.map((day) => day.key)).toEqual(['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22']);
    expect(days.filter((day) => day.isToday).map((day) => day.label)).toEqual(['qua']);
  });

  it('on a Sunday the week still starts on the Monday before', () => {
    const sunday = new Date(2026, 10, 22, 23, 30).getTime();
    const days = weekDays(createProgress(), sunday);
    expect(days[0].key).toBe('2026-11-16');
    expect(days[6].isToday).toBe(true);
  });

  it('keeps the week right across a month change', () => {
    const days = weekDays(createProgress(), new Date(2026, 11, 2, 9).getTime());
    expect(days[0].key).toBe('2026-11-30');
    expect(days[6].key).toBe('2026-12-06');
  });

  it('orders played contents by the most recent first and names them', () => {
    const progress = { ...createProgress(), contents: { '-1:0': content({ lastPlayedAt: 5 }), [`${exercise}:0`]: content({ lastPlayedAt: 9 }) } };
    expect(playedContents(progress).map((item) => item.songId)).toEqual([exercise, -1]);
    expect(contentTitle(-1, 0)).toBe('Pentatônica em Lá menor');
    expect(contentTitle(exercise, 0)).not.toBe('Exercício');
    expect(contentTitle(exercise, 99)).toBe('Exercício');
    expect(contentTitle(songSongId(1, 0), 0)).toBe('Ode à Alegria');
    expect(contentTitle(5, 0)).toBe('Conteúdo do PRGB');
  });
});
