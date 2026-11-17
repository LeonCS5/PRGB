import { describe, expect, it } from 'vitest';
import { applyDomPlan, buildDomPlan } from './apply';
import { getPreset } from './presets';
import { THEME_TOKEN_NAMES, THEMES, deriveTokens } from './themes';
import { fakeRoot } from './testHelpers';

describe('buildDomPlan', () => {
  it('Original with the defaults writes no theme and no variable', () => {
    const plan = buildDomPlan(getPreset('original'), false);
    expect(plan.variables).toEqual({});
    expect(plan.attributes['data-theme']).toBeNull();
    expect(plan.attributes['data-effects']).toBeNull();
    expect(plan.attributes).toMatchObject({ 'data-ui': 'soft', 'data-font': 'expressive', 'data-bg': 'solid' });
  });

  it('a theme writes its derived tokens and its id', () => {
    const plan = buildDomPlan(getPreset('electric-neon'), false);
    expect(plan.attributes['data-theme']).toBe('electric-neon');
    expect(plan.variables).toEqual(deriveTokens(THEMES.find((theme) => theme.id === 'electric-neon')!.colors!));
    expect(plan.attributes).toMatchObject({ 'data-ui': 'sharp', 'data-font': 'technical', 'data-bg': 'grid' });
  });

  it('turns decorative effects off for reduceEffects or reduced motion, only', () => {
    expect(buildDomPlan({ ...getPreset('refined'), reduceEffects: true }, false).attributes['data-effects']).toBe('off');
    expect(buildDomPlan(getPreset('refined'), true).attributes['data-effects']).toBe('off');
    expect(buildDomPlan(getPreset('refined'), false).attributes['data-effects']).toBeNull();
  });

  it('never writes a gameplay token', () => {
    for (const id of ['refined', 'midnight-arcade', 'graphite-studio', 'analog-soul', 'electric-neon'] as const) {
      for (const name of Object.keys(buildDomPlan(getPreset(id), false).variables)) {
        expect(name).not.toMatch(/string|player|play-signal|hit|near|miss|note/);
      }
    }
  });
});

describe('applyDomPlan', () => {
  it('is idempotent and clears the previous theme when going back to Original', () => {
    const root = fakeRoot();
    applyDomPlan(root, buildDomPlan(getPreset('refined'), false));
    const attributes = new Map(root.attributes);
    const variables = new Map(root.variables);
    applyDomPlan(root, buildDomPlan(getPreset('refined'), false));
    expect(root.attributes).toEqual(attributes);
    expect(root.variables).toEqual(variables);
    expect(root.variables.size).toBe(THEME_TOKEN_NAMES.length);

    applyDomPlan(root, buildDomPlan(getPreset('original'), false));
    expect(root.variables.size).toBe(0);
    expect(root.attributes.has('data-theme')).toBe(false);
  });
});
