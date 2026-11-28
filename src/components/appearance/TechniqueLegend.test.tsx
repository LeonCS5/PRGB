import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TechniqueLegend } from './TechniqueLegend';
import { COMPACT_KEY_SYMBOLS, TECHNIQUE_KEY } from './techniqueKey';

describe('the technique key', () => {
  it('keeps the label and the description of each symbol apart, both filled in', () => {
    for (const item of TECHNIQUE_KEY) {
      expect(item.short.length).toBeGreaterThan(2);
      expect(item.description.length).toBeGreaterThan(10);
      expect(item.description).not.toContain(': '); // nothing left to split
    }
  });

  it('has every compact symbol in the table', () => {
    for (const symbol of COMPACT_KEY_SYMBOLS) expect(TECHNIQUE_KEY.some((item) => item.symbol === symbol)).toBe(true);
  });

  it('lists every technique with its description', () => {
    const html = renderToStaticMarkup(<TechniqueLegend />);
    for (const item of TECHNIQUE_KEY) {
      expect(html).toContain(item.short[0].toUpperCase() + item.short.slice(1) + ':');
      expect(html).toContain(item.description);
    }
  });

  it('shows only the short labels in the one-line key', () => {
    const html = renderToStaticMarkup(<TechniqueLegend compact />);
    for (const symbol of COMPACT_KEY_SYMBOLS) expect(html).toContain(TECHNIQUE_KEY.find((item) => item.symbol === symbol)!.short);
    expect(html).not.toContain(TECHNIQUE_KEY[0].description);
  });
});
