/**
 * ============================================================================
 * A ATRIBUIÇÃO — pôr o pedido nas mãos de um entregador
 * ============================================================================
 *
 * A REGRA QUE MAIS IMPORTA: a rota responde **200 mesmo com itens recusados**, e
 * quem decide é o `ok` de cada um. Ler o 200 como sucesso é a forma mais
 * silenciosa de um pedido nunca chegar a ninguém — a tela diria que entregou e
 * o motoboy não teria recebido nada.
 *
 * A SEGUNDA: `GET .../courier` com os dois campos NULOS é 200 e significa
 * "ninguém ainda", que é estado normal. 404 é o pedido fora do escopo. A tela
 * não pode confundir os dois.
 */
import { expect, test, type Page } from '@playwright/test';

import { installFakeApi, LOGIN_EMAIL, LOGIN_PASSWORD, type FakeApi } from './fake-api';
import { escolherFilial } from './seletor';

let api: FakeApi;

test.beforeEach(async ({ page }) => {
  api = await installFakeApi(page);
});

test.afterEach(() => {
  api.stop();
});

async function abrirPedido(page: Page, numero: string) {
  await page.goto('/pedidos');
  await page.getByLabel('E-mail').fill(LOGIN_EMAIL);
  await page.getByLabel('Senha').fill(LOGIN_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/pedidos$/);
  await escolherFilial(page);

  await page.getByTestId(`order-card-${numero}`).click();
  await expect(page.getByTestId('order-panel')).toBeVisible();
}

/*
 * "NINGUÉM AINDA" É ESTADO NORMAL, e a tela diz isso sem alarme: os dois campos
 * nulos são 200, e um pedido em preparo sem entregador é o caso comum das
 * primeiras horas de vida dele.
 */
test('pedido sem entregador diz que ninguém pegou, e não parece erro', async ({ page }) => {
  await abrirPedido(page, '1002');

  await expect(page.getByTestId('pedido-entregador-ninguem')).toBeVisible();
  await expect(page.getByTestId('pedido-entregador-erro')).toHaveCount(0);
});

/*
 * ============================================================================
 * O BOTÃO NÃO É OFERECIDO ONDE A RESPOSTA SERIA "NÃO"
 * ============================================================================
 *
 * `not_delivery` é uma das quatro recusas do contrato, e a tela sabe prevê-la
 * olhando o próprio pedido. Oferecer o botão para depois explicar que "retirada
 * não tem entregador" é pior que não oferecê-lo: o lojista clica, lê, e aprende
 * que o painel promete o que não cumpre.
 */
test('pedido de RETIRADA não tem o bloco de entregador', async ({ page }) => {
  await abrirPedido(page, '1003');

  await expect(page.getByTestId('pedido-entregador')).toHaveCount(0);
});

test('atribuir manda o lote de um item, e a tela passa a mostrar quem está com ele', async ({
  page,
}) => {
  await abrirPedido(page, '1002');

  await page.getByTestId('pedido-entregador-seletor').click();
  await page.getByRole('option', { name: 'Jorge Lima' }).click();
  await page.getByTestId('pedido-entregador-atribuir').click();

  await expect(page.getByTestId('pedido-entregador-atual')).toContainText('Jorge Lima');

  /*
   * A ESCRITA VAI PELA ROTA DE LOTE mesmo com um pedido só — é o que mantém o
   * caminho por-item exercitado desde o primeiro dia.
   */
  const lote = api.assignPosts().at(-1)!;
  expect(lote.orderIds).toEqual(['ord-1002']);
  expect(lote.courierId).toBe('ent-jorge');
});

/*
 * REATRIBUIR É A MESMA CHAMADA com outro entregador — não há rota de troca. A
 * anterior é fechada e a nova aberta, com a taxa de agora.
 */
test('passar para outro entregador é uma chamada só, e a tela troca o nome', async ({ page }) => {
  api.setAssignment('ord-1002', 'ent-jorge');
  await abrirPedido(page, '1002');
  await expect(page.getByTestId('pedido-entregador-atual')).toContainText('Jorge Lima');

  await page.getByTestId('pedido-entregador-seletor').click();
  await page.getByRole('option', { name: 'Ana Souza' }).click();
  await page.getByTestId('pedido-entregador-atribuir').click();

  await expect(page.getByTestId('pedido-entregador-atual')).toContainText('Ana Souza');
  expect(api.assignPosts().at(-1)!.courierId).toBe('ent-ana');
});

/*
 * QUEM JÁ ESTÁ COM O PEDIDO SAI DA LISTA. Atribuir ao mesmo é no-op no backend,
 * então não haveria estrago — mas oferecê-lo é oferecer um "Passar" que não
 * passa nada, e o lojista fica esperando uma mudança que não vem.
 */
test('quem já está com o pedido não aparece entre as opções', async ({ page }) => {
  api.setAssignment('ord-1002', 'ent-jorge');
  await abrirPedido(page, '1002');

  await page.getByTestId('pedido-entregador-seletor').click();
  await expect(page.getByRole('option', { name: 'Jorge Lima' })).toHaveCount(0);
  await expect(page.getByRole('option', { name: 'Ana Souza' })).toBeVisible();
});

