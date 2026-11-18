import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ExerciseLibrary, type LibraryView } from './ExerciseLibrary';
import { EXERCISE_CATEGORIES } from '../services/exercises';

vi.setConfig({ testTimeout: 30000 });

const noop = () => {};
const render = (view: LibraryView, withPlayAll: boolean, initialPlayAll = false): string =>
  renderToStaticMarkup(createElement(ExerciseLibrary, { view, onViewChange: noop, onPlay: noop, onExit: noop, onPlayAll: withPlayAll ? noop : undefined, initialPlayAll }));

describe('ExerciseLibrary: play every variation', () => {
  const scales = EXERCISE_CATEGORIES.find((category) => category.patterns.length > 1 && category.groups.some((group) => group.exercises.some((exercise) => exercise.keyed)));
  const view: LibraryView = { categoryId: scales!.id, key: 0, patterns: {} };

  it('starts by playing one variation, with the choice to play all of them stated up front', () => {
    const html = render(view, true);
    for (const text of ['Ao tocar um cartão', 'Só esta variação', 'Todas as variações em sequência']) expect(html).toContain(text);
    expect(html).toMatch(/<input[^>]*name="exercise-play-mode"(?=[^>]*value="one")(?=[^>]*checked)/);
    expect(html).not.toContain('variações em sequência ·');
    expect(html).toContain('Como tocar');
    expect(html).not.toContain('Quantos tons');
  });

  it('in "all" mode every card says it plays the sequence, with the count and the time, and the keys can be chosen', () => {
    const html = render(view, true, true);
    expect(html).toMatch(/\d+ variações em sequência · \d+ min/);
    expect(html).toContain(`${scales!.patterns.length * 3} variações em sequência`);
    for (const text of ['Quantos tons', 'Só este tom', '3 tons', '6 tons', '12 tons', 'Começar no tom']) expect(html).toContain(text);
    expect(html).toMatch(/<input[^>]*name="exercise-cycle"(?=[^>]*value="3")(?=[^>]*checked)/);
    expect(html).not.toContain('Como tocar</legend>');
  });

  it('has no such choice when the caller does not handle sequences', () => {
    const html = render(view, false);
    expect(html).not.toContain('Ao tocar um cartão');
    expect(html).not.toContain('variações em sequência');
  });
});
