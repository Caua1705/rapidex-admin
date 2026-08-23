/**
 * E2E da identificação do estabelecimento no shell.
 *
 * O painel mostrava a marca do Rapidex e o seletor de filial, e não dizia de
 * QUAL cliente era aquela operação. Quem administra dez restaurantes abria o
 * painel e não sabia onde estava.
 *
 * O que estes testes protegem são as três formas de errar isso:
 *
 *   1. **A identificação virar um segundo seletor de filial.** Ela não pode
 *      mudar quando o lojista troca de loja no topo — ela responde "que cliente
 *      eu administro", não "que loja esta tela mostra". Este painel já teve
 *      exatamente esse defeito, e foi por isso que o nome saiu do cabeçalho.
 *   2. **A marca do Rapidex sumir.** O painel não é white-label; o app do
 *      cliente é.
 *   3. **A informação existir só no desktop.** No celular não há lateral, e a
 *      regra do shell é que a informação troca de lugar, nunca desaparece.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';

import {
  installFakeApi,
  FAKE_BRANCH,
  FAKE_BRANCH_2,
  LOGIN_EMAIL,
  LOGIN_PASSWORD,
  type FakeApi,
} from './fake-api';
import { escolherFilial } from './seletor';
import { branchName } from '../src/layout/branch-heading';

let api: FakeApi;

test.beforeEach(async ({ page }) => {
  api = await installFakeApi(page);
});

test.afterEach(() => {
  api.stop();
});

async function entrar(page: Page) {
  await page.goto('/pedidos');
  await page.getByLabel('E-mail').fill(LOGIN_EMAIL);
  await page.getByLabel('Senha').fill(LOGIN_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/pedidos$/);
}

/**
 * A largura que o elemento OCUPA.
 *
 * `toBeVisible()` não serve para o que estes testes precisam distinguir: o
 * texto escondido da trilha de ícones usa a técnica de recorte de 1px do
 * sistema (a mesma de `.shell__link-label`), e um elemento de 1×1 continua
 * "visível" para o Playwright. Quem separa "escrito na tela" de "só no leitor
 * de tela" é a medida.
 */
async function larguraDe(locator: Locator): Promise<number> {
  return (await locator.boundingBox())?.width ?? 0;
}

/* ==========================================================================
 * A LATERAL ESCRITA (≥1180px)
 * ======================================================================= */

test('a lateral diz qual estabelecimento está sendo operado, embaixo da marca', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await entrar(page);

  const identificacao = page.getByTestId('estab-lateral');

  /*
   * A MARCA, e não o `display_name` da matriz ("Pizzaria do Zé — Aldeota"): o
   * bloco identifica o RESTAURANTE, então não pode carregar um nome de filial
   * dentro.
   *
   * A ASSERÇÃO DO `title` MUDOU DE FORMA em 2026-08-23, e o requisito é o
   * mesmo. Enquanto o nome era DERIVADO da filial principal, o bloco mostrava
   * o texto cortado no travessão e guardava o inteiro no `title` — era o
   * `title` que carregava o "— Aldeota". `ea1c9e3` trouxe
   * `GET /admin/restaurant` e apagou a derivação: hoje o nome vem inteiro de
   * `restaurants.name`, não há corte, e o `title` existe só porque a lateral
   * tem 160px e o CSS corta com reticências (ver `EstablishmentBadge`).
   *
   * Então o que se cobra agora é o mesmo de antes, e mais forte: nenhum nome de
   * filial entra aqui — nem no texto, nem no atributo.
   */
  await expect(identificacao.locator('.estab__nome')).toHaveText('Pizzaria do Zé');
  await expect(identificacao.locator('.estab__nome')).toHaveAttribute(
    'title',
    'Pizzaria do Zé',
  );
  await expect(identificacao).not.toContainText('Aldeota');

  // A cidade e quantas lojas o lojista enxerga — é isso que faz o bloco ler
  // como o CONJUNTO, e não como uma das lojas.
  await expect(identificacao).toContainText('Fortaleza · 2 lojas');

  // E a marca da ferramenta continua acima: o painel não é white-label.
  await expect(page.getByRole('img', { name: 'Rapidex' })).toBeVisible();
});