/*
 * SÓ OS ATIVOS SÃO OFERECIDOS: entregador inativo é 409 na atribuição, e é a
 * terceira recusa que a tela consegue prever sozinha. A Rita está desativada na
 * semente.
 */
test('entregador desativado não é oferecido', async ({ page }) => {
  await abrirPedido(page, '1002');

  await page.getByTestId('pedido-entregador-seletor').click();
  await expect(page.getByRole('option', { name: 'Rita Alves' })).toHaveCount(0);
});

test('tirar o pedido devolve a linha para "ninguém pegou"', async ({ page }) => {
  api.setAssignment('ord-1002', 'ent-jorge');
  await abrirPedido(page, '1002');

  await page.getByTestId('pedido-entregador-tirar').click();

  await expect(page.getByTestId('pedido-entregador-ninguem')).toBeVisible();
  await expect(page.getByTestId('pedido-entregador-atual')).toHaveCount(0);
});

/*
 * TIRAR SÓ EXISTE QUANDO ALGUÉM ESTÁ COM ELE. O 409 desta rota é exatamente
 * "ninguém está" — oferecer o botão sem ninguém seria fabricar esse 409.
 */
test('sem ninguém com o pedido, não há o que tirar', async ({ page }) => {
  await abrirPedido(page, '1002');

  await expect(page.getByTestId('pedido-entregador-tirar')).toHaveCount(0);
});

/*
 * ============================================================================
 * AS RECUSAS
 * ============================================================================
 */

/*
 * O 409 DE "NINGUÉM ESTÁ COM ELE" é clique repetido ou tela velha, e o contrato
 * diz isso. A tela mostra a frase do backend E RELÊ — porque a segunda leitura
 * é o que desfaz a tela velha.
 */
test('desatribuir o que já saiu mostra a recusa e recarrega o estado', async ({ page }) => {
  api.setAssignment('ord-1002', 'ent-jorge');
  await abrirPedido(page, '1002');

  await page.route('**/admin/orders/*/courier', (route) => {
    if (route.request().method() !== 'DELETE') return route.fallback();
    return route.fulfill({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'Este pedido não está atribuído a nenhum entregador.' }),
    });
  });

  await page.getByTestId('pedido-entregador-tirar').click();

  await expect(page.getByTestId('pedido-entregador-recusa')).toContainText('não está atribuído');
});

/*
 * 200 COM O ITEM RECUSADO. É o caso que o contrato inteiro existe para tratar:
 * a chamada "deu certo" do ponto de vista HTTP, e o pedido não foi para
 * ninguém. A tela precisa dizer isso, e a frase sai do CÓDIGO.
 */
test('lote que volta 200 com o item recusado NÃO é sucesso', async ({ page }) => {
  await abrirPedido(page, '1002');

  await page.route('**/admin/couriers/*/assignments', (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [{ order_id: 'ord-1002', ok: false, error: 'order_closed', assignment: null }],
      }),
    });
  });

  await page.getByTestId('pedido-entregador-seletor').click();
  await page.getByRole('option', { name: 'Jorge Lima' }).click();
  await page.getByTestId('pedido-entregador-atribuir').click();

  await expect(page.getByTestId('pedido-entregador-recusa')).toContainText('já terminou');
  // E a tela NÃO passa a dizer que alguém está com ele.
  await expect(page.getByTestId('pedido-entregador-atual')).toHaveCount(0);
});

test('a frase de "não está na sua lista" não vira oráculo de UUID', async ({ page }) => {
  await abrirPedido(page, '1002');

  await page.route('**/admin/couriers/*/assignments', (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [{ order_id: 'ord-1002', ok: false, error: 'not_found', assignment: null }],
      }),
    });
  });

  await page.getByTestId('pedido-entregador-seletor').click();
  await page.getByRole('option', { name: 'Jorge Lima' }).click();
  await page.getByTestId('pedido-entregador-atribuir').click();

  const recusa = page.getByTestId('pedido-entregador-recusa');
  await expect(recusa).toContainText('não está na sua lista');
  await expect(recusa).not.toContainText('outro restaurante');
});

/*
 * A LEITURA QUE FALHOU NÃO VIRA "NINGUÉM AINDA". Dizer que o pedido está parado
 * esperando alguém, sobre um pedido que JÁ saiu, manda o lojista atribuir de
 * novo — e dois motoboys para o mesmo endereço.
 */
test('sem saber quem está com o pedido, a tela não afirma que é ninguém', async ({ page }) => {
  await page.route('**/admin/orders/*/courier', (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return route.abort();
  });

  await abrirPedido(page, '1002');

  await expect(page.getByTestId('pedido-entregador-erro')).toBeVisible();
  await expect(page.getByTestId('pedido-entregador-ninguem')).toHaveCount(0);
});
