import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { contentKey, createProgress, STAR_ACCURACY, type Progress } from '../services/progress';
import { RESOLVED_TRAIL, summarizeTrail, TRAIL, TRAIL_STEP_COUNT } from '../services/trail';
import { TrailView } from './TrailScreen';

const noop = () => {};
const everyStep = RESOLVED_TRAIL.flatMap(({ steps }) => steps);
const FORBIDDEN = /\b(perdeu|perder|streak|xp|level|última chance|só hoje|corra|falta|faltam)\b/i;

const render = (progress: Progress): string =>
  renderToStaticMarkup(createElement(TrailView, { summary: summarizeTrail(progress), onPlay: noop, onExit: noop }));

const textOf = (html: string): string => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

const played = (count: number, stars: number): Progress => ({
  ...createProgress(),
  contents: Object.fromEntries(everyStep.slice(0, count).map((step) => [contentKey(step.songId, step.partId), { bestAccuracy: 93, bestCombo: 25, stars, plays: 3, lastPlayedAt: 1 }]))
});

describe('TrailView', () => {
  it('states how stars and accuracy work, with the real thresholds, and shows each step description on any screen', () => {
    const html = render(createProgress());
    expect(textOf(html)).toContain(`1 com ${STAR_ACCURACY.one}% de precisão, 2 com ${STAR_ACCURACY.two}%, 3 com ${STAR_ACCURACY.three}%`);
    expect(textOf(html)).toContain('Precisão é a porcentagem das notas acertadas');
    expect(html).not.toMatch(/hidden[^"]*sm:block[^>]*>[^<]*<\/span>/);
  });

  it('shows every stage, with its title and goal, and the first step as the place to begin', () => {
    const html = render(createProgress());
    expect(html).toContain('Trilha</h1>');
    for (const [index, stage] of TRAIL.entries()) {
      expect(html).toContain(`Etapa ${index + 1}: ${stage.title}`);
      expect(html).toContain(stage.goal);
    }
    expect(html).toContain('Comece por aqui');
    expect(html).toContain('Próximo');
    expect(html).toContain(`0</span> de <span class="font-mono">${TRAIL_STEP_COUNT}`);
  });

  it('opens only the stage of the next step, and says what was done in the others', () => {
    const html = render(played(RESOLVED_TRAIL[0].steps.length + 2, 2));
    expect(html.match(/<details[^>]* open/g)).toHaveLength(1);
    expect(html).toContain('Etapa 1: Primeiros sons');
    expect(html).toContain('6 de 6 com estrela');
    expect(html).toContain('Continue daqui');
    expect(html).toContain('2 de 3 estrelas');
    expect(html).toContain('melhor precisão 93%');
    expect(html).toContain('3 vezes');
  });

  it('has one play button per step plus the one that continues, each named by its step', () => {
    const html = render(createProgress());
    expect(html.match(/aria-label="Tocar /g)).toHaveLength(TRAIL_STEP_COUNT + 1);
    expect(html).toContain(`aria-label="Tocar ${everyStep[0].title}"`);
  });

  it('thanks the player and offers nothing to chase when every step has a star', () => {
    const html = render(played(TRAIL_STEP_COUNT, 3));
    expect(html).toContain('Você já tem estrela em todos os exercícios da trilha');
    expect(html).not.toContain('Continue daqui');
    expect(html).not.toContain('Próximo');
    expect(html.match(/<details[^>]* open/g)).toBeNull();
  });

  it('labels the progress bar and the stage lists for a screen reader', () => {
    const html = render(played(10, 1));
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="10"');
    expect(html).toContain('aria-label="Exercícios da etapa 1"');
  });

  it('never talks about loss, urgency or lack, in any state', () => {
    for (const progress of [createProgress(), played(12, 1), played(TRAIL_STEP_COUNT, 3)]) {
      expect(textOf(render(progress))).not.toMatch(FORBIDDEN);
    }
  });
});
