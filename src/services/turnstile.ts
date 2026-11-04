// Cloudflare Turnstile, the CAPTCHA in front of the anonymous ranking account (Supabase Auth checks the token).
// Off unless VITE_TURNSTILE_SITE_KEY is set: then no script is downloaded and accounts are created as before.

export const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const LOAD_TIMEOUT_MS = 15_000;

export interface TurnstileRenderOptions {
  sitekey: string;
  callback: (token: string) => void;
  'expired-callback': () => void;
  // A truthy return tells Turnstile the error was handled; otherwise it also throws it
  'error-callback': (code: string) => boolean;
  language: string;
  theme: 'light' | 'dark' | 'auto';
}

export interface TurnstileApi {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string | undefined; // undefined: not rendered
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/** The public site key, or null when the CAPTCHA is off. */
export const getTurnstileSiteKey = (): string | null =>
  // By its full name, so the build inlines only this variable (see supabaseClient.ts)
  import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() || null;

export interface CaptchaGate {
  createsAccount: boolean; // false when re-accepting the terms or when a session is already stored
  siteKey: string | null;
  ageConfirmed: boolean;
  consent: boolean;
}

/**
 * Whether the widget, and with it Cloudflare's script, may be shown. Only after both boxes are ticked: the
 * consent is the legal basis for sending the player's data to Cloudflare (LGPD art. 33, VIII).
 */
export const canShowCaptcha = ({ createsAccount, siteKey, ageConfirmed, consent }: CaptchaGate): boolean =>
  createsAccount && siteKey !== null && ageConfirmed && consent;

let loading: Promise<TurnstileApi> | null = null;

/** Loads the Turnstile script once, on demand. A failed or timed-out load can be retried. */
export function loadTurnstile(timeoutMs = LOAD_TIMEOUT_MS): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    // Direct DOM on purpose: Cloudflare only ships the widget as a script tag, with no module to import
    const script = document.createElement('script');
    let settled = false;
    const finish = (error: Error | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (!error && window.turnstile) {
        resolve(window.turnstile);
        return;
      }
      script.remove();
      loading = null;
      reject(error ?? new Error('Turnstile script loaded without its API'));
    };
    const timer = setTimeout(() => finish(new Error('Turnstile script timed out')), timeoutMs);
    script.src = TURNSTILE_SCRIPT_URL;
    script.async = true;
    script.onload = () => finish(null);
    script.onerror = () => finish(new Error('Turnstile script failed to load'));
    document.head.appendChild(script);
  });
  return loading;
}

export interface CaptchaOptions {
  siteKey: string | null;
  onToken: (token: string) => void;
  onExpire: () => void; // the token is no longer valid; Turnstile fetches a new one by itself
  onError: (code: string) => void;
}

export interface CaptchaWidget {
  reset: () => void; // asks for a new token, e.g. after one was spent (tokens are single use)
  remove: () => void;
}

/** Renders the widget into `container`; null without a site key, in which case nothing is loaded. */
export async function renderCaptcha(container: HTMLElement, { siteKey, onToken, onExpire, onError }: CaptchaOptions): Promise<CaptchaWidget | null> {
  if (!siteKey) return null;
  const turnstile = await loadTurnstile();
  const widgetId = turnstile.render(container, {
    sitekey: siteKey,
    callback: onToken,
    'expired-callback': onExpire,
    'error-callback': (code) => {
      onError(code);
      return true;
    },
    language: 'pt-br',
    theme: 'dark'
  });
  if (widgetId === undefined) throw new Error('Turnstile did not render');
  return {
    reset: () => turnstile.reset(widgetId),
    remove: () => turnstile.remove(widgetId)
  };
}
