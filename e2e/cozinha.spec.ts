/**
 * E2E da Cozinha.
 *
 * A tela existe para ser lida de longe e tocada uma vez por pedido. Os testes
 * daqui protegem as três decisões que a definem: só os três estados da cozinha,
 * pedido não pago fora da tela, e um botão por cartão que leva ao destino certo
 * conforme o tipo do pedido.
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

async function abrirCozinha(page: Page) {
  await page.goto('/pedidos');
  await page.getByLabel('E-mail').fill(LOGIN_EMAIL);
  await page.getByLabel('Senha').fill(LOGIN_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/pedidos$/);

  await page.getByRole('link', { name: 'Cozinha' }).click();
  await expect(page).toHaveURL(/\/cozinha$/);
}

test('a cozinha é tela cheia: sem sidebar, sem filtros e sem busca', async ({ page }) => {
  await abrirCozinha(page);

  await expect(page.getByRole('heading', { name: 'Cozinha' })).toBeVisible();

  // Sem navegação lateral: a tela é um monitor de parede, não uma aba do painel.
  await expect(page.getByRole('navigation', { name: 'Seções do painel' })).toHaveCount(0);
  // Sem filtro de período, sem busca e sem seletor de filial.
  await expect(page.getByLabel('Período')).toHaveCount(0);
  await expect(page.getByPlaceholder('Número do pedido ou nome do cliente')).toHaveCount(0);
  await expect(page.getByTestId('branch-selector')).toHaveCount(0);

  // A saída existe, e é a única.
  await page.getByRole('link', { name: 'Sair da cozinha' }).click();
  await expect(page).toHaveURL(/\/pedidos$/);
});

/*
 * O cronômetro é a informação nº 1 de uma tela de cozinha, e a régua dele é a
 * faixa de preparo da filial — a MESMA que a barra de pedidos ajusta. Se fossem
 * dois números, a cozinha ficaria tranquila enquanto o cliente já esperava além
 * do combinado. No falso a faixa é 25–35 min.
 */
test('o cartão conta a espera e acende quando passa do preparo da filial', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(LOGIN_EMAIL);
  await page.getByLabel('Senha').fill(LOGIN_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/pedidos$/);

  // A faixa é POR FILIAL: sem uma escolhida não há régua, e nada acende.
  await escolherFilial(page);
  await page.getByRole('link', { name: 'Cozinha' }).click();

  // ord-1003 entrou há 25 min: já está na janela de entrega, ainda não estourou.
  await expect(page.getByTestId('kitchen-wait-1003')).toHaveText('25 min');
  await expect(page.getByTestId('kitchen-card-1003')).toHaveAttribute('data-wait', 'due');

  // O `await` espera a conexão do SSE existir antes de gravar o evento — ver
  // `esperarConexaoDaTelaAtual` em `fake-api.ts`.
  await api.pushNewOrder(
    api.makeOrder({
      id: 'ord-3001',
      order_number: 3001,
      status: 'accepted',
      payment_status: 'paid',
      // 90min30s, e não 90 exatos: entre montar este ISO e a tela renderizar
      // passam alguns segundos, e o arredondamento para baixo faria "1h30"
      // virar "1h29" de vez em quando. A meia sobra deixa o minuto estável.
      created_at: new Date(Date.now() - (90 * 60_000 + 30_000)).toISOString(),
    }),
  );

  // 90 min contra um máximo de 35: estourou, e é o único elemento que grita.
  await expect(page.getByTestId('kitchen-card-3001')).toHaveAttribute('data-wait', 'late');
  await expect(page.getByTestId('kitchen-wait-3001')).toHaveText('1h30');

  // O atraso é da ETIQUETA de tempo, não do cartão: a borda esquerda continua
  // com a matiz do status, que é o que diz em que etapa o prato está.
  await expect(page.getByTestId('kitchen-card-3001')).toHaveAttribute('data-status', 'accepted');
});

test('sem filial escolhida a cozinha conta o tempo, mas não acusa atraso', async ({ page }) => {
  // Sem filial não há faixa de preparo, e sem régua não existe atraso a
  // declarar. Inventar um limite padrão pintaria de vermelho a cozinha inteira
  // de quem ainda não configurou o prazo — alarme sempre ligado não é alarme.
  await abrirCozinha(page);

  await expect(page.getByTestId('kitchen-wait-1003')).toHaveText('25 min');
  await expect(page.getByTestId('kitchen-card-1003')).toHaveAttribute('data-wait', 'ok');
});

test('mostra só Aceito, Preparando e Pronto', async ({ page }) => {
  await abrirCozinha(page);

  await expect(page.getByTestId('kitchen-column-accepted')).toBeVisible();
  await expect(page.getByTestId('kitchen-column-preparing')).toBeVisible();
  await expect(page.getByTestId('kitchen-column-ready')).toBeVisible();

  // Pendente ainda não foi aceito; concluído já saiu da cozinha.
  await expect(page.getByTestId('kitchen-column-pending')).toHaveCount(0);
  await expect(page.getByTestId('kitchen-column-completed')).toHaveCount(0);

  // 1003 está em "preparando" no falso e aparece; 1002 está pendente e não.
  await expect(page.getByTestId('kitchen-card-1003')).toBeVisible();
  await expect(page.getByTestId('kitchen-card-1002')).toHaveCount(0);
});

