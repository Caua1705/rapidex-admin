/**
 * O enquadramento nas telas largas.
 *
 * Existe separado de `telas.spec.ts` porque a pergunta aqui é UMA só: onde a
 * coluna de conteúdo começa e onde ela termina, à medida que a tela cresce. O
 * defeito que ele existe para pegar é a faixa vertical vazia entre a lateral e
 * o conteúdo — que só aparece acima de 1600px, largura que o lote normal de
 * prints (1440 e 390) nunca chega a mostrar.
 *
 * Além do print, ele MEDE: `x` do primeiro pixel de conteúdo menos a borda
 * direita da lateral. Acima de 100px é o critério de pronto reprovando, e o
 * teste falha — não é uma foto para alguém julgar depois.
 */
import { expect, test, type Page } from '@playwright/test';

import { installFakeApi, LOGIN_EMAIL, LOGIN_PASSWORD, type FakeApi } from '../../e2e/fake-api';

const TAG = process.env.SHOT_TAG ?? 'atual';

/** As três larguras do critério de pronto. O tema escuro é o padrão. */
const LARGURAS = [1440, 1900, 2560];

/**
 * Cada tela com o seletor do seu PRIMEIRO bloco de conteúdo — o elemento cuja
 * borda esquerda o olho lê como "aqui começa a página".
 */
const TELAS = [
  { slug: 'pedidos', path: '/pedidos', conteudo: '.faixas > *' },
  { slug: 'cardapio', path: '/cardapio', conteudo: '.rail' },
  { slug: 'minha-loja', path: '/minha-loja', conteudo: '.store__index' },
  { slug: 'clientes', path: '/clientes', conteudo: 'main h1' },
  { slug: 'desempenho', path: '/desempenho', conteudo: 'main h1' },
];

/** Acima disto o vão entre a lateral e o conteúdo lê como tela quebrada. */
const VAO_MAXIMO = 100;

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

for (const largura of LARGURAS) {
  test(`enquadramento em ${largura}px`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: largura, height: 900 });
    await page.addInitScript(() => window.localStorage.setItem('rapidex-admin.theme', 'dark'));
    await entrar(page);

    for (const tela of TELAS) {
      await page.goto(tela.path);
      await page.waitForLoadState('networkidle').catch(() => undefined);
      await page.waitForTimeout(500);
      await page.screenshot({
        path: `design/shots/out/${TAG}/enq-${tela.slug}-${largura}.png`,
        fullPage: false,
      });

      const lateral = await page.locator('.shell__nav').boundingBox();
      const conteudo = await page.locator(tela.conteudo).first().boundingBox();
      if (!lateral || !conteudo) throw new Error(`sem caixa para ${tela.slug}`);

      const vao = conteudo.x - (lateral.x + lateral.width);
      expect(vao, `${tela.slug} @ ${largura}px: vão de ${Math.round(vao)}px`).toBeLessThanOrEqual(
        VAO_MAXIMO,
      );
    }
  });
}
