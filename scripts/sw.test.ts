import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

// Runs public/sw.js in a vm with fake Cache Storage, fetch and events, the way the browser would, to pin the
// rules that keep the offline shell consistent (ENG-01, ENG-06).
const template = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
const ORIGIN = 'https://prgb.test';

interface FakeResponse { ok: boolean; type: string; tag: string; clone(): FakeResponse; headers: { get(): string }; }
const response = (tag: string, ok = true): FakeResponse => ({
  ok, type: 'basic', tag, headers: { get: () => 'text/html' }, clone() { return this; },
});

const load = (fetchImpl: (request: unknown) => Promise<FakeResponse>) => {
  const stores = new Map<string, Map<string, FakeResponse>>();
  const open = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name)!;
    return Promise.resolve({
      addAll: async (urls: string[]) => { for (const url of urls) store.set(url, response(`cached ${url}`)); },
      put: vi.fn(async (url: string, value: FakeResponse) => { store.set(url, value); }),
      match: async (url: string) => store.get(url),
    });
  };
  const listeners: Record<string, (event: unknown) => void> = {};
  const source = template.replace('__BUILD_VERSION__', 'v1').replace('__SHELL_FILES__', '["index.html","assets/app.js"]');
  vm.runInNewContext(source, {
    self: {
      registration: { scope: `${ORIGIN}/` },
      location: { origin: ORIGIN },
      addEventListener: (type: string, listener: (event: unknown) => void) => { listeners[type] = listener; },
      clients: { claim: async () => {} },
    },
    caches: { open, keys: async () => [...stores.keys()], delete: async () => true },
    fetch: fetchImpl, URL, Promise, setTimeout, clearTimeout, Error,
  });
  const install = () => new Promise<void>((resolve) => listeners.install({ waitUntil: (promise: Promise<void>) => resolve(promise) }));
  const navigate = (url = `${ORIGIN}/`) => new Promise<Promise<FakeResponse>>((resolve) => {
    listeners.fetch({ request: { method: 'GET', url, mode: 'navigate' }, respondWith: resolve });
  }).then((promise) => promise);
  return { stores, install, navigate };
};

describe('sw.js navigation', () => {
  it('never rewrites the cached index with what the network returns', async () => {
    const sw = load(async () => response('network index (newer build)'));
    await sw.install();
    const served = await sw.navigate();
    expect(served.tag).toBe('network index (newer build)');
    expect(sw.stores.get('prgb-shell-v1')!.get(`${ORIGIN}/index.html`)!.tag).toBe(`cached ${ORIGIN}/index.html`);
  });

  it('serves the cached index when offline', async () => {
    const sw = load(async () => { throw new TypeError('offline'); });
    await sw.install();
    expect((await sw.navigate()).tag).toBe(`cached ${ORIGIN}/index.html`);
  });

  it('serves the cached index when the server answers with an error', async () => {
    const sw = load(async () => response('boom', false));
    await sw.install();
    expect((await sw.navigate()).tag).toBe(`cached ${ORIGIN}/index.html`);
  });

  it('falls back to the cached index when the network is too slow', async () => {
    vi.useFakeTimers();
    try {
      const sw = load(() => new Promise<FakeResponse>(() => {}));
      await sw.install();
      const pending = sw.navigate();
      await vi.advanceTimersByTimeAsync(4000);
      expect((await pending).tag).toBe(`cached ${ORIGIN}/index.html`);
    } finally {
      vi.useRealTimers();
    }
  });
});
