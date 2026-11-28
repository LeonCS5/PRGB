import { expect, readCspViolations, test } from './fixtures';
import { GAME_LANE, openGame } from './helpers';

test('"Tocar agora" abre o jogo com o microfone e a contagem fica no meio, sem mexer na pista', async ({ page, diagnostics }) => {
  await openGame(page);
  const lane = page.getByRole('main', { name: GAME_LANE });
  const canvas = lane.locator('canvas');
  const play = page.getByRole('button', { name: 'Tocar', exact: true });

  // The microphone was asked for and the fake device answered: the game can start
  await expect(play).toBeEnabled();

  // Every size the lane takes from now on is recorded; the count must not change it
  await canvas.evaluate((element) => {
    const seen = new Set<string>();
    (window as unknown as { __laneSizes: Set<string> }).__laneSizes = seen;
    const record = () => {
      const rect = element.getBoundingClientRect();
      seen.add(`${Math.round(rect.width)}x${Math.round(rect.height)}`);
    };
    record();
    new ResizeObserver(record).observe(element);
  });

  await play.click();
  const prepare = lane.getByText('Prepare-se');
  await expect(prepare).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: /Começa em \d/ })).toHaveCount(1);

  // The number sits in the middle of the lane, over it, taking no room
  const box = await lane.boundingBox();
  const prepareBox = await prepare.boundingBox();
  expect(box).not.toBeNull();
  expect(prepareBox).not.toBeNull();
  const laneCenterX = box!.x + box!.width / 2;
  const laneCenterY = box!.y + box!.height / 2;
  expect(Math.abs(prepareBox!.x + prepareBox!.width / 2 - laneCenterX)).toBeLessThan(box!.width * 0.1);
  expect(Math.abs(prepareBox!.y + prepareBox!.height / 2 - laneCenterY)).toBeLessThan(box!.height * 0.4);

  // ...fades along the 5 s and is gone when the music starts
  const overlay = prepare.locator('xpath=..');
  const opacityNow = () => overlay.evaluate((element) => Number(getComputedStyle(element).opacity));
  const first = await opacityNow();
  expect(first).toBeLessThanOrEqual(0.6);
  await expect.poll(opacityNow, { timeout: 8_000 }).toBeLessThan(first - 0.1);
  await expect(prepare).toBeHidden({ timeout: 12_000 });

  const sizes = await canvas.evaluate(() => [...(window as unknown as { __laneSizes: Set<string> }).__laneSizes]);
  expect(sizes, 'a pista mantém o mesmo tamanho durante a contagem').toHaveLength(1);
  expect(diagnostics.consoleErrors).toEqual([]);
  expect(await readCspViolations(page)).toEqual([]);
});

test('o exercício toca até o resultado com o microfone falso', async ({ page }) => {
  test.setTimeout(120_000);
  await openGame(page);
  await page.getByRole('button', { name: 'Tocar', exact: true }).click();
  await page.getByRole('button', { name: 'Pular contagem' }).click();
  await expect(page.getByRole('heading', { name: 'Prática concluída' })).toBeVisible({ timeout: 90_000 });
  await expect(page.getByRole('button', { name: 'Tocar de novo' })).toBeVisible();
});
