import { createElement, lazy, type FC } from 'react';

// React.lazy keeps a rejected import forever, so a chunk that failed once (a deploy removed it, the network dropped)
// would fail again on every retry. Each lazy screen here can be rebuilt after a failure to import it afresh.

export class LazyLoadError extends Error {
  constructor(cause: unknown) {
    super('Falha ao carregar um trecho do PRGB.', { cause });
    this.name = 'LazyLoadError';
  }
}

const CHUNK_ERROR = /dynamically imported module|importing a module script failed|unable to preload|failed to fetch/i;

export const isLoadFailure = (error: unknown): boolean =>
  error instanceof LazyLoadError || (error instanceof Error && CHUNK_ERROR.test(error.message));

interface Slot {
  failed: boolean;
  reset: () => void;
}

const slots = new Set<Slot>();

export const hasFailedLazyLoad = (): boolean => [...slots].some((slot) => slot.failed);

// Rebuilds every lazy screen whose import failed, so the next render imports it again
export const resetFailedLazyLoads = (): void => {
  slots.forEach((slot) => slot.reset());
};

// `pick` chooses the component out of the imported module (they are named exports)
export function lazyWithRetry<M, P extends object>(load: () => Promise<M>, pick: (module: M) => FC<P>): FC<P> {
  const build = () => lazy(() => load().then((module) => ({ default: pick(module) }), (error: unknown) => {
    slot.failed = true;
    throw new LazyLoadError(error);
  }));
  let Inner = build();
  const slot: Slot = {
    failed: false,
    reset: () => {
      if (!slot.failed) return;
      slot.failed = false;
      Inner = build();
    }
  };
  slots.add(slot);
  // Reads `Inner` on every render, so a rebuilt one takes over after the reset
  return (props) => createElement(Inner as FC<P>, props);
}

// A new deploy deletes the old chunks: a stale tab fails to import them. One reload fetches the new page; the mark
// keeps a chunk that is really missing from reloading in a loop.
const RELOAD_KEY = 'prgb:preload-reload:v1';
const RELOAD_GAP_MS = 30_000;

export const shouldReloadOnPreloadError = (now: number, stored: string | null): boolean => {
  const last = Number(stored);
  return !Number.isFinite(last) || last <= 0 || now - last > RELOAD_GAP_MS;
};

export const installPreloadErrorReload = (): void => {
  window.addEventListener('vite:preloadError', (event) => {
    let stored: string | null = null;
    try {
      stored = sessionStorage.getItem(RELOAD_KEY);
    } catch {
      // Blocked storage: without the mark a reload could repeat, so leave the error to the screen
      return;
    }
    const now = Date.now();
    if (!shouldReloadOnPreloadError(now, stored)) return;
    try {
      sessionStorage.setItem(RELOAD_KEY, String(now));
    } catch {
      return;
    }
    event.preventDefault();
    window.location.reload();
  });
};
