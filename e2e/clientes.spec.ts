/**
 * E2E de Clientes.
 *
 * A tela é de leitura pura, então não há gravação para conferir. O que ela tem
 * de errar em silêncio é outra coisa: mostrar a lista errada depois de uma
 * busca, mentir sobre o recorte de filial, ou desenhar uma linha em branco
 * para o cliente que comprou sem dizer o nome.
 */
import { expect, test, type Page } from '@playwright/test';

import { installFakeApi, FAKE_BRANCH_2, LOGIN_EMAIL, LOGIN_PASSWORD, type FakeApi } from './fake-api';
import { escolherFilial } from './seletor';

let api: FakeApi;

test.beforeEach(async ({ page }) => {
  api = await installFakeApi(page);
});

test.afterEach(() => {
  api.stop();
});

async function abrirClientes(page: Page) {
  await page.goto('/clientes');
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel('E-mail').fill(LOGIN_EMAIL);
  await page.getByLabel('Senha').fill(LOGIN_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();

  await page.getByRole('link', { name: 'Clientes' }).click();
  await expect(page).toHaveURL(/\/clientes$/);
  await expect(page.getByRole('heading', { name: 'Clientes', level: 1 })).toBeVisible();
}

/*
 * O ITEM DEIXOU DE SER "EM BREVE".
 *
 * A lateral lê `nav.ts`, e o campo `soon` é o que decide as duas coisas ao
 * mesmo tempo: a etiqueta na lateral e a rota cair na página de estado. Se
 * alguém devolver o campo, este teste é o que avisa — sem ele, a tela
 * continuaria construída e inalcançável.
 */
test('Clientes é uma tela de verdade, não mais uma página "em breve"', async ({ page }) => {
  await abrirClientes(page);

  await expect(page.getByTestId('coming-soon')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Clientes\s+Em breve/ })).toHaveCount(0);
});

test('lista quem já comprou, com quanto gastou e há quanto tempo', async ({ page }) => {
  await abrirClientes(page);

  const ana = page.getByRole('row').filter({ hasText: 'Ana Paula' });
  await expect(ana).toContainText('(85) 99999-0000');
  await expect(ana).toContainText('12');
  await expect(ana).toContainText('R$ 748,50');
  // Último pedido é DISTÂNCIA, não data: é assim que se acha quem sumiu.
  await expect(ana).toContainText('hoje');

  const marcos = page.getByRole('row').filter({ hasText: 'Marcos Lima' });
  await expect(marcos).toContainText('há 3 meses');
});

/*
 * Cliente que compra no balcão sem se identificar existe, e o contrato deixa
 * `customer_name` vir vazio. A linha não pode sair em branco: quem lê acha que
 * a tela falhou em carregar.
 */
test('cliente sem nome cadastrado é nomeado, não some', async ({ page }) => {
  await abrirClientes(page);

  const semNome = page.getByRole('row').filter({ hasText: '(85) 97777-6666' });
  await expect(semNome).toContainText('Sem nome');
});

/* O fixo de 10 dígitos e o celular de 11 têm agrupamentos diferentes. */
test('telefone fixo sai agrupado como fixo', async ({ page }) => {
  await abrirClientes(page);

  await expect(page.getByRole('row').filter({ hasText: 'Rafael Nunes' })).toContainText(
    '(85) 3222-4444',
  );
});

test('a busca filtra por nome e por telefone, com o mesmo campo', async ({ page }) => {
  await abrirClientes(page);
  const busca = page.getByLabel('Buscar cliente por nome ou telefone');

  await busca.fill('marcos');
  await expect(page.getByRole('row').filter({ hasText: 'Marcos Lima' })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'Ana Paula' })).toHaveCount(0);

  // O MESMO campo aceita telefone — é um termo só, dois critérios, como a rota
  // descreve. Buscar só por nome deixaria metade do contrato sem cobertura.
  await busca.fill('3222');
  await expect(page.getByRole('row').filter({ hasText: 'Rafael Nunes' })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'Marcos Lima' })).toHaveCount(0);
});

test('busca sem resultado diz o termo, e não some com a tela', async ({ page }) => {
  await abrirClientes(page);

  await page.getByLabel('Buscar cliente por nome ou telefone').fill('zzzzz');
  await expect(page.getByText(/Nenhum cliente encontrado para .zzzzz./)).toBeVisible();
});

/*
 * O SELETOR DO TOPO FUNCIONA NESTA TELA.
 *
 * `/admin/customers` aceita `branch_id` em query, então trocar de filial no
 * cabeçalho tem que trocar a lista. Este é o teste que separa "a tela lê o
 * seletor" de "a tela ignora o seletor e mostra tudo sempre" — os dois parecem
 * iguais enquanto só houver uma filial na tela.
 */
test('trocar de filial no topo troca a lista', async ({ page }) => {
  await abrirClientes(page);

  await expect(page.getByRole('row').filter({ hasText: 'Ana Paula' })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'Rafael Nunes' })).toBeVisible();

  await escolherFilial(page, FAKE_BRANCH_2);

  // Rafael é o único da Zona Norte no falso.
  await expect(page.getByRole('row').filter({ hasText: 'Rafael Nunes' })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'Ana Paula' })).toHaveCount(0);
  await expect(page.getByText('1 cliente')).toBeVisible();
});

/*
 * A tela não abre o cliente e não leva aos pedidos dele: não existe rota de
 * detalhe, e `/admin/orders` busca por NOME, não por telefone — o link juntaria
 * duas "Ana Paula". Este teste trava a ausência de propósito, para que ela não
 * volte como um link plausível numa rodada distraída.
 */
test('a linha não é clicável: não há rota de detalhe do cliente', async ({ page }) => {
  await abrirClientes(page);

  const ana = page.getByRole('row').filter({ hasText: 'Ana Paula' });
  await expect(ana.getByRole('link')).toHaveCount(0);
  await expect(ana.getByRole('button')).toHaveCount(0);
});
