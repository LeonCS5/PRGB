import { expect, test } from './fixtures';
import { SCREENS } from './helpers';

// Small notebooks (short and narrow) and a phone: nothing may push the page sideways or outgrow a dialog
const SIZES = [
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1280x600', width: 1280, height: 600 },
  { name: '390x844', width: 390, height: 844 }
];

for (const size of SIZES) {
  test.describe(`sem estouro em ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    for (const [screen, open] of Object.entries(SCREENS)) {
      test(screen, async ({ page }) => {
        await open(page);
        // Lazy screens finish their layout after the first paint
        await page.waitForLoadState('networkidle');
        const result = await page.evaluate(() => {
          const width = window.innerWidth;
          const height = window.innerHeight;
          const dialogs = [...document.querySelectorAll('[role=dialog]')]
            .map((dialog) => dialog.getBoundingClientRect())
            .filter((rect) => rect.width > 0 && (rect.height > height + 1 || rect.width > width + 1 || rect.left < -1));
          return { sideways: document.documentElement.scrollWidth - width, dialogs: dialogs.length };
        });
        expect(result.sideways, 'a página não rola para o lado').toBeLessThanOrEqual(1);
        expect(result.dialogs, 'nenhum diálogo maior que a janela').toBe(0);
      });
    }
  });
}
