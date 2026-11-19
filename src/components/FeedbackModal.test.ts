import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FeedbackModal } from './FeedbackModal';

const render = (): string => renderToStaticMarkup(createElement(FeedbackModal, { isOpen: true, onClose: () => undefined, screen: 'inicio' }));

describe('FeedbackModal', () => {
  it('starts with no category chosen, so the player picks one on purpose', () => {
    const html = render();
    expect(html).toContain('<option value="" disabled="" selected="">Escolha…</option>');
    expect(html).not.toMatch(/<option value="audio" selected/);
    expect(html).toMatch(/<button type="submit" disabled=""/);
  });

  it('closes with a 44 px target and writes the sending state with a real ellipsis', () => {
    const html = render();
    expect(html).toContain('min-h-11 min-w-11');
    expect(html).not.toContain('Enviando...');
  });
});
