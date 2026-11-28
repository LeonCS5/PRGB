import { readFileSync } from 'node:fs';
import { expect, test } from './fixtures';
import { createAccount, expectCleanRun, installNotePlayer, openGame, openLeaderboard, playToResult, randomNickname } from './helpers';
import { readStack, sql, sqlNumber } from './localStack';

test.describe('ranking, account and leaderboard against the local Supabase', () => {
  test('the leaderboard opens without an account and reads from the local API', async ({ page, diagnostics }) => {
    const statuses: number[] = [];
    page.on('response', (response) => {
      if (response.url().includes('/rest/v1/rpc/get_leaderboard')) statuses.push(response.status());
    });

    await openLeaderboard(page);
    await expect(page.getByRole('tab', { name: 'Geral' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Semana' })).toBeVisible();
    // Rows or the empty message: either way the call went through and answered
    await expect.poll(() => statuses.length, { message: 'get_leaderboard was never called' }).toBeGreaterThan(0);
    expect(statuses.every((status) => status === 200), `get_leaderboard answered ${statuses.join(', ')}`).toBe(true);
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Entrar no ranking' })).toBeVisible();
    await expectCleanRun(page, diagnostics);
  });

  test('creating an account makes an anonymous user and a profile with the consent on record', async ({ page, diagnostics }) => {
    const nickname = randomNickname();
    await openLeaderboard(page);
    await createAccount(page, nickname);

    // Nickname, then: 18+ confirmed, consent given, and the version of the text that was accepted
    expect(sql(`select nickname, age_confirmed_at is not null, consent_at is not null, consent_version is not null from public.profiles where nickname = '${nickname}'`))
      .toBe(`${nickname}|t|t|t`);
    expect(sqlNumber(`select count(*) from auth.users u join public.profiles p on p.id = u.id where p.nickname = '${nickname}' and u.is_anonymous`)).toBe(1);
    await expectCleanRun(page, diagnostics);
  });

  test('a ranked run of the original exercise is accepted by the server and shows on the leaderboard', async ({ page, diagnostics }) => {
    test.setTimeout(150_000);
    const nickname = randomNickname();
    await installNotePlayer(page);
    // The Edge Function is called with the publishable key (apikey) and the player's session (Authorization): the
    // case the runbook of the key migration worried about (verify_jwt only knows legacy JWT keys)
    const registerPart: number[] = [];
    page.on('response', (response) => {
      if (response.url().includes('/functions/v1/register-part')) registerPart.push(response.status());
    });

    // The account first (the ranking starts by itself when there is one), then the game
    await openLeaderboard(page);
    await createAccount(page, nickname);
    await openGame(page);
    await playToResult(page);

    expect(registerPart.length, 'register-part was never called').toBeGreaterThan(0);
    expect(registerPart, 'register-part answered').toEqual(registerPart.map(() => 200));

    // The server kept the score: best of all time and of the week, for the exercise (song -1)
    await expect.poll(() => sqlNumber(`select count(*) from public.scores_best b join public.profiles p on p.id = b.user_id where p.nickname = '${nickname}' and b.song_id = -1 and b.score > 0`), { message: 'scores_best row' }).toBe(1);
    expect(sqlNumber(`select count(*) from public.scores_weekly w join public.profiles p on p.id = w.user_id where p.nickname = '${nickname}' and w.song_id = -1 and w.score > 0`)).toBe(1);
    // ...and the result panel says where the player stands
    await expect(page.getByText(/Sua (melhor )?posição: \d+º no geral · \d+º na semana/)).toBeVisible();

    // The leaderboard of the exercise lists the nickname, in both periods, marked as the player
    await openLeaderboard(page);
    await expect(page.getByRole('tabpanel').getByText(nickname)).toBeVisible();
    await page.getByRole('tab', { name: 'Semana' }).click();
    await expect(page.getByRole('tabpanel').getByText(nickname)).toBeVisible();
    await expect(page.getByRole('tabpanel').getByText('VOCÊ')).toBeVisible();
    await expectCleanRun(page, diagnostics);
  });

  test('the player exports their data and deletes the account: the server keeps nothing of them', async ({ page, diagnostics }) => {
    test.setTimeout(150_000);
    const nickname = randomNickname();
    await installNotePlayer(page);
    const forbidden: string[] = [];
    page.on('response', (response) => {
      if (response.status() === 403) forbidden.push(new URL(response.url()).pathname);
    });
    await openLeaderboard(page);
    await createAccount(page, nickname);
    await openGame(page);
    await playToResult(page);
    await expect.poll(() => sqlNumber(`select count(*) from public.scores_best b join public.profiles p on p.id = b.user_id where p.nickname = '${nickname}'`)).toBe(1);
    const userId = sql(`select id from public.profiles where nickname = '${nickname}'`);
    expect(userId).toMatch(/^[0-9a-f-]{36}$/);

    // "Minha conta do ranking", from the game
    await page.getByRole('button', { name: 'Tocar de novo' }).click();
    await page.getByRole('button', { name: /Minha conta/ }).click();
    const account = page.getByRole('dialog', { name: 'Minha conta do ranking' });
    await expect(account.getByText(nickname)).toBeVisible();

    // Export: a JSON file with the profile and the score of this player
    const download = page.waitForEvent('download');
    await account.getByRole('button', { name: 'Baixar meus dados' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe('prgb-dados-ranking.json');
    const exported = JSON.parse(readFileSync(await file.path(), 'utf-8')) as {
      profile: { nickname: string } | null; scores_best: unknown[]; play_sessions: unknown[]; account: { id: string } | null;
    };
    expect(exported.profile?.nickname).toBe(nickname);
    expect(exported.account?.id).toBe(userId);
    expect(exported.scores_best).toHaveLength(1);
    expect(exported.play_sessions.length).toBeGreaterThan(0);

    // Delete: it needs the box ticked, then the account and everything that hangs from it is gone
    await account.getByRole('button', { name: 'Excluir minha conta e dados' }).click();
    const confirm = account.getByRole('group', { name: /Confirmar/ });
    const finalButton = confirm.getByRole('button', { name: 'Excluir definitivamente' });
    await expect(finalButton).toBeDisabled();
    await confirm.getByRole('checkbox', { name: /exclusão é definitiva/ }).check();
    await finalButton.click();
    await expect(account.getByText('Sua conta do ranking foi excluída.')).toBeVisible();

    const left = (table: string, column: string): number => sqlNumber(`select count(*) from ${table} where ${column} = '${userId}'`);
    expect(left('public.profiles', 'id'), 'profiles').toBe(0);
    expect(left('public.scores_best', 'user_id'), 'scores_best').toBe(0);
    expect(left('public.scores_weekly', 'user_id'), 'scores_weekly').toBe(0);
    expect(left('public.play_sessions', 'user_id'), 'play_sessions').toBe(0);
    expect(left('auth.users', 'id'), 'auth.users').toBe(0);

    // ...and the leaderboard no longer lists the nickname
    await account.getByRole('button', { name: 'Fechar' }).first().click();
    await openLeaderboard(page);
    await expect(page.getByRole('tabpanel').getByText(nickname)).toHaveCount(0);
    // The one request allowed to fail: the app signs the deleted account out, and Auth no longer knows that session
    expect(forbidden.filter((path) => path !== '/auth/v1/logout'), '403 responses other than the sign-out').toEqual([]);
    diagnostics.consoleErrors = diagnostics.consoleErrors.filter((text) => !/status of 403/.test(text) || forbidden.length === 0);
    await expectCleanRun(page, diagnostics);
  });

  test('the hourly limit of the database refuses the eleventh nickname change of a player', async ({ page, request }) => {
    // update_nickname is limited to 10 per hour and player (rpc_quota). The calls go to the real local API with the
    // session of a real player, so the limit under test is the one of the database and not a mock.
    const nickname = randomNickname();
    await openLeaderboard(page);
    await createAccount(page, nickname);
    const userId = sql(`select id from public.profiles where nickname = '${nickname}'`);
    // The app keeps the Auth session under its own key (AUTH_STORAGE_KEY of supabaseClient.ts)
    const session = await page.evaluate(() => JSON.parse(window.localStorage.getItem('prgb:auth') ?? 'null') as { access_token?: string } | null);
    expect(session?.access_token, 'the session of the player').toBeTruthy();

    const { apiUrl, publishableKey } = readStack();
    const change = (to: string) => request.post(`${apiUrl}/rest/v1/rpc/update_nickname`, {
      headers: { apikey: publishableKey, authorization: `Bearer ${session!.access_token}`, 'content-type': 'application/json' },
      data: { p_nickname: to }
    });

    for (let attempt = 1; attempt <= 10; attempt++) {
      const response = await change(`${nickname}_${attempt}`.slice(0, 20));
      expect(response.status(), `change ${attempt} of 10`).toBe(200);
    }
    const refused = await change(`${nickname}_x`.slice(0, 20));
    expect(refused.status()).toBeGreaterThanOrEqual(400);
    expect(await refused.text()).toContain('rate_limited');
    // Only the calls that went through were counted
    expect(sqlNumber(`select coalesce(sum(used), 0) from public.rpc_quota where user_id = '${userId}' and action = 'update_nickname'`)).toBe(10);
  });
});
