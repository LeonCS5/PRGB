import type { Page } from '@playwright/test';
import { getDemoSong } from '../../src/services/demoSong';
import { expect, readCspViolations, type Diagnostics } from './fixtures';

// 3 to 20 characters, no blocked word: the random part keeps nicknames of one run apart (they are unique in the database)
export const randomNickname = (): string => `e2e_${Math.random().toString(36).slice(2, 8)}`;

// The visible button with this name: the top menu on a wide screen
export const openFromMenu = async (page: Page, name: RegExp): Promise<void> => {
  await page.goto('/');
  await page.getByRole('button', { name }).filter({ visible: true }).first().click();
};

export const openLeaderboard = async (page: Page): Promise<void> => {
  await openFromMenu(page, /^Ranking/);
  await expect(page.getByRole('heading', { name: 'Ranking', level: 2 })).toBeVisible();
};

// The entry form of the ranking (18+ and consent, then a nickname) → an anonymous account with a profile
export const fillEntryForm = async (page: Page, nickname: string): Promise<void> => {
  const form = page.getByRole('dialog').filter({ has: page.getByLabel('Seu apelido no ranking') });
  await form.getByLabel('Seu apelido no ranking').fill(nickname);
  await form.getByRole('checkbox', { name: /Confirmo que tenho 18 anos/ }).check();
  await form.getByRole('checkbox', { name: /Quero entrar no ranking/ }).check();
  await form.getByRole('button', { name: 'Entrar no ranking' }).click();
  await expect(form).toBeHidden();
};

// "Entrar no ranking" of the leaderboard → the entry form
export const createAccount = async (page: Page, nickname: string): Promise<void> => {
  // The top menu has an icon with the same name: this one is inside the leaderboard
  await page.getByRole('dialog').getByRole('button', { name: 'Entrar no ranking' }).click();
  await fillEntryForm(page, nickname);
};

// What no test of this folder may leave behind: a request outside the preview and the local API, a console error, a CSP violation
export const expectCleanRun = async (page: Page, diagnostics: Diagnostics): Promise<void> => {
  expect(diagnostics.blockedRequests, 'requests outside the preview and the local API').toEqual([]);
  expect(diagnostics.consoleErrors, 'console errors').toEqual([]);
  expect(await readCspViolations(page), 'CSP violations').toEqual([]);
};

// A fake microphone that plays the notes of the exercise at the time the game asks for them. The page replaces
// getUserMedia with an oscillator, and a loop follows the position slider of the game (the song clock, in ms).
// Chrome's own fake device only beeps, which is not a performance: without notes the server (rightly) refuses an
// empty run.
export const installNotePlayer = async (page: Page): Promise<void> => {
  const notes = getDemoSong().notes.filter((note) => !note.dead).map((note) => ({
    startMs: note.timeMs, endMs: note.timeMs + Math.max(60, note.durationMs * 0.8), freqHz: note.freqHz
  }));
  await page.addInitScript((schedule) => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      if (!constraints || !constraints.audio) return original(constraints);
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const destination = context.createMediaStreamDestination();
      gain.gain.value = 0;
      oscillator.connect(gain).connect(destination);
      oscillator.start();
      // Plays what is under the song clock now. 40 ms ahead: the detector answers after the pick, never before it
      const AHEAD_MS = 40;
      const timer = window.setInterval(() => {
        const slider = document.querySelector<HTMLInputElement>('input[aria-label="Posição da música"]');
        if (!slider) return;
        const position = Number(slider.value) + AHEAD_MS;
        const note = position > AHEAD_MS ? schedule.find((item) => position >= item.startMs && position < item.endMs) : undefined;
        if (note) oscillator.frequency.setValueAtTime(note.freqHz, context.currentTime);
        gain.gain.setTargetAtTime(note ? 0.8 : 0, context.currentTime, 0.005);
      }, 5);
      destination.stream.getAudioTracks()[0]?.addEventListener('ended', () => window.clearInterval(timer));
      return destination.stream;
    };
  }, notes);
};

export const GAME_LANE = 'Pista de prática de guitarra';

// Landing → "Tocar agora" (the original exercise, the one the server knows) → the game screen, stopped
export const openGame = async (page: Page): Promise<void> => {
  await page.goto('/');
  await page.getByRole('button', { name: /^Tocar agora/ }).click();
  await expect(page.getByRole('main', { name: GAME_LANE })).toBeVisible();
  const legend = page.getByRole('button', { name: 'Entendi' });
  if (await legend.isVisible()) await legend.click();
};

// Plays the exercise to the result: waits for the ranking to be ready, skips the count, and waits for the end
export const playToResult = async (page: Page): Promise<void> => {
  await expect(page.getByText(/Valendo para o ranking/).first()).toBeVisible({ timeout: 20_000 });
  const play = page.getByRole('button', { name: 'Tocar', exact: true });
  await expect(play).toBeEnabled();
  await play.click();
  await page.getByRole('button', { name: 'Pular contagem' }).click();
  await expect(page.getByRole('heading', { name: 'Prática concluída' })).toBeVisible({ timeout: 60_000 });
};
