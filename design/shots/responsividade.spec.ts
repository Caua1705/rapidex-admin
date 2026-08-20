import { expect, test, type Page } from '@playwright/test';

import { installFakeApi, LOGIN_EMAIL, LOGIN_PASSWORD, type FakeApi } from '../../e2e/fake-api';

const TAG = process.env.SHOT_TAG ?? 'atual';
const LARGURAS = [390, 430, 768, 1024, 1280, 1440, 1920, 2560] as const;
const ROTAS = ['/pedidos', '/cardapio', '/minha-loja', '/clientes'] as const;

let api: FakeApi;

test.beforeEach(async ({ page }) => {
  api = await installFakeApi(page);
});

test.afterEach(() => api.stop());

async function entrar(page: Page) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(LOGIN_EMAIL);
  await page.getByLabel('Senha').fill(LOGIN_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/\/pedidos$/);
}

test('não há estouro horizontal global nas larguras de produto', async ({ page }) => {
  test.setTimeout(180_000);
  await page.addInitScript(() => window.localStorage.setItem('rapidex-admin.theme', 'light'));
  await page.setViewportSize({ width: LARGURAS[0], height: 844 });
  await entrar(page);

  for (const largura of LARGURAS) {
    await page.setViewportSize({ width: largura, height: largura <= 430 ? 844 : 900 });

    for (const rota of ROTAS) {
      await page.goto(rota);
      await page.waitForLoadState('networkidle').catch(() => undefined);
      await page.waitForTimeout(250);

      const excesso = await page.evaluate(() =>
        Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
      );
      expect(excesso, `${rota} em ${largura}px`).toBeLessThanOrEqual(1);
    }

    await page.goto('/pedidos');
    await page.waitForTimeout(250);
    if (largura < 768) {
      await expect(page.locator('.shell__bar')).toBeVisible();
      await expect(page.locator('.shell__bottom > .shell__tab')).toHaveCount(4);
      const ultimoDestino = await page.locator('.shell__bottom > .shell__tab').last().boundingBox();
      expect(ultimoDestino?.x, `último destino da barra em ${largura}px`).toBeGreaterThan(
        largura * 0.7,
      );
    }
    await page.screenshot({
      path: `design/shots/out/${TAG}/responsivo-pedidos-${largura}.png`,
      fullPage: false,
    });
  }
});
