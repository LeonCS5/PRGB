import { describe, expect, it } from 'vitest';
import { nextResumeStep, RESUME_OPACITY_MAX, RESUME_OPACITY_MIN, RESUME_SECONDS, resumeOpacity } from './resumeCountdown';

describe('resume count', () => {
  it('counts 3, 2, 1 and then plays', () => {
    const seen: Array<number | null> = [];
    for (let left: number | null = RESUME_SECONDS; left !== null; left = nextResumeStep(left)) seen.push(left);
    expect(seen).toEqual([3, 2, 1]);
    expect(nextResumeStep(1)).toBeNull();
  });

  it('is a short count: 3 seconds, as promised in the panel', () => {
    expect(RESUME_SECONDS).toBe(3);
  });

  it('fades as the count runs out, and never goes opaque', () => {
    expect(resumeOpacity(3)).toBeCloseTo(RESUME_OPACITY_MAX);
    expect(resumeOpacity(2)).toBeLessThan(resumeOpacity(3));
    expect(resumeOpacity(1)).toBeLessThan(resumeOpacity(2));
    expect(resumeOpacity(1)).toBeGreaterThan(RESUME_OPACITY_MIN);
    expect(resumeOpacity(99)).toBeLessThanOrEqual(RESUME_OPACITY_MAX);
    expect(resumeOpacity(-1)).toBeCloseTo(RESUME_OPACITY_MIN);
  });
});
