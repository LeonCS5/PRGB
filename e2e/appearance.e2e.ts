import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { SCREENS } from './helpers';

const openShadowCategory = async (page: Page) => {
  await SCREENS.aparencia(page);
  await page.getByRole('button', { name: 'Sombra-guia' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Sombra-guia' })).toBeVisible();
};

// What the user sees when the page is pushed past its content: the screen is overflow:hidden, but the browser
// still scrolls it when a hidden input gets focus
const pageScroll = (page: Page) =>
  page.evaluate(() => ({ y: window.scrollY, overflow: document.documentElement.scrollHeight - window.innerHeight }));

test('clicar nos interruptores não rola a página (o campo oculto fica dentro do rótulo)', async ({ page }) => {
  await openShadowCategory(page);
  // A click on the visible label, like the user does; the group holding "next note" starts collapsed
  await page.locator('summary', { hasText: 'Acordes e próxima nota' }).click();
  const next = page.getByRole('switch', { name: /Prévia da próxima nota/ });
  const before = await next.isChecked();
  await page.locator('label[for="appearance-guide-next"]').click();
  await expect(next).toBeChecked({ checked: !before });
  const after = await pageScroll(page);
  expect(after.y).toBe(0);
  expect(after.overflow).toBeLessThanOrEqual(1);

  await page.locator('label[for="appearance-guide"]').click();
  expect((await pageScroll(page)).y).toBe(0);
});

test('o que se muda na Aparência continua depois de recarregar', async ({ page }) => {
  await openShadowCategory(page);
  await page.getByText('Holograma', { exact: true }).click();
  await expect(page.getByRole('radio', { name: /Holograma/ })).toBeChecked();
  await page.locator('summary', { hasText: 'Acordes e próxima nota' }).click();
  await page.locator('label[for="appearance-guide-next"]').click();
  const nextAfter = await page.getByRole('switch', { name: /Prévia da próxima nota/ }).isChecked();

  await page.reload();
  await openShadowCategory(page);
  await expect(page.getByRole('radio', { name: /Holograma/ })).toBeChecked();
  await page.locator('summary', { hasText: 'Acordes e próxima nota' }).click();
  await expect(page.getByRole('switch', { name: /Prévia da próxima nota/ })).toBeChecked({ checked: nextAfter });

  const stored = await page.evaluate(() => window.localStorage.getItem('prgb:appearance:v1'));
  expect(stored).toContain('hologram');
});
