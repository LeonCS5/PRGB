import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TurnstileApi, TurnstileRenderOptions } from './turnstile';

interface FakeScript {
  src: string;
  async: boolean;
  onload: (() => void) | null;
  onerror: (() => void) | null;
  remove: () => void;
}

// No DOM in these tests: just enough of window and document for the script tag
let scripts: FakeScript[];
let fakeWindow: { turnstile?: TurnstileApi };

const fakeTurnstile = (): TurnstileApi & { options: TurnstileRenderOptions[] } => {
  const options: TurnstileRenderOptions[] = [];
  return {
    options,
    render: vi.fn((_container: HTMLElement, rendered: TurnstileRenderOptions) => {
      options.push(rendered);
      return `widget-${options.length}`;
    }),
    reset: vi.fn(),
    remove: vi.fn()
  };
};

// Fresh module each time: the loading promise is cached at module level
const load = async () => {
  vi.resetModules();
  return import('./turnstile');
};

const container = {} as HTMLElement;
const handlers = { onToken: vi.fn(), onExpire: vi.fn(), onError: vi.fn() };

beforeEach(() => {
  scripts = [];
  fakeWindow = {};
  vi.stubGlobal('window', fakeWindow);
  vi.stubGlobal('document', {
    createElement: vi.fn(() => {
      const script: FakeScript = { src: '', async: false, onload: null, onerror: null, remove: vi.fn() };
      return script;
    }),
    head: { appendChild: vi.fn((script: FakeScript) => scripts.push(script)) }
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('getTurnstileSiteKey', () => {
  it('is null when the variable is missing or blank, and trimmed otherwise', async () => {
    const { getTurnstileSiteKey } = await load();
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '');
    expect(getTurnstileSiteKey()).toBeNull();
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '   ');
    expect(getTurnstileSiteKey()).toBeNull();
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', ' site-key ');
    expect(getTurnstileSiteKey()).toBe('site-key');
  });
});

describe('canShowCaptcha', () => {
  const gate = { createsAccount: true, siteKey: 'site-key', ageConfirmed: true, consent: true };

  it('waits for both boxes: the consent covers sending data to Cloudflare', async () => {
    const { canShowCaptcha } = await load();
    expect(canShowCaptcha(gate)).toBe(true);
    expect(canShowCaptcha({ ...gate, ageConfirmed: false })).toBe(false);
    expect(canShowCaptcha({ ...gate, consent: false })).toBe(false);
    expect(canShowCaptcha({ ...gate, ageConfirmed: false, consent: false })).toBe(false);
  });

  it('never shows without a site key or when no account is created (re-accepting the terms)', async () => {
    const { canShowCaptcha } = await load();
    expect(canShowCaptcha({ ...gate, siteKey: null })).toBe(false);
    expect(canShowCaptcha({ ...gate, createsAccount: false })).toBe(false);
  });
});

describe('renderCaptcha', () => {
  it('loads nothing without a site key', async () => {
    const { renderCaptcha } = await load();
    expect(await renderCaptcha(container, { siteKey: null, ...handlers })).toBeNull();
    expect(await renderCaptcha(container, { siteKey: '', ...handlers })).toBeNull();
    expect(document.createElement).not.toHaveBeenCalled();
    expect(scripts).toEqual([]);
  });

  it('loads the script once and renders in pt-BR, dark', async () => {
    const { renderCaptcha, TURNSTILE_SCRIPT_URL } = await load();
    const first = renderCaptcha(container, { siteKey: 'site-key', ...handlers });
    const second = renderCaptcha(container, { siteKey: 'site-key', ...handlers });
    expect(scripts).toHaveLength(1);
    expect(scripts[0]).toMatchObject({ src: TURNSTILE_SCRIPT_URL, async: true });

    const turnstile = fakeTurnstile();
    fakeWindow.turnstile = turnstile;
    scripts[0].onload?.();
    const [widget] = await Promise.all([first, second]);
    expect(turnstile.render).toHaveBeenCalledTimes(2);
    expect(turnstile.options[0]).toMatchObject({ sitekey: 'site-key', language: 'pt-br', theme: 'dark' });

    // Already loaded: no new script
    await renderCaptcha(container, { siteKey: 'site-key', ...handlers });
    expect(scripts).toHaveLength(1);

    widget?.reset();
    widget?.remove();
    expect(turnstile.reset).toHaveBeenCalledWith('widget-1');
    expect(turnstile.remove).toHaveBeenCalledWith('widget-1');
  });

  it('passes the token, expiry and errors on, marking errors as handled', async () => {
    const { renderCaptcha } = await load();
    const turnstile = fakeTurnstile();
    fakeWindow.turnstile = turnstile;
    await renderCaptcha(container, { siteKey: 'site-key', ...handlers });
    const [options] = turnstile.options;
    options.callback('token-1');
    options['expired-callback']();
    expect(options['error-callback']('300010')).toBe(true);
    expect(handlers.onToken).toHaveBeenCalledWith('token-1');
    expect(handlers.onExpire).toHaveBeenCalledTimes(1);
    expect(handlers.onError).toHaveBeenCalledWith('300010');
  });

  it('rejects when the script fails to load, and loads it again on the next try', async () => {
    const { renderCaptcha } = await load();
    const failed = renderCaptcha(container, { siteKey: 'site-key', ...handlers });
    scripts[0].onerror?.();
    await expect(failed).rejects.toThrow('failed to load');
    expect(scripts[0].remove).toHaveBeenCalled();

    const retried = renderCaptcha(container, { siteKey: 'site-key', ...handlers });
    expect(scripts).toHaveLength(2);
    fakeWindow.turnstile = fakeTurnstile();
    scripts[1].onload?.();
    expect(await retried).not.toBeNull();
  });

  it('gives up when the script never answers', async () => {
    vi.useFakeTimers();
    const { loadTurnstile } = await load();
    const pending = loadTurnstile(1000);
    const assertion = expect(pending).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
    expect(scripts[0].remove).toHaveBeenCalled();
  });

  it('rejects when the script loads without its API', async () => {
    const { loadTurnstile } = await load();
    const pending = loadTurnstile();
    scripts[0].onload?.();
    await expect(pending).rejects.toThrow('without its API');
  });
});
