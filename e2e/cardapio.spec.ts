/**
 * E2E do cardápio.
 *
 * Cobre as quatro regras da tela que dão errado em silêncio — o backend aceita,
 * a tela não reclama, e o cardápio publicado sai errado:
 *
 *   1. reordenar categoria manda a LISTA COMPLETA de ids;
 *   2. esgotar usa PATCH /admin/products/{id}/availability, não o PATCH do
 *      produto inteiro;
 *   3. `is_active` e `is_available` são eixos diferentes;
 *   4. não existe excluir — existe desativar.
 */
import { expect, test, type Page } from '@playwright/test';

import { installFakeApi, LOGIN_EMAIL, LOGIN_PASSWORD, type FakeApi } from './fake-api';

let api: FakeApi;

test.beforeEach(async ({ page }) => {
  api = await installFakeApi(page);
});

test.afterEach(() => {
  api.stop();
});

async function abrirCardapio(page: Page) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(LOGIN_EMAIL);
  await page.getByLabel('Senha').fill(LOGIN_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/pedidos$/);

  await page.getByRole('link', { name: 'Cardápio' }).click();
  await expect(page).toHaveURL(/\/cardapio$/);
  await expect(page.getByRole('heading', { name: 'Lanches' })).toBeVisible();
}

test('abre na primeira categoria com os itens dela', async ({ page }) => {
  await abrirCardapio(page);

  await expect(page.getByText('X-Burger Clássico')).toBeVisible();
  await expect(page.getByText('X-Salada')).toBeVisible();
  // Preço em real, com vírgula decimal.
  await expect(page.getByText('R$ 24,90')).toBeVisible();

  // Categoria inativa aparece na barra — é ela que o lojista precisa achar
  // para reativar — e vem marcada.
  await expect(page.getByText('Sobremesas')).toBeVisible();
  await expect(page.getByText('Inativa')).toBeVisible();
});

test('esgotar um item usa a rota de disponibilidade e não some com a linha', async ({ page }) => {
  await abrirCardapio(page);

  const linha = page.getByTestId('product-row-prod-1');
  const interruptor = linha.getByRole('switch');
  await expect(interruptor).toHaveAttribute('aria-checked', 'true');

  await interruptor.click();

  await expect(interruptor).toHaveAttribute('aria-checked', 'false');
  await expect(linha.getByText('Esgotado')).toBeVisible();
  // O estado é dito uma vez só na linha, não em tag e rótulo ao mesmo tempo.
  await expect(linha.getByText('Esgotado')).toHaveCount(1);

  // A rota certa, com o corpo de um campo só.
  await expect
    .poll(() => api.availabilityCalls())
    .toEqual([{ productId: 'prod-1', isAvailable: false }]);
  expect(api.product('prod-1')?.is_available).toBe(false);
  // Esgotar não desativa: o item continua no cardápio, para voltar a vender.
  expect(api.product('prod-1')?.is_active).toBe(true);

  // E volta.
  await interruptor.click();
  await expect(interruptor).toHaveAttribute('aria-checked', 'true');
  await expect.poll(() => api.availabilityCalls()).toHaveLength(2);
});

test('item inativo esmaece e não oferece o interruptor de disponível', async ({ page }) => {
  await abrirCardapio(page);

  // "Combo Duplo" está inativo E marcado como disponível: são eixos diferentes.
  const inativo = page.getByTestId('product-row-prod-3');
  await expect(inativo).toHaveClass(/item--inactive/);
  await expect(inativo.getByText('Inativo')).toBeVisible();
  await expect(inativo.getByRole('switch')).toHaveCount(0);

  // O item ativo ao lado continua com o interruptor.
  await expect(page.getByTestId('product-row-prod-1').getByRole('switch')).toHaveCount(1);
});

test('reordenar categoria manda a lista completa de ids', async ({ page }) => {
  await abrirCardapio(page);

  await page.getByRole('button', { name: 'Mover Acompanhamentos para cima' }).click();

  await expect.poll(() => api.reorderCalls()).toHaveLength(1);
  const enviado = api.reorderCalls()[0] as string[];

  // A ordem nova...
  expect(enviado).toEqual(['cat-2', 'cat-1', 'cat-3']);
  // ...e, o que mais importa, TODAS as categorias — inclusive a inativa
  // (cat-3), que não foi tocada. Mandar só o que mudou zeraria a posição dela.
  expect(enviado).toHaveLength(api.categories().length);
  expect(enviado).toContain('cat-3');

  // A barra reflete a ordem que o backend devolveu.
  const nomes = await page.locator('.rail__name').allTextContents();
  expect(nomes).toEqual(['Acompanhamentos', 'Lanches', 'Sobremesas']);
});

test('a primeira categoria não tem "mover para cima", nem a última "para baixo"', async ({
  page,
}) => {
  await abrirCardapio(page);

  await expect(page.getByRole('button', { name: 'Mover Lanches para cima' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Mover Sobremesas para baixo' })).toBeDisabled();
  expect(api.reorderCalls()).toHaveLength(0);
});

test('desativar é o caminho: não existe excluir em lugar nenhum', async ({ page }) => {
  await abrirCardapio(page);

  await expect(page.getByRole('button', { name: /excluir|apagar|remover/i })).toHaveCount(0);

  await page.getByRole('button', { name: 'Editar X-Burger Clássico' }).click();
  const dialogo = page.getByRole('dialog');
  await expect(dialogo.getByRole('button', { name: /excluir|apagar|remover/i })).toHaveCount(0);
  await expect(dialogo.getByText(/Não existe excluir item/)).toBeVisible();

  // Desativar o item é o que tira do cardápio.
  await dialogo.getByRole('switch', { name: 'Item ativo' }).click();
  await dialogo.getByRole('button', { name: 'Salvar' }).click();

  await expect.poll(() => api.product('prod-1')?.is_active).toBe(false);
  await expect(page.getByTestId('product-row-prod-1')).toHaveClass(/item--inactive/);
});

test('trocar de categoria troca a lista de itens', async ({ page }) => {
  await abrirCardapio(page);

  // `exact` porque os botões de mover levam o nome da categoria no rótulo.
  await page.getByRole('button', { name: 'Acompanhamentos', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Acompanhamentos' })).toBeVisible();
  await expect(page.getByText('Batata frita M')).toBeVisible();
  await expect(page.getByText('X-Burger Clássico')).toHaveCount(0);
});

test('o tema escolhido sobrevive ao recarregamento', async ({ page }) => {
  await abrirCardapio(page);

  const html = page.locator('html');
  await expect(html).not.toHaveAttribute('data-theme', 'light');

  await page.getByTestId('theme-toggle').click();
  await expect(html).toHaveAttribute('data-theme', 'light');

  await page.reload();
  // Sem flash: o atributo já está lá antes do app montar.
  await expect(html).toHaveAttribute('data-theme', 'light');
});
