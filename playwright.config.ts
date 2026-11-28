import { defineConfig } from '@playwright/test';

// E2E: runs the production build (vite preview) in a real browser with a fake microphone. No Supabase and no
// network outside the preview server: the fixtures in e2e/fixtures.ts abort every other request.
//
// Browser: locally it uses the Microsoft Edge that Windows already has (channel "msedge"), so nothing big is
// downloaded. In CI there is no Edge, so it uses Playwright's Chromium (`npx playwright install chromium`).
// PW_CHANNEL overrides this ("chromium" forces the bundled one).
const PORT = 4173;
const externalBaseUrl = process.env.E2E_BASE_URL;
const baseURL = externalBaseUrl ?? `http://127.0.0.1:${PORT}`;
const channel = process.env.PW_CHANNEL ?? (process.env.CI ? undefined : 'msedge');

export default defineConfig({
  testDir: './e2e',
  // *.e2e.ts, not *.spec.ts: Vitest collects every .spec.ts and must not pick these up
  testMatch: '**/*.e2e.ts',
  // e2e/supabase needs the local Supabase: it has its own config (playwright.supabase.config.ts, `npm run e2e:supabase`)
  testIgnore: '**/supabase/**',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
    // The service worker would cache pages between tests and hide what the build really serves
    serviceWorkers: 'block',
    permissions: ['microphone'],
    locale: 'pt-BR',
    launchOptions: {
      args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required']
    }
  },
  projects: [{ name: 'chromium', use: { channel, viewport: { width: 1366, height: 768 } } }],
  // Own output folder: the regular `dist` belongs to `npm run build` and the size/precache checks
  webServer: externalBaseUrl
    ? undefined
    : {
        command: `npx vite build --outDir dist-e2e --emptyOutDir && npx vite preview --outDir dist-e2e --host 127.0.0.1 --port ${PORT} --strictPort`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000
      }
});
