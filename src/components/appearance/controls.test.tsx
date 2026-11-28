import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_APPEARANCE } from '../../appearance/defaults';
import { ORIGINAL_PALETTE } from '../testCanvas';
import { AppearanceScreen } from '../AppearanceScreen';
import { GuideSection } from './GuideSection';
import { SwitchField } from './controls';

vi.mock('../../appearance/useGamePalette', () => ({ useGamePalette: () => ORIGINAL_PALETTE }));

const noop = () => {};

// An input hidden with sr-only is absolutely positioned. If no ancestor is positioned it sits at its document
// coordinates, far below the viewport, and focusing it (a click on the switch) scrolls the whole app out of view.
const srOnlyInputsWithoutPositionedLabel = (html: string): string[] => {
  const bad: string[] = [];
  for (const match of html.matchAll(/<label\b([^>]*)>(?:(?!<\/label>)[\s\S])*?<input\b[^>]*\bsr-only\b[^>]*>/g)) {
    if (!/\brelative\b/.test(match[1])) bad.push(match[0].slice(0, 120));
  }
  return bad;
};

describe('hidden inputs of the appearance controls', () => {
  it('keeps the switch input inside a positioned label', () => {
    const html = renderToStaticMarkup(createElement(SwitchField, { id: 's', label: 'L', hint: 'h', checked: false, onChange: noop }));
    expect(html).toContain('sr-only');
    expect(srOnlyInputsWithoutPositionedLabel(html)).toEqual([]);
  });

  it('has no sr-only input outside a positioned label in the shadow section', () => {
    const html = renderToStaticMarkup(createElement(GuideSection, { settings: DEFAULT_APPEARANCE, onChange: noop }));
    expect(html.match(/sr-only/g)?.length).toBeGreaterThan(5);
    expect(srOnlyInputsWithoutPositionedLabel(html)).toEqual([]);
  });

  it('makes the scrolling container the positioned ancestor of whatever it holds', () => {
    const html = renderToStaticMarkup(createElement(AppearanceScreen, { onExit: noop }));
    expect(html).toMatch(/<main class="[^"]*\brelative\b[^"]*overflow-y-auto/);
  });
});
