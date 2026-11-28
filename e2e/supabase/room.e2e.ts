import { expect, test, newPlayer, type Player } from './fixtures';
import { expectCleanRun, fillEntryForm, installNotePlayer, randomNickname } from './helpers';
import { sqlNumber } from './localStack';

// The online pair: two players, two browser contexts (two anonymous accounts), one room through Supabase Realtime.
// Each makes an account the first time the room asks for one.
const openRoomModal = async (player: Player): Promise<void> => {
  await player.page.goto('/');
  await player.page.getByRole('button', { name: /^Dupla online/ }).click();
  await expect(player.page.getByRole('dialog').getByRole('heading', { name: 'Dupla online' })).toBeVisible();
};

const room = (player: Player) => player.page.getByRole('dialog', { name: 'Dupla online' });

// "Criar sala": the room asks for an account first, then opens the lobby with the code
const hostRoom = async (host: Player, nickname: string): Promise<string> => {
  await openRoomModal(host);
  await room(host).getByRole('button', { name: /Criar sala/ }).click();
  await fillEntryForm(host.page, nickname);
  await expect(room(host).getByText('Sala ativa')).toBeVisible();
  const code = room(host).getByRole('button', { name: 'Copiar código da sala' }).locator('xpath=preceding-sibling::span');
  await expect(code).toHaveText(/^[A-Z0-9]{6}$/);
  return (await code.textContent()) ?? '';
};

const joinRoom = async (guest: Player, code: string, nickname: string | null): Promise<void> => {
  await openRoomModal(guest);
  await room(guest).getByRole('button', { name: /Entrar com código/ }).click();
  await room(guest).getByLabel('Código da sala (6 caracteres)').fill(code);
  await room(guest).getByRole('button', { name: 'Entrar na sala' }).click();
  if (nickname) await fillEntryForm(guest.page, nickname);
};

