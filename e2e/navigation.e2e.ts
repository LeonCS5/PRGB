import { expect, test } from './fixtures';
import { GAME_LANE, SCREENS, openGame } from './helpers';

test('Voltar fecha a tela aberta em vez de sair do site', async ({ page, baseURL }) => {
  await SCREENS.aparencia(page);
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1, name: 'Aparência' })).toBeHidden();
  await expect(page.getByRole('button', { name: /^Tocar agora/ })).toBeVisible();
  expect(new URL(page.url()).origin).toBe(new URL(baseURL ?? page.url()).origin);
});

test('Voltar fecha uma camada por vez: o modal e depois o jogo', async ({ page }) => {
  await openGame(page);
  await page.getByRole('button', { name: /^Áudio/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();

  await page.goBack();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByRole('main', { name: GAME_LANE })).toBeVisible();

  await page.goBack();
  await expect(page.getByRole('main', { name: GAME_LANE })).toBeHidden();
  await expect(page.getByRole('button', { name: /^Tocar agora/ })).toBeVisible();
});
