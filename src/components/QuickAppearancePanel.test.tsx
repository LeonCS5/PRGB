import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { QuickAppearancePanel } from './QuickAppearancePanel';

// The real frame opens a <dialog> in an effect; only the content matters here
vi.mock('./ModalFrame', () => ({ ModalFrame: ({ children, titleId }: { children: unknown; titleId: string }) => <div role="dialog" aria-labelledby={titleId}>{children as never}</div> }));

const noop = () => {};
const render = (paused = true) => renderToStaticMarkup(<QuickAppearancePanel onClose={noop} onOpenAll={noop} zoom={1.25} onZoomChange={noop} paused={paused} />);

describe('QuickAppearancePanel', () => {
  it('offers the choices people change most, and a way to the full screen', () => {
    const html = render();
    for (const text of ['Aparência rápida', 'Tema', 'Sombra-guia', 'Estilo da nota', 'Cores das cordas', 'Espaçamento das notas', 'Tamanho das notas', 'Mostrar as técnicas', 'Sons de acerto e erro', 'Efeitos visuais', 'Todas as opções', 'Continuar tocando']) {
      expect(html).toContain(text);
    }
  });

  it('says the song waits and for how long, or that a duo online does not wait', () => {
    expect(render(true)).toContain('A música está pausada. Ao fechar, volta em 3 s.');
    expect(render(false)).toContain('Na dupla online a música não para');
  });

  it('shows the current zoom and keeps the switches inside positioned labels', () => {
    const html = render();
    expect(html).toContain('value="1.25" selected');
    for (const match of html.matchAll(/<label\b([^>]*)>(?:(?!<\/label>)[\s\S])*?<input\b[^>]*\bsr-only\b[^>]*>/g)) expect(match[1]).toMatch(/\brelative\b/);
  });
});
