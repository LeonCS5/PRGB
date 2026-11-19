import { describe, expect, it } from 'vitest';
import { comboText } from './hudText';

describe('comboText', () => {
  it('shows the count alone while the multiplier is 1', () => {
    expect(comboText(0)).toBe('0');
    expect(comboText(4)).toBe('4');
  });

  it('separates the multiplier from the count so it does not read as a typo', () => {
    expect(comboText(30)).toMatch(/^30 · ×\d+$/);
  });
});
