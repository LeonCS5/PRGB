import { describe, expect, it } from 'vitest';
import bootFile from '../../public/appearance-boot.js?raw';
import { applyDomPlan, buildDomPlan } from './apply';
import { buildBootScript } from './bootScript';
import { getPreset } from './presets';
import { THEME_IDS } from './types';
import { APPEARANCE_STORAGE_KEY, serializeAppearance, validateAppearance } from './validate';
import { fakeRoot, memoryStorage } from './testHelpers';

const normalize = (text: string): string => text.replace(/\r\n/g, '\n');

// Runs the classic script the way the browser does: with a storage, a root element and matchMedia in scope
const runBoot = (stored: string | null, reducedMotion = false, throwingStorage = false) => {
  const root = fakeRoot();
  const storage = memoryStorage(stored === null ? {} : { [APPEARANCE_STORAGE_KEY]: stored });
  const localStorage = throwingStorage ? { getItem: () => { throw new Error('blocked'); } } : storage;
  const matchMedia = () => ({ matches: reducedMotion });
  new Function('localStorage', 'document', 'matchMedia', bootFile)(localStorage, { documentElement: root }, matchMedia);
  return root;
};

describe('appearance-boot.js', () => {
  it('is up to date with themes.ts (run npm run gen:appearance-boot when this fails)', () => {
    expect(normalize(bootFile)).toBe(normalize(buildBootScript()));
  });

  it('paints exactly what the app paints, for every theme', () => {
    for (const id of THEME_IDS) {
      const settings = getPreset(id);
      const expected = fakeRoot();
      applyDomPlan(expected, buildDomPlan(settings, false));
      const painted = runBoot(serializeAppearance(settings));
      expect(painted.attributes).toEqual(expected.attributes);
      expect(painted.variables).toEqual(expected.variables);
    }
  });

  it('turns effects off for reduceEffects and for reduced motion', () => {
    const settings = { ...getPreset('refined'), reduceEffects: true };
    expect(runBoot(serializeAppearance(settings)).attributes.get('data-effects')).toBe('off');
    expect(runBoot(serializeAppearance(getPreset('refined')), true).attributes.get('data-effects')).toBe('off');
    expect(runBoot(serializeAppearance(getPreset('refined'))).attributes.has('data-effects')).toBe(false);
  });

  it('does nothing, and never throws, for missing, corrupt, newer or blocked storage', () => {
    for (const stored of [null, '{', 'null', '[]', '{"version":2,"settings":{"themeId":"refined"}}', '{"version":1}']) {
      const root = runBoot(stored);
      expect(root.attributes.size).toBe(0);
      expect(root.variables.size).toBe(0);
    }
    expect(runBoot(null, false, true).attributes.size).toBe(0);
  });

  it('applies only the valid fields of a half-broken value', () => {
    const root = runBoot(JSON.stringify({
      version: 1, settings: { themeId: 'nope', uiStyle: 'sharp', font: 7, background: 'grid', reduceEffects: 'yes' }
    }));
    expect(root.variables.size).toBe(0);
    expect(root.attributes.get('data-ui')).toBe('sharp');
    expect(root.attributes.get('data-bg')).toBe('grid');
    expect(root.attributes.has('data-font')).toBe(false);
    expect(root.attributes.has('data-theme')).toBe(false);
    expect(root.attributes.has('data-effects')).toBe(false);
    expect(validateAppearance({ themeId: 'nope' }).themeId).toBe('original');
  });
});
