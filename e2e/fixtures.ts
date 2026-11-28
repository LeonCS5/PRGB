import { readFileSync } from 'node:fs';
import { test as base, expect, type Page } from '@playwright/test';

// The headers Vercel sends (vercel.json) do not exist in `vite preview`: they are added to the page here, so the
// CSP of production is the one under test.
interface HeaderRule { source: string; headers: Array<{ key: string; value: string }> }
const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf-8')) as { headers: HeaderRule[] };
const pageHeaders = Object.fromEntries(
  (vercel.headers.find((rule) => rule.source === '/(.*)')?.headers ?? []).map(({ key, value }) => [key.toLowerCase(), value])
);

export interface Diagnostics {
  consoleErrors: string[];
  cspViolations: string[];
  blockedRequests: string[];
}

const STORAGE_NOTICE_KEY = 'prgb:storage-notice:v1';

export const test = base.extend<{ diagnostics: Diagnostics }>({
  diagnostics: [async ({ page, baseURL }, use) => {
    const diagnostics: Diagnostics = { consoleErrors: [], cspViolations: [], blockedRequests: [] };
    const origin = new URL(baseURL ?? 'http://127.0.0.1').origin;

    page.on('console', (message) => {
      if (message.type() === 'error') diagnostics.consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => diagnostics.consoleErrors.push(`pageerror: ${error.message}`));

    // Nothing leaves the preview server (no Supabase, no CDN, no fonts from elsewhere)
    await page.route('**/*', async (route) => {
      const request = route.request();
      const url = request.url();
      if (!url.startsWith(origin) && !url.startsWith('data:') && !url.startsWith('blob:')) {
        diagnostics.blockedRequests.push(url);
        await route.abort();
        return;
      }
      if (request.resourceType() === 'document') {
        const response = await route.fetch();
        await route.fulfill({ response, headers: { ...response.headers(), ...pageHeaders } });
        return;
      }
      await route.continue();
    });

    await page.addInitScript((noticeKey) => {
      // The first-visit notice would cover buttons; it is not what these tests are about
      try { window.localStorage.setItem(noticeKey, 'seen'); } catch { /* storage blocked */ }
      const found: string[] = [];
      (window as unknown as { __csp: string[] }).__csp = found;
      document.addEventListener('securitypolicyviolation', (event) => {
        found.push(`${event.violatedDirective} ${event.blockedURI}`);
      });
    }, STORAGE_NOTICE_KEY);

    await use(diagnostics);
  }, { auto: true }],
});

// Reads the CSP violations the page recorded since it loaded
export const readCspViolations = (page: Page): Promise<string[]> =>
  page.evaluate(() => (window as unknown as { __csp?: string[] }).__csp ?? []);

export { expect };
