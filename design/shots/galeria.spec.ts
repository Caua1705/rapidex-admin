/**
 * Fotografa a galeria do design system inteira, nos dois temas e em 390px.
 *
 * É a conferência de "todo estado desenhado": se um componente tem um estado
 * que não aparece nestes prints, ele não foi desenhado — foi imaginado.
 */
import { test } from '@playwright/test';

import { installFakeApi, LOGIN_EMAIL, LOGIN_PASSWORD } from '../../e2e/fake-api';

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

    /*
     * A galeria fica atrás do login como o resto do painel, e sem isto os três
     * prints saíam da tela de entrada — três fotos da mesma caixa de e-mail
     * arquivadas como "todo estado desenhado".
     */
    const api = await installFakeApi(page);
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(LOGIN_EMAIL);
    await page.getByLabel('Senha').fill(LOGIN_PASSWORD);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.waitForURL(/\/pedidos$/);

    await page.goto('/ui');
    await page.waitForTimeout(800);
    await page.screenshot({
      path: `design/shots/out/${TAG}/galeria-${vista.name}.png`,
      fullPage: true,
    });

    api.stop();
  });
}
