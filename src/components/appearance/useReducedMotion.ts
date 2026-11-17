import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

const subscribe = (listener: () => void): (() => void) => {
  try {
    const query = matchMedia(QUERY);
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
  } catch {
    return () => {};
  }
};

const read = (): boolean => {
  try {
    return typeof matchMedia === 'function' && matchMedia(QUERY).matches;
  } catch {
    return false;
  }
};

/** The system's reduced-motion preference, live, for the notices of the appearance screen. */
export const useReducedMotion = (): boolean => useSyncExternalStore(subscribe, read, () => false);