test('pedido com pagamento online não confirmado não aparece', async ({ page }) => {
  /*
   * 1001 é Pix ainda não pago. Ele não pode aparecer nem esmaecido nem travado:
   * montar o prato antes de o dinheiro entrar é prejuízo, e o backend recusaria
   * a transição de qualquer forma.
   */
  api.setStatusFromAnotherUser('ord-1001', 'preparing');

  await abrirCozinha(page);

  await expect(page.getByTestId('kitchen-card-1003')).toBeVisible();
  await expect(page.getByTestId('kitchen-card-1001')).toHaveCount(0);
});

test('o cartão traz os itens e os adicionais agrupados', async ({ page }) => {
  await abrirCozinha(page);

  const cartao = page.getByTestId('kitchen-card-1003');
  await expect(cartao).toContainText('Pizza Calabresa G');
  await expect(cartao).toContainText('Filé à parmegiana');

  // É o grupo que separa a TROCA de acompanhamento da PORÇÃO EXTRA — e é aqui,
  // na cozinha, que confundir os dois vira o prato errado.
  await expect(
    cartao.locator('.kitchen-options__group', { hasText: 'Acompanhamento' }),
  ).toContainText('Espaguete');
  await expect(cartao.locator('.kitchen-options__group', { hasText: 'Adicional' })).toContainText(
    'Bacon',
  );

  // Observação do item é instrução para a chapa e precisa estar visível.
  await expect(cartao).toContainText('Borda recheada');

  // O que é do balcão não entra: cliente, telefone, pagamento e total.
  await expect(cartao).not.toContainText('Rafael Nunes');
  await expect(cartao).not.toContainText('R$');
});

test('um botão por cartão avança o pedido', async ({ page }) => {
  await abrirCozinha(page);

  // 1003 está em "preparando": o único caminho adiante é "pronto".
  const cartao = page.getByTestId('kitchen-card-1003');
  await expect(cartao.getByRole('button')).toHaveCount(1);

  await page.getByTestId('kitchen-advance-1003').click();

  // O cartão muda de coluna, e o botão passa a oferecer o próximo passo. Como
  // 1003 é retirada, o destino é "entregue ao cliente", não "saiu para entrega".
  await expect(
    page.getByTestId('kitchen-column-ready').getByTestId('kitchen-card-1003'),
  ).toBeVisible();
  await expect(page.getByTestId('kitchen-advance-1003')).toContainText('Entregue ao cliente');
  expect(api.orders.find((item) => item.id === 'ord-1003')?.status).toBe('ready');
});

test('pedido de entrega em Pronto sai para o entregador', async ({ page }) => {
  api.setStatusFromAnotherUser('ord-1002', 'ready');

  await abrirCozinha(page);

  // 1002 é entrega e paga na entrega: aparece, e o destino é o entregador.
  await expect(page.getByTestId('kitchen-advance-1002')).toContainText('Saiu para entrega');

  await page.getByTestId('kitchen-advance-1002').click();

  // Fora dos três estados da cozinha, o cartão desaparece da tela.
  await expect(page.getByTestId('kitchen-card-1002')).toHaveCount(0);
  expect(api.orders.find((item) => item.id === 'ord-1002')?.status).toBe('out_for_delivery');
});

test('pedido novo aceito chega sozinho pelo SSE', async ({ page }) => {
  await abrirCozinha(page);
  // A coluna carregada é o sinal de que a tela está de pé. O rótulo "Tempo real
  // ligado" não serve de âncora: no falso, a conexão só é atendida quando há
  // evento, então ela fica legitimamente em "Reconectando…" até o primeiro.
  await expect(page.getByTestId('kitchen-card-1003')).toBeVisible();

  /*
   * E A COLUNA CARREGADA TAMBÉM NÃO BASTA: ela prova que a LISTA chegou, não
   * que o SSE já está pendurado. Um evento empurrado antes disso nasce atrás do
   * cursor da conexão que ainda vai chegar e não é entregue a ninguém.
   *
   * ESTE TESTE É O QUE PEGOU O DEFEITO, e o motivo de ser o único é que só ele
   * empurra um evento logo depois de TROCAR DE TELA: a conexão de /pedidos fica
   * pendurada no falso por até 15s depois de o navegador tê-la fechado, e era
   * ELA que satisfazia a espera antiga, no lugar da conexão da Cozinha. Ver
   * `state.streamVivas` em `fake-api.ts`.
   */
  await api.pushNewOrder(
    api.makeOrder({
      id: 'ord-2001',
      order_number: 2001,
      status: 'accepted',
      payment_status: 'paid',
      customer_name_snapshot: 'Bruna Alves',
    }),
  );

  await expect(page.getByTestId('kitchen-card-2001')).toBeVisible();
  await expect(page.getByTestId('kitchen-column-accepted')).toContainText('2001');
});
