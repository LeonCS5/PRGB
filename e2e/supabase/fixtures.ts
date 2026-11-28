import { readFileSync } from 'node:fs';
import { test as base, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { assertLocalUrl, readStack } from './localStack';

// Same idea as e2e/fixtures.ts (the CSP of production on the page, every request outside the preview aborted), with
// one difference: the app of this folder was built against the LOCAL Supabase, so the CSP names the local API where
// vercel.json names the hosted project, and the local API is the only other place a request may go.
interface HeaderRule { source: string; headers: Array<{ key: string; value: string }> }
const vercel = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf-8')) as { headers: HeaderRule[] };
const productionCsp = vercel.headers
  .find((rule) => rule.source === '/(.*)')
  ?.headers.find(({ key }) => key.toLowerCase() === 'content-security-policy')?.value ?? '';

export const localCsp = (apiOrigin: string): string => {
  const wsOrigin = apiOrigin.replace(/^http/, 'ws');
  const csp = productionCsp
    .replace(/https:\/\/[a-z0-9]+\.supabase\.co/g, apiOrigin)
    .replace(/wss:\/\/[a-z0-9]+\.supabase\.co/g, wsOrigin);
  if (!csp.includes(apiOrigin) || !csp.includes(wsOrigin)) throw new Error('vercel.json CSP no longer names the Supabase host: update e2e/supabase/fixtures.ts');
  if (csp.includes('supabase.co')) throw new Error('The CSP of the local run still allows a hosted Supabase');
  return csp;
};

export interface Diagnostics {
  consoleErrors: string[];
  cspViolations: string[];
  blockedRequests: string[];
}

const STORAGE_NOTICE_KEY = 'prgb:storage-notice:v1';

// Installs the request guard, the CSP and the diagnostics on a page; returns what it collects
export const preparePage = async (page: Page, baseURL: string): Promise<Diagnostics> => {
  const stack = readStack();
  const apiOrigin = assertLocalUrl(stack.apiUrl, 'API_URL of the local stack').origin;
  const origin = new URL(baseURL).origin;
  const csp = localCsp(apiOrigin);
  const diagnostics: Diagnostics = { consoleErrors: [], cspViolations: [], blockedRequests: [] };

  page.on('console', (message) => {
    if (message.type() === 'error') diagnostics.consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => diagnostics.consoleErrors.push(`pageerror: ${error.message}`));

  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = request.url();
    const isLocal = url.startsWith(origin) || url.startsWith(apiOrigin) || url.startsWith('data:') || url.startsWith('blob:');
    if (!isLocal) {
      diagnostics.blockedRequests.push(url);
      await route.abort();
      return;
    }
    if (request.resourceType() === 'document' && url.startsWith(origin)) {
      const response = await route.fetch();
      await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': csp } });
      return;
    }
    await route.continue();
  });

  await page.addInitScript((noticeKey) => {
    try { window.localStorage.setItem(noticeKey, 'seen'); } catch { /* storage blocked */ }
    const found: string[] = [];
    (window as unknown as { __csp: string[] }).__csp = found;
    document.addEventListener('securitypolicyviolation', (event) => {
      found.push(`${event.violatedDirective} ${event.blockedURI}`);
    });
  }, STORAGE_NOTICE_KEY);

  return diagnostics;
};

export const readCspViolations = (page: Page): Promise<string[]> =>
  page.evaluate(() => (window as unknown as { __csp?: string[] }).__csp ?? []);

// A second (third...) player: its own browser context, so its own anonymous account and storage
export interface Player { context: BrowserContext; page: Page; diagnostics: Diagnostics }
export const newPlayer = async (browser: Browser, baseURL: string): Promise<Player> => {
  const context = await browser.newContext({
    baseURL,
    serviceWorkers: 'block',
    permissions: ['microphone', 'local-network-access'],
    locale: 'pt-BR',
    viewport: { width: 1366, height: 768 }
  });
  const page = await context.newPage();
  const diagnostics = await preparePage(page, baseURL);
  return { context, page, diagnostics };
};

export const test = base.extend<{ diagnostics: Diagnostics }>({
  diagnostics: [async ({ page, baseURL }, use) => {
    await use(await preparePage(page, baseURL ?? 'http://127.0.0.1'));
  }, { auto: true }],
});

export { expect };
