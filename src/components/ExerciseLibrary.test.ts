import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ExerciseLibrary, type LibraryView } from './ExerciseLibrary';
import { EXERCISE_CATEGORIES } from '../services/exercises';

vi.setConfig({ testTimeout: 30000 });

const noop = () => {};
const render = (view: LibraryView, withPlayAll: boolean): string =>
  renderToStaticMarkup(createElement(ExerciseLibrary, { view, onViewChange: noop, onPlay: noop, onExit: noop, onPlayAll: withPlayAll ? noop : undefined }));

describe('ExerciseLibrary: play every variation', () => {
  const scales = EXERCISE_CATEGORIES.find((category) => category.patterns.length > 1 && category.groups.some((group) => group.exercises.some((exercise) => exercise.keyed)));

  it('offers to play all the variations of an exercise in a row, with the count and the time', () => {
    expect(scales).toBeDefined();
    const html = render({ categoryId: scales!.id, key: 0, patterns: {} }, true);
    expect(html).toMatch(/Tocar as \d+ variações em sequência/);
    expect(html).toMatch(/\d+ min/);
  });

  it('lets the player choose how many keys the sequence goes through', () => {
    const html = render({ categoryId: scales!.id, key: 0, patterns: {} }, true);
    for (const text of ['Tons ao tocar todas as variações', 'Só este tom', '3 tons', '6 tons', '12 tons']) expect(html).toContain(text);
    expect(html).toMatch(/<input[^>]*name="exercise-cycle"(?=[^>]*value="3")(?=[^>]*checked)/);
    expect(html).toContain(`Tocar as ${scales!.patterns.length * 3} variações em sequência`);
  });

  it('has no such button when the caller does not handle it', () => {
    const html = render({ categoryId: scales!.id, key: 0, patterns: {} }, false);
    expect(html).not.toContain('variações em sequência');
  });
});
