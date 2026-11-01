import { afterEach, describe, expect, it, vi } from 'vitest';

type Listener = () => void;

interface Entry {
  state: unknown;
  url: URL;
}

// A session history that behaves like a browser's: a traversal lands later and only then fires popstate
const fakeWindow = (address = 'https://prgb.test/', state: unknown = null) => {
  const entries: Entry[] = [{ state, url: new URL(address) }];
  const listeners: Listener[] = [];
  let index = 0;
  const pushes = { count: 0 };
  const traverse = (delta: number) => {
    index += delta;
    listeners.forEach((listener) => listener());
  };
  const current = () => entries[index];
  const win = {
    addEventListener: (_type: string, listener: Listener) => listeners.push(listener),
    location: {
      get href() { return current().url.href; },
      get pathname() { return current().url.pathname; },
      get hash() { return current().url.hash; }
    },
    history: {
      get state() { return current().state; },
      pushState(next: unknown, _title: string, url: string) {
        entries.splice(index + 1);
        entries.push({ state: next, url: new URL(url, current().url) });
        index += 1;
        pushes.count += 1;
      },
      replaceState(next: unknown, _title: string, url: string) {
        entries[index] = { state: next, url: new URL(url, current().url) };
      },
      go(delta: number) {
        setTimeout(() => traverse(delta));
      }
    }
  };
  return { win, entries, pushes, position: () => index, back: () => traverse(-1) };
};

