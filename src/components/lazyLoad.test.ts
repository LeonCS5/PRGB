import { createElement, Suspense, type FC } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { hasFailedLazyLoad, isLoadFailure, LazyLoadError, lazyWithRetry, resetFailedLazyLoads, shouldReloadOnPreloadError } from './lazyLoad';

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('lazyWithRetry', () => {
  it('imports again after a failure only once the failed screens are reset', async () => {
    const load = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch dynamically imported module: /assets/x.js'))
      .mockReturnValue(new Promise(() => undefined));
    const Screen = lazyWithRetry(load, (module: { Screen: FC<{ name: string }> }) => module.Screen);
    const render = () => renderToStaticMarkup(createElement(Suspense, { fallback: 'carregando' }, createElement(Screen, { name: 'x' })));

    expect(render()).toBe('carregando');
    await tick();
    expect(hasFailedLazyLoad()).toBe(true);
    render(); // the rejected import stays cached: rendering again does not import again
    expect(load).toHaveBeenCalledTimes(1);

    resetFailedLazyLoads();
    expect(hasFailedLazyLoad()).toBe(false);
    expect(render()).toBe('carregando');
    expect(load).toHaveBeenCalledTimes(2);
  });
});

describe('isLoadFailure', () => {
  it('tells a failed import from any other error', () => {
    expect(isLoadFailure(new LazyLoadError(new Error('x')))).toBe(true);
    expect(isLoadFailure(new TypeError('error loading dynamically imported module'))).toBe(true);
    expect(isLoadFailure(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(isLoadFailure('texto')).toBe(false);
  });
});

describe('shouldReloadOnPreloadError', () => {
  it('reloads once, then not again within the same half minute', () => {
    expect(shouldReloadOnPreloadError(1_000_000, null)).toBe(true);
    expect(shouldReloadOnPreloadError(1_010_000, '1000000')).toBe(false);
    expect(shouldReloadOnPreloadError(1_100_000, '1000000')).toBe(true);
    expect(shouldReloadOnPreloadError(1_000_000, 'lixo')).toBe(true);
  });
});
