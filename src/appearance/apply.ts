import { THEME_TOKEN_NAMES, deriveTokens, findTheme } from './themes';
import type { AppearanceSettings } from './types';

// What lands on <html>. null removes the attribute. Pure, so the boot script and the tests can check it.
export interface DomPlan {
  attributes: Record<'data-theme' | 'data-ui' | 'data-font' | 'data-bg' | 'data-effects', string | null>;
  variables: Record<string, string>;
}

export const buildDomPlan = (settings: AppearanceSettings, reducedMotion: boolean): DomPlan => {
  const theme = findTheme(settings.themeId);
  return {
    attributes: {
      'data-theme': theme.colors ? theme.id : null,
      'data-ui': settings.uiStyle,
      'data-font': settings.font,
      'data-bg': settings.background,
      'data-effects': settings.reduceEffects || reducedMotion ? 'off' : null
    },
    // Original writes no variable at all: the index.css defaults are that theme
    variables: theme.colors ? deriveTokens(theme.colors) : {}
  };
};

// The part of an element the plan needs, so tests can use a fake
export interface AppearanceRoot {
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  style: { setProperty(name: string, value: string): void; removeProperty(name: string): string };
}

/** Idempotent: applying the same plan twice changes nothing, and a plan clears what the previous theme left. */
export const applyDomPlan = (root: AppearanceRoot, plan: DomPlan): void => {
  for (const [name, value] of Object.entries(plan.attributes)) {
    if (value === null) root.removeAttribute(name);
    else root.setAttribute(name, value);
  }
  for (const name of THEME_TOKEN_NAMES) {
    if (!(name in plan.variables)) root.style.removeProperty(name);
  }
  for (const [name, value] of Object.entries(plan.variables)) root.style.setProperty(name, value);
};

export const prefersReducedMotion = (): boolean => {
  try {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

export const applyAppearanceToDocument = (settings: AppearanceSettings): void => {
  if (typeof document === 'undefined') return;
  applyDomPlan(document.documentElement, buildDomPlan(settings, prefersReducedMotion()));
};