test.describe('online pair against the local Supabase (Realtime)', () => {
  test('two players make a room, get ready, play the same exercise and see the team result', async ({ browser, baseURL }) => {
    test.setTimeout(180_000);
    const host = await newPlayer(browser, baseURL!);
    const guest = await newPlayer(browser, baseURL!);
    try {
      for (const player of [host, guest]) await installNotePlayer(player.page);
      const hostName = randomNickname();
      const guestName = randomNickname();

      const code = await hostRoom(host, hostName);
      await room(host).getByLabel('Exercícios do PRGB').selectOption('demo');
      await expect(room(host).getByText('Música selecionada')).toBeVisible();

      await joinRoom(guest, code, guestName);
      await expect(room(guest).getByText('Sala ativa')).toBeVisible();
      // Each sees the other in the lobby
      await expect(room(host).getByText(guestName)).toBeVisible();
      await expect(room(guest).getByText(hostName)).toBeVisible();

      // The guest picks the same exercise for their own screen; both connect the guitar (the fake microphone) and get ready
      await room(guest).getByRole('button', { name: 'Tocar a mesma faixa do anfitrião' }).click();
      for (const player of [host, guest]) {
        await room(player).getByRole('button', { name: 'Conectar guitarra' }).click();
        const ready = room(player).getByRole('button', { name: /Estou pronto/ });
        await expect(ready).toBeEnabled();
        await ready.click();
        await expect(room(player).getByRole('button', { name: /Pronto! Clique para cancelar/ })).toBeVisible();
      }

      // Only the host starts, and when both are ready
      await expect(room(guest).getByRole('button', { name: 'Começar partida' })).toHaveCount(0);
      await room(host).getByRole('button', { name: 'Começar partida' }).click();

      // Both end up in the game, each with the progress of the pair on screen
      for (const player of [host, guest]) {
        await expect(player.page.getByRole('region', { name: 'Progresso da dupla online' })).toBeVisible({ timeout: 30_000 });
      }
      // ...and at the result of the pair, once both have finished: the same team score on both screens, which is the
      // sum of the two players' scores, and a result that is the mirror image on the two sides
      const digits = (text: string): number => Number(text.replace(/\D/g, ''));
      const readResult = async (player: Player) => {
        const panel = player.page.getByRole('dialog', { name: 'Resultado da dupla' });
        await expect(panel).toBeVisible({ timeout: 90_000 });
        await expect(panel.getByText(/Aguardando .* terminar/)).toHaveCount(0, { timeout: 45_000 });
        const cards = panel.locator('.grid > div');
        const mine = digits(await cards.nth(0).locator('p').nth(1).innerText());
        const partner = digits(await cards.nth(1).locator('p').nth(1).innerText());
        const team = digits(await panel.getByText('Placar da equipe').locator('xpath=following-sibling::p[1]').innerText());
        const outcome = (await panel.getByRole('status').innerText()).trim();
        return { mine, partner, team, outcome };
      };
      const hostResult = await readResult(host);
      const guestResult = await readResult(guest);
      expect(hostResult.mine + hostResult.partner, 'team score = the two scores (host screen)').toBe(hostResult.team);
      expect(guestResult.mine + guestResult.partner, 'team score = the two scores (guest screen)').toBe(guestResult.team);
      expect(hostResult.team, 'the same team score on both screens').toBe(guestResult.team);
      expect(hostResult.mine, 'the guest sees the host score as the partner').toBe(guestResult.partner);
      expect(guestResult.mine, 'the host sees the guest score as the partner').toBe(hostResult.partner);
      expect(hostResult.team, 'the notes were played: the team scored').toBeGreaterThan(0);
      const mirror: Record<string, string> = { 'Vitória!': 'Derrota', 'Derrota': 'Vitória!', 'Empate!': 'Empate!' };
      expect(guestResult.outcome).toBe(mirror[hostResult.outcome]);
      // A match of the pair is never a ranked run: nothing of it reaches the leaderboard
      expect(sqlNumber(`select count(*) from public.scores_best b join public.profiles p on p.id = b.user_id where p.nickname in ('${hostName}', '${guestName}')`)).toBe(0);

      await expectCleanRun(host.page, host.diagnostics);
      await expectCleanRun(guest.page, guest.diagnostics);
    } finally {
      await host.context.close();
      await guest.context.close();
    }
  });

  test('a player leaves and comes back with the code, and the host closing the room ends it for the guest', async ({ browser, baseURL }) => {
    test.setTimeout(120_000);
    const host = await newPlayer(browser, baseURL!);
    const guest = await newPlayer(browser, baseURL!);
    try {
      const hostName = randomNickname();
      const guestName = randomNickname();
      const code = await hostRoom(host, hostName);
      await joinRoom(guest, code, guestName);
      await expect(room(host).getByText(guestName)).toBeVisible();

      // The guest leaves: the host is back to waiting for a partner (Realtime presence)
      await room(guest).getByRole('button', { name: 'Sair da sala' }).click();
      await expect(room(host).getByText('Aguardando o parceiro entrar…')).toBeVisible();
      await expect(room(host).getByText(guestName)).toHaveCount(0);

      // ...and comes back with the same code (the account of this browser is already there: no form this time)
      await joinRoom(guest, code, null);
      await expect(room(guest).getByText('Sala ativa')).toBeVisible();
      await expect(room(host).getByText(guestName)).toBeVisible();

      // The host leaves: the room is over for the guest
      await room(host).getByRole('button', { name: 'Sair da sala' }).click();
      await expect(room(guest).getByText('O anfitrião encerrou a sala.')).toBeVisible();

      await expectCleanRun(host.page, host.diagnostics);
      await expectCleanRun(guest.page, guest.diagnostics);
    } finally {
      await host.context.close();
      await guest.context.close();
    }
  });

  test('a third player is refused with the code of a full room, and an unknown code is not found', async ({ browser, baseURL }) => {
    test.setTimeout(120_000);
    const host = await newPlayer(browser, baseURL!);
    const guest = await newPlayer(browser, baseURL!);
    const third = await newPlayer(browser, baseURL!);
    try {
      const code = await hostRoom(host, randomNickname());
      await joinRoom(guest, code, randomNickname());
      await expect(room(guest).getByText('Sala ativa')).toBeVisible();

      // room_full: two players already
      await joinRoom(third, code, randomNickname());
      await expect(room(third).getByText('Esta sala já está ocupada por dois jogadores.')).toBeVisible();
      await expect(room(third).getByText('Sala ativa')).toHaveCount(0);
      // The pair in the room is not disturbed
      await expect(room(host).getByText('Sala ativa')).toBeVisible();
      await expect(room(guest).getByText('Sala ativa')).toBeVisible();

      // An unknown code (six characters that nobody hosts)
      await room(third).getByLabel('Código da sala (6 caracteres)').fill('ZZZZZZ');
      await room(third).getByRole('button', { name: 'Entrar na sala' }).click();
      await expect(room(third).getByText('Sala não encontrada. Confirme o código com seu parceiro.')).toBeVisible();

      expect(sqlNumber(`select count(*) from public.room_seats where code = '${code}'`)).toBe(2);
      await expectCleanRun(host.page, host.diagnostics);
      await expectCleanRun(guest.page, guest.diagnostics);
    } finally {
      await host.context.close();
      await guest.context.close();
      await third.context.close();
    }
  });
});
