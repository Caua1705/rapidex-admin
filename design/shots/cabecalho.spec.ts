/**
 * O cabeçalho, com uma filial escolhida e com a barra apertada.
 *
 * A pergunta é uma só: QUEM TRUNCA quando o nome e o endereço não cabem
 * juntos. A barra já mostrou "Pizzaria do Zé …" ao lado de um endereço inteiro
 * com espaço de sobra — prioridade invertida, porque o endereço só existe para
 * desempatar dois nomes parecidos.
 *
 * O teste MEDE: o nome renderizado tem de ser o nome inteiro (nada de reticências
 * do CSS), em todas as larguras onde a barra existe.
 */
import { expect, test, type Page } from '@playwright/test';

import { installFakeApi, LOGIN_EMAIL, LOGIN_PASSWORD, type FakeApi } from '../../e2e/fake-api';
import { escolherFilial } from '../../e2e/seletor';

const TAG = process.env.SHOT_TAG ?? 'atual';
const LARGURAS = [820, 1024, 1440, 1900];

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

test('o nome da filial nunca trunca antes do endereço', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: LARGURAS[0]!, height: 900 });
  await entrar(page);
  await escolherFilial(page);

  const nome = page.locator('.branch__name');

  for (const largura of LARGURAS) {
    await page.setViewportSize({ width: largura, height: 900 });
    await page.waitForTimeout(200);

    await expect(nome).toHaveText('Pizzaria do Zé — Aldeota');

    /*
     * `toHaveText` compara o texto do DOM, e o CSS pode estar cortando com
     * reticências sem mudar o DOM. Quem denuncia isso é a largura de rolagem
     * ser maior que a visível.
     */
    const cortado = await nome.evaluate((node) => node.scrollWidth > node.clientWidth + 1);
    expect(cortado, `nome cortado em ${largura}px`).toBe(false);

    await page
      .locator('.shell__bar')
      .screenshot({ path: `design/shots/out/${TAG}/cabecalho-${largura}.png` });
  }
});
