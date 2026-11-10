import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CrashScreen, ErrorBoundary } from './ErrorBoundary';

describe('CrashScreen', () => {
  it('tells the player what happened in Portuguese and offers a way out', () => {
    const html = renderToStaticMarkup(createElement(CrashScreen));
    expect(html).toContain('Algo deu errado por aqui');
    expect(html).toContain('Recarregar');
    expect(html).toContain('role="alert"');
  });
});

describe('ErrorBoundary', () => {
  it('turns a render error into the crash screen state', () => {
    expect(ErrorBoundary.getDerivedStateFromError()).toEqual({ hasError: true });
  });

  it('renders its children while nothing failed', () => {
    const html = renderToStaticMarkup(createElement(ErrorBoundary, null, createElement('p', null, 'tudo certo')));
    expect(html).toBe('<p>tudo certo</p>');
  });
});