// Fresh module each time: the layers are kept at module level
const setup = async (address?: string, state?: unknown) => {
  const browser = fakeWindow(address, state);
  vi.stubGlobal('window', browser.win);
  vi.resetModules();
  return { ...browser, ...(await import('./historyLayers')) };
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 5));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('history layers', () => {
  it('gives a screen its own entry, and going back closes it', async () => {
    const { openScreenLayer, back, entries, position } = await setup();
    const closeScreen = vi.fn();
    openScreenLayer(closeScreen);
    await settle();
    expect(entries).toHaveLength(2);
    expect(position()).toBe(1);
    back();
    expect(closeScreen).toHaveBeenCalledTimes(1);
  });

  it('closes a modal over a screen first, and the screen only on the next press', async () => {
    const { openScreenLayer, openModalLayer, back, position } = await setup();
    const closeScreen = vi.fn();
    const closeModal = vi.fn();
    openScreenLayer(closeScreen);
    await settle();
    const dropModal = openModalLayer(closeModal);
    await settle();
    expect(position()).toBe(2);

    back();
    expect(closeModal).toHaveBeenCalledTimes(1);
    expect(closeScreen).not.toHaveBeenCalled();
    dropModal();
    await settle();
    expect(position()).toBe(1);

    back();
    expect(closeModal).toHaveBeenCalledTimes(1);
    expect(closeScreen).toHaveBeenCalledTimes(1);
  });

  it('keeps a modal on the landing from leaving the site', async () => {
    const { openModalLayer, back, position } = await setup();
    const closeModal = vi.fn();
    openModalLayer(closeModal);
    await settle();
    expect(position()).toBe(1);
    back();
    expect(closeModal).toHaveBeenCalledTimes(1);
    expect(position()).toBe(0);
  });

  it('closes one modal per press when they are stacked', async () => {
    const { openModalLayer, back } = await setup();
    const bottom = vi.fn();
    const top = vi.fn();
    openModalLayer(bottom);
    await settle();
    const dropTop = openModalLayer(top);
    await settle();
    back();
    expect(top).toHaveBeenCalledTimes(1);
    expect(bottom).not.toHaveBeenCalled();
    dropTop();
    await settle();
    back();
    expect(bottom).toHaveBeenCalledTimes(1);
  });

  it('never adds an entry in reaction to going back, which browsers may skip', async () => {
    const { openScreenLayer, openModalLayer, back, pushes } = await setup();
    openScreenLayer(vi.fn());
    await settle();
    const dropModal = openModalLayer(vi.fn());
    await settle();
    const pushed = pushes.count;
    back();
    dropModal();
    await settle();
    expect(pushes.count).toBe(pushed);
  });

  it('drops the entry of a layer closed by a button, closing nothing else', async () => {
    const { openScreenLayer, openModalLayer, position } = await setup();
    const closeScreen = vi.fn();
    const closeModal = vi.fn();
    openScreenLayer(closeScreen);
    await settle();
    const dropModal = openModalLayer(closeModal);
    await settle();
    dropModal();
    await settle();
    expect(position()).toBe(1);
    expect(closeScreen).not.toHaveBeenCalled();
    expect(closeModal).not.toHaveBeenCalled();
  });

  it('keeps the entry when one layer gives way to another in the same commit', async () => {
    const { openModalLayer, openScreenLayer, back, entries, position } = await setup();
    const dropSearch = openModalLayer(vi.fn());
    await settle();
    const closeGame = vi.fn();
    dropSearch();
    openScreenLayer(closeGame);
    await settle();
    expect(entries).toHaveLength(2);
    expect(position()).toBe(1);
    back();
    expect(closeGame).toHaveBeenCalledTimes(1);
  });

  it('survives a mount, unmount and mount in a row, as in StrictMode', async () => {
    const { openModalLayer, entries, position } = await setup();
    const drop = openModalLayer(vi.fn());
    drop();
    openModalLayer(vi.fn());
    await settle();
    expect(entries).toHaveLength(2);
    expect(position()).toBe(1);
  });

  it('leaves alone a layer opened while an entry is being dropped', async () => {
    const { openModalLayer, position } = await setup();
    const dropFirst = openModalLayer(vi.fn());
    await settle();
    dropFirst();
    await Promise.resolve();
    const closeSecond = vi.fn();
    openModalLayer(closeSecond);
    await settle();
    expect(closeSecond).not.toHaveBeenCalled();
    expect(position()).toBe(1);
  });

  it('drops both entries when two layers close together', async () => {
    const { openScreenLayer, openModalLayer, position } = await setup();
    const dropScreen = openScreenLayer(vi.fn());
    await settle();
    const dropModal = openModalLayer(vi.fn());
    await settle();
    dropModal();
    dropScreen();
    await settle();
    expect(position()).toBe(0);
  });

  it('moves ?demo to the screen entry, so the landing behind it stays clean', async () => {
    const { openScreenLayer, entries, position } = await setup('https://prgb.test/?demo#termos');
    openScreenLayer(vi.fn());
    await settle();
    expect(position()).toBe(1);
    expect(entries[0].url.href).toBe('https://prgb.test/#termos');
    expect(entries[1].url.href).toBe('https://prgb.test/?demo#termos');
  });

  it('keeps a challenge link on the landing while a modal opens over it', async () => {
    const { openModalLayer, entries } = await setup('https://prgb.test/?desafio=abc');
    openModalLayer(vi.fn());
    await settle();
    expect(entries[0].url.search).toBe('?desafio=abc');
  });

  it('reuses the entry left by a reload instead of stacking another', async () => {
    const { openScreenLayer, entries, position } = await setup('https://prgb.test/', { prgbLayers: 1 });
    openScreenLayer(vi.fn());
    await settle();
    expect(entries).toHaveLength(1);
    expect(position()).toBe(0);
  });

  it('does nothing when a modal refuses to close', async () => {
    const { openModalLayer, back, position } = await setup();
    const busy = vi.fn();
    openModalLayer(busy);
    await settle();
    back();
    await settle();
    expect(busy).toHaveBeenCalledTimes(1);
    expect(position()).toBe(0);
  });

  it('ignores going forward onto an entry whose layer is gone', async () => {
    const { openModalLayer, back, win, position } = await setup();
    const closeModal = vi.fn();
    const drop = openModalLayer(closeModal);
    await settle();
    back();
    drop();
    await settle();
    win.history.go(1);
    await settle();
    expect(position()).toBe(1);
    expect(closeModal).toHaveBeenCalledTimes(1);
  });
});
