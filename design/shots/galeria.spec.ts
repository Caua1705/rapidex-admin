/**
 * Fotografa a galeria do design system inteira, nos dois temas e em 390px.
 *
 * É a conferência de "todo estado desenhado": se um componente tem um estado
 * que não aparece nestes prints, ele não foi desenhado — foi imaginado.
 */
import { test } from '@playwright/test';

const TAG = process.env.SHOT_TAG ?? 'ui';

const VISTAS = [
  { name: '1440-claro', width: 1440, height: 900, theme: 'light' },
  { name: '1440-escuro', width: 1440, height: 900, theme: 'dark' },
  { name: '390', width: 390, height: 844, theme: 'light' },
];

for (const vista of VISTAS) {
  test(`galeria em ${vista.name}`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: vista.width, height: vista.height });
    await page.addInitScript(
      (theme) => window.localStorage.setItem('rapidex-admin.theme', theme),
      vista.theme,
    );

    await page.goto('/ui');
    await page.waitForTimeout(800);
    await page.screenshot({
      path: `design/shots/out/${TAG}/galeria-${vista.name}.png`,
      fullPage: true,
    });
  });
}
