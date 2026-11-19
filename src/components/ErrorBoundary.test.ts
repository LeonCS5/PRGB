import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CrashScreen, ErrorBoundary, LazyErrorBoundary, LoadFailureNotice } from './ErrorBoundary';
import { LazyLoadError } from './lazyLoad';

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

describe('LazyErrorBoundary', () => {
  const boundaryWith = (error: unknown) => {
    const boundary = new LazyErrorBoundary({ children: null });
    boundary.state = LazyErrorBoundary.getDerivedStateFromError(error);
    return boundary;
  };

  it('offers to try again when a part failed to download', () => {
    const html = renderToStaticMarkup(boundaryWith(new LazyLoadError(new Error('404'))).render() as never);
    expect(html).toContain('Não deu para carregar esta parte');
    expect(html).toContain('Tentar de novo');
    expect(html).toContain('role="alert"');
  });

  it('lets any other error go up to the app-wide screen', () => {
    expect(() => boundaryWith(new Error('Cannot read properties of undefined')).render()).toThrow('Cannot read');
  });

  it('shows the content while nothing failed', () => {
    const boundary = new LazyErrorBoundary({ children: createElement('p', null, 'ok') });
    expect(renderToStaticMarkup(boundary.render() as never)).toBe('<p>ok</p>');
  });
});

describe('LoadFailureNotice', () => {
  it('covers the screen over a modal and can close it', () => {
    const html = renderToStaticMarkup(createElement(LoadFailureNotice, { overlay: true, onRetry: () => undefined, onClose: () => undefined }));
    expect(html).toContain('fixed inset-0');
    expect(html).toContain('Fechar');
  });
});
