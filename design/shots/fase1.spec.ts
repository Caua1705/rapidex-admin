/**
 * FASE 1 — as duas telas do julgamento: Pedidos e Minha loja > Geral.
 *
 * Quatro enquadramentos por tela (1440 claro, 1440 escuro, 390 claro, 390
 * escuro). É um arquivo de trabalho da rodada de direção visual, não uma
 * suíte: roda com `npx playwright test -c design/shots/dev.config.ts fase1`.
 */
import { test, type Page } from '@playwright/test';

import { installFakeApi, LOGIN_EMAIL, LOGIN_PASSWORD, type FakeApi } from '../../e2e/fake-api';

const TAG = process.env.SHOT_TAG ?? 'fase1';

const VIEWPORTS = [
  { name: '1440-claro', width: 1440, height: 900, theme: 'light' },
  { name: '1440-escuro', width: 1440, height: 900, theme: 'dark' },
  { name: '390-claro', width: 390, height: 844, theme: 'light' },
  { name: '390-escuro', width: 390, height: 844, theme: 'dark' },
];

let api: FakeApi;

test.beforeEach(async ({ page }) => {
  api = await installFakeApi(page);
});

test.afterEach(() => {
  api.stop();
});

async function entrar(page: Page) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(LOGIN_EMAIL);
  await page.getByLabel('Senha').fill(LOGIN_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/\/pedidos$/);
}

for (const viewport of VIEWPORTS) {
  test(`fase1 em ${viewport.name}`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.addInitScript(
      (theme) => window.localStorage.setItem('rapidex-admin.theme', theme),
      viewport.theme,
    );
    await entrar(page);

    await page.goto('/pedidos');
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await page.waitForTimeout(700);
    await page.screenshot({ path: `design/shots/out/${TAG}/pedidos-${viewport.name}.png` });

    await page.getByTestId('order-card-1002').click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `design/shots/out/${TAG}/pedido-detalhe-${viewport.name}.png` });

    await page.goto('/minha-loja/geral');
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await page.waitForTimeout(700);
    await page.screenshot({ path: `design/shots/out/${TAG}/loja-geral-${viewport.name}.png` });
  });
}
