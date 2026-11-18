import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { createProgress } from '../services/progress';
import { advance, startQueue, withResult, type SessionItem } from '../services/practiceSession';
import { RESOLVED_TRAIL } from '../services/trail';
import { SessionStrip } from './SessionStrip';
import { SessionView, type SessionMode } from './SessionScreen';

vi.setConfig({ testTimeout: 30000 });

const noop = () => {};
const NOW = new Date(2026, 10, 18, 12).getTime();
const FORBIDDEN = /\b(perdeu|perder|streak|xp|level|última chance|só hoje|corra|falta|faltam)\b/i;
const textOf = (html: string): string => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

const render = (initialMode: SessionMode, initialStageId?: string): string =>
  renderToStaticMarkup(createElement(SessionView, { progress: createProgress(), now: NOW, onStart: noop, onExit: noop, initialMode, initialStageId }));

describe('SessionView', () => {
  it('offers the three ways to build a session and the two ways to make it longer', () => {
    const html = render('tempo');
    for (const text of ['Etapa da trilha', 'Por tempo', 'Montar a minha', 'Deixar mais longa', 'Tons por exercício', '12 tons', 'Todos os jeitos de tocar']) expect(html).toContain(text);
  });

  it('by time: lets the player pick 10, 15 or 20 minutes and shows the session it would play', () => {
    const html = render('tempo');
    for (const text of ['10 minutos', '15 minutos', '20 minutos']) expect(html).toContain(text);
    expect(html).toContain('Ordem da sessão');
    expect(html).toContain('cerca de');
    expect(html).toContain('Começar a sessão');
    expect(html).not.toMatch(/Começar a sessão<\/button>.*disabled/);
  });

  it('by stage: starts on the stage asked for and lists its exercises in order', () => {
    const stage = RESOLVED_TRAIL[1];
    const html = render('etapa', stage.stage.id);
    expect(html).toContain(`Etapa 2: ${stage.stage.title}`);
    expect(html).toContain(`<option value="${stage.stage.id}" selected`);
    expect(html.indexOf(stage.steps[0].title)).toBeGreaterThan(-1);
    expect(html.indexOf(stage.steps[0].title)).toBeLessThan(html.indexOf(stage.steps[stage.steps.length - 1].title));
  });

  it('by hand: starts empty, cannot begin yet, and offers every category with its exercises to add', () => {
    const html = render('minha');
    expect(html).toContain('Nada por aqui ainda');
    expect(html).toContain('Adicione ao menos um exercício para começar');
    expect(html).toMatch(/<button[^>]*disabled[^>]*>.*?Começar a sessão/);
    for (const text of ['Aquecimento', 'Pentatônicas', 'Braço']) expect(html).toContain(text);
    expect(html).toContain('aria-label="Adicionar Aranha"');
  });

  it('never talks about loss, urgency or lack', () => {
    for (const mode of ['etapa', 'tempo', 'minha'] as const) expect(textOf(render(mode))).not.toMatch(FORBIDDEN);
  });
});

describe('SessionStrip', () => {
  const items: SessionItem[] = [{ code: 188, key: 0 }, { code: 10, key: 0 }, { code: 60, key: 7 }];
  const strip = (queue: ReturnType<typeof startQueue>): string => renderToStaticMarkup(createElement(SessionStrip, { queue, onNext: noop, onEnd: noop }));

  it('in the middle of a session: where it is, what comes next, and how to go on or stop', () => {
    const html = strip(startQueue(items, NOW));
    expect(html).toContain('Sessão · exercício 1 de 3');
    expect(html).toContain('A seguir: Aranha');
    expect(html).toContain('Seguir agora');
    expect(html).toContain('Pausar contagem');
    expect(html).toContain('Encerrar sessão');
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="1"');
    expect(html).toContain('Começa em');
  });

  it('names the next exercise with its key', () => {
    expect(strip(advance(startQueue(items, NOW)))).toContain('A seguir: Escala maior em G');
  });

  it('at the end: closes the session with what was played, and offers no next exercise', () => {
    let queue = startQueue(items, NOW);
    queue = withResult(queue, { title: 'a', stars: 3, accuracy: 98, score: 1 });
    queue = withResult(advance(queue), { title: 'b', stars: 1, accuracy: 72, score: 1 });
    queue = withResult(advance(queue), { title: 'c', stars: 2, accuracy: 90, score: 1 });
    const html = strip(queue);
    expect(html).toContain('Sessão concluída');
    expect(html).toContain('3 de 3 exercícios');
    expect(html).toContain('6 de 9 estrelas');
    expect(html).toContain('precisão média 87%');
    expect(html).toContain('Terminar sessão');
    expect(html).not.toContain('A seguir');
    expect(html).not.toContain('Seguir agora');
  });

  it('never talks about loss, urgency or lack', () => {
    expect(textOf(strip(startQueue(items, NOW)))).not.toMatch(FORBIDDEN);
  });
});
