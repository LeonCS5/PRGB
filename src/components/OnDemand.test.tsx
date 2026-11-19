import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LazyScreen, OnDemand } from './OnDemand';

describe('OnDemand', () => {
  it('mounts nothing until it is asked for', () => {
    expect(renderToStaticMarkup(<OnDemand open={false} label="o painel"><p>dentro</p></OnDemand>)).toBe('');
  });

  it('mounts the children once open', () => {
    expect(renderToStaticMarkup(<OnDemand open label="o painel"><p>dentro</p></OnDemand>)).toBe('<p>dentro</p>');
  });
});

describe('LazyScreen', () => {
  it('renders its children', () => {
    expect(renderToStaticMarkup(<LazyScreen label="o jogo"><p>tela</p></LazyScreen>)).toBe('<p>tela</p>');
  });
});
