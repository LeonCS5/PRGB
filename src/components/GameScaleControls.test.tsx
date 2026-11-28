import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SPEED_OPTIONS } from '../context/sessionSettings';
import { GameScaleControls, ScaleToast } from './GameScaleControls';
import { formatScale } from './gameScaleKit';

const noop = () => {};
const render = (props: Partial<Parameters<typeof GameScaleControls>[0]> = {}) =>
  renderToStaticMarkup(<GameScaleControls speed={1} zoom={1.25} speedLocked={false} onSpeedChange={noop} onZoomChange={noop} {...props} />);

describe('GameScaleControls', () => {
  it('shows a visible label and the current value of both controls', () => {
    const html = render();
    expect(html).toContain('>Velocidade<');
    expect(html).toContain('>Espaçamento<');
    expect(html).toContain(formatScale(1.25));
    expect(html).toContain('value="1.25" selected');
  });

  it('fills the level bar up to the chosen option', () => {
    const html = render({ speed: SPEED_OPTIONS[0] });
    expect(html.match(/bg-amp-400/g)).toHaveLength(1 + 4); // 1 speed segment + zoom 1.25 is the 4th of 5 (Auto is the first)
  });

  it('locks the speed with the reason, leaving the zoom free', () => {
    const html = render({ speedLocked: true, lockedHint: 'Partidas ranqueadas valem só em 1× e sem saltos.', lockedHelpId: 'ajuda' });
    expect(html).toContain('title="Partidas ranqueadas valem só em 1× e sem saltos."');
    expect(html).toContain('aria-describedby="ajuda"');
    expect(html.match(/disabled=""/g)).toHaveLength(1); // only the speed select
  });
});

describe('ScaleToast', () => {
  it('is an empty polite live region when idle, and shows the text after a change', () => {
    expect(renderToStaticMarkup(<ScaleToast toast={null} onDone={noop} />)).toContain('aria-live="polite"');
    expect(renderToStaticMarkup(<ScaleToast toast={null} onDone={noop} />)).not.toContain('<span');
    expect(renderToStaticMarkup(<ScaleToast toast={{ id: 1, text: 'Espaçamento 1,25×' }} onDone={noop} />)).toContain('Espaçamento 1,25×');
  });
});
