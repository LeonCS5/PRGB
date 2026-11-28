import { defineConfig } from '@playwright/test';
import { assertLocalUrl, readStack } from './e2e/supabase/localStack';

// E2E against the LOCAL Supabase (Docker): ranking, account and online pair. `npm run e2e:supabase` starts the local
// stack (scripts/e2e-supabase.mjs) and runs this config. Nothing here can reach the hosted project: the stack is read
// from `supabase status` (local only, checked by assertLocalUrl), the app is built with that URL and the local
// publishable key in the environment of the build process (no file holds a key), and every request outside the preview
// server and the local API is aborted (e2e/supabase/fixtures.ts).
const stack = readStack();
assertLocalUrl(stack.apiUrl, 'API_URL of the local stack');

const PORT = 4174;
const baseURL = `http://127.0.0.1:${PORT}`;
const channel = process.env.PW_CHANNEL ?? (process.env.CI ? undefined : 'msedge');

export default defineConfig({
  testDir: './e2e/supabase',
  testMatch: '**/*.e2e.ts',
  // The setup returns its own clean-up (the accounts the run created)
  globalSetup: './e2e/supabase/global-setup.ts',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  // One local database shared by every test: the tests make their own accounts, but the rate limits and the
  // rooms are global, so they run one after the other
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
    serviceWorkers: 'block',
    // local-network-access: the page (served through the route that adds the CSP) calls the local API on another port
    permissions: ['microphone', 'local-network-access'],
    locale: 'pt-BR',
    launchOptions: {
      args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required']
    }
  },
  projects: [{ name: 'supabase-local', use: { channel, viewport: { width: 1366, height: 768 } } }],
  webServer: {
    command: `npx vite build --outDir dist-e2e-local --emptyOutDir && npx vite preview --outDir dist-e2e-local --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: baseURL,
    // A stale preview would be a build of something else: always start our own
    reuseExistingServer: false,
    timeout: 240_000,
    // Process environment wins over every .env file, so the hosted project's values never reach this build
    env: {
      VITE_SUPABASE_URL: stack.apiUrl,
      VITE_SUPABASE_ANON_KEY: stack.publishableKey,
      VITE_TURNSTILE_SITE_KEY: ''
    }
  }
});
