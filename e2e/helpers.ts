import type { Page } from '@playwright/test';
import { expect } from './fixtures';

export const GAME_LANE = 'Pista de prática de guitarra';

// Landing → "Tocar agora" → the game screen, stopped, with the first-game legend closed
export const openGame = async (page: Page): Promise<void> => {
  await page.goto('/');
  await page.getByRole('button', { name: /^Tocar agora/ }).click();
  await expect(page.getByRole('main', { name: GAME_LANE })).toBeVisible();
  const legend = page.getByRole('button', { name: 'Entendi' });
  if (await legend.isVisible()) await legend.click();
};

// The visible button with this name: the top menu on a wide screen, the tab bar on a phone
const openFromMenu = (name: RegExp) => async (page: Page): Promise<void> => {
  await page.goto('/');
  await page.getByRole('button', { name }).filter({ visible: true }).first().click();
};

const hasTitle = async (page: Page): Promise<void> => {
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
};

export const SCREENS: Record<string, (page: Page) => Promise<void>> = {
  landing: async (page) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /^Tocar agora/ })).toBeVisible();
  },
  jogo: openGame,
  exercicios: async (page) => { await openFromMenu(/^Exercícios/)(page); await hasTitle(page); },
  trilha: async (page) => { await openFromMenu(/^Trilha/)(page); await hasTitle(page); },
  repertorio: async (page) => { await openFromMenu(/^Repertório/)(page); await hasTitle(page); },
  progresso: async (page) => { await openFromMenu(/^Meu progresso/)(page); await hasTitle(page); },
  aparencia: async (page) => {
    await openFromMenu(/^Aparência/)(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Aparência' })).toBeVisible();
  },
  audio: async (page) => {
    await page.goto('/');
    await page.getByRole('button', { name: /^Áudio e afinador/ }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  }
};
