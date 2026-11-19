import { describe, expect, it } from 'vitest';
import { formatElapsed } from './sessionFormat';

describe('formatElapsed', () => {
  it('writes minutes and zero-padded seconds, never negative', () => {
    expect(formatElapsed(0)).toBe('0:00');
    expect(formatElapsed(65_900)).toBe('1:05');
    expect(formatElapsed(-5000)).toBe('0:00');
  });
});