/*
 * ============================================================================
 * O TESTE QUE ESTA PEÇA EXISTE PARA NÃO FALHAR
 * ============================================================================
 *
 * A identificação e o seletor de filial respondem perguntas DIFERENTES. Se ela
 * acompanhasse o seletor, seria um segundo controle dizendo a mesma coisa — e
 * foi assim que o nome saiu do cabeçalho da primeira vez: "Matriz" escrito logo
 * acima de "Todas as filiais (2)", duas afirmações opostas na mesma esquina.
 */
test('trocar de filial no topo não mexe na identificação do estabelecimento', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await entrar(page);

  const nome = page.getByTestId('estab-lateral').locator('.estab__nome');
  await expect(nome).toHaveText('Pizzaria do Zé');

  await escolherFilial(page, FAKE_BRANCH_2);

  // O seletor mudou…
  await expect(page.getByTestId('branch-selector')).toContainText(branchName(FAKE_BRANCH_2));
  // …e a identificação, não.
  await expect(nome).toHaveText('Pizzaria do Zé');

  await escolherFilial(page, FAKE_BRANCH);
  await expect(nome).toHaveText('Pizzaria do Zé');
});

/* ==========================================================================
 * A TRILHA DE ÍCONES (768–1179px)
 * ======================================================================= */

/*
 * Na trilha sobra o ladrilho, como sobra o ícone de cada seção — 68px não cabem
 * um nome. O texto continua no leitor de tela, então o ladrilho não é uma peça
 * muda para quem não o vê.
 */
test('na trilha de ícones sobra o ladrilho, e o nome continua no leitor de tela', async ({
  page,
}) => {
  await page.setViewportSize({ width: 900, height: 900 });
  await entrar(page);

  const identificacao = page.getByTestId('estab-lateral');
  await expect(identificacao).toBeVisible();

  // O ladrilho é a parte que se vê.
  const ladrilho = identificacao.locator('.estab__marca');
  expect(await larguraDe(ladrilho)).toBeGreaterThan(20);

  // O nome está no documento, mas não ocupa a tela.
  expect(await larguraDe(identificacao.locator('.estab__nome'))).toBeLessThanOrEqual(1);
  await expect(identificacao).toContainText('Pizzaria do Zé');
});

/* ==========================================================================
 * O CELULAR (<768px)
 * ======================================================================= */

test('no celular a identificação troca de lugar em vez de sumir', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await entrar(page);

  // Não há lateral no telefone.
  await expect(page.getByTestId('estab-lateral')).toBeHidden();

  // Ela está na barra do topo, no grupo da conta.
  const identificacao = page.getByTestId('estab-barra');
  await expect(identificacao).toBeVisible();
  await expect(identificacao.locator('.estab__marca')).toHaveText('PZ');
  await expect(identificacao).toContainText('Pizzaria do Zé');

  /*
   * E ela não empurrou o seletor de filial, que é a peça que não pode encolher:
   * é ela que diz de qual loja é o pedido na tela.
   */
  await expect(page.getByTestId('branch-selector')).toBeVisible();
  const estouro = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(estouro).toBeLessThanOrEqual(1);
});

/*
 * Em 520px para cima a barra tem largura para o nome escrito — abaixo disso,
 * sobra o ladrilho. É uma conta de largura, não de gosto: em 390px a barra já
 * carrega o seletor, o tema e o "Sair".
 */
test('a barra escreve o nome quando há largura para ele', async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 844 });
  await entrar(page);

  const nome = page.getByTestId('estab-barra').locator('.estab__nome');
  expect(await larguraDe(nome)).toBeGreaterThan(40);

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await larguraDe(nome)).toBeLessThanOrEqual(1);
});
