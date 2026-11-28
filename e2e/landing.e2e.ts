import { expect, readCspViolations, test } from './fixtures';

test('a landing abre sem erro de console, sem violação de CSP e sem falar com outro domínio', async ({ page, diagnostics }) => {
  const response = await page.goto('/');
  // The CSP under test is the one in vercel.json (the fixture adds it to the page)
  expect(response?.headers()['content-security-policy']).toContain("default-src 'self'");

  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Tocar agora/ })).toBeVisible();
  // Lazy chunks and fonts load after the first paint: wait for them before judging the console
  await page.waitForLoadState('networkidle');

  expect(diagnostics.consoleErrors).toEqual([]);
  expect(await readCspViolations(page)).toEqual([]);
  expect(diagnostics.blockedRequests).toEqual([]);
});
