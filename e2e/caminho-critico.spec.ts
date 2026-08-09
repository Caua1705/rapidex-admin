/**
 * E2E do caminho crítico: login → ver o pedido → mudar o status.
 *
 * É o que o lojista faz dezenas de vezes por dia. Se isto passar, o painel
 * está de pé; o resto é detalhe. Os outros testes deste arquivo cobrem os três
 * jeitos de a tela enganar o lojista: pedido não pago liberado para a cozinha,
 * transição que o backend recusa, e sessão que caiu sem avisar.
 */
import { expect, test, type Page } from '@playwright/test';

import {
  installFakeApi,
  FAKE_BRANCH,
  FAKE_BRANCH_2,
  LOGIN_EMAIL,
  LOGIN_PASSWORD,
  type FakeApi,
} from './fake-api';

let api: FakeApi;

test.beforeEach(async ({ page }) => {
  api = await installFakeApi(page);
});

test.afterEach(() => {
  api.stop();
});

async function fazerLogin(page: Page) {
  await page.goto('/pedidos');
  // Guarda de rota: sem token, ninguém vê o quadro.
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel('E-mail').fill(LOGIN_EMAIL);
  await page.getByLabel('Senha').fill(LOGIN_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page).toHaveURL(/\/pedidos$/);
}

test('login, abrir o pedido e mudar o status', async ({ page }) => {
  await fazerLogin(page);

  // O topo identifica de quem é a sessão.
  const barraDoTopo = page.locator('.shell__bar');
  await expect(barraDoTopo).toContainText('Pizzaria do Zé — Aldeota');
  await expect(barraDoTopo).toContainText('Joana Souza');

  // O quadro abriu com os pedidos nas colunas certas e o badge do backend.
  await expect(page.getByTestId('badge-pending')).toHaveText('2');
  await expect(page.getByTestId('badge-preparing')).toHaveText('1');
  await expect(
    page.locator('[data-column="pending"] [data-testid="order-card-1002"]'),
  ).toBeVisible();

  // Abre o detalhe do pedido 1002.
  await page.getByTestId('order-card-1002').click();
  const painel = page.getByTestId('order-panel');
  await expect(painel.getByText('Pizza Calabresa G')).toBeVisible();
  await expect(painel.getByText('Sem cebola, por favor.')).toBeVisible();
  await expect(painel.getByText(/Rua das Flores, 123/)).toBeVisible();
  await expect(painel.getByRole('heading', { name: 'Histórico' })).toBeVisible();

  // Aceita o pedido. O backend é quem valida a transição.
  await painel.getByTestId('change-status-accepted').click();

  // O histórico do detalhe recarregado já mostra a linha nova.
  await expect(painel.getByText('Joana Souza')).toBeVisible();

  await page.getByRole('button', { name: 'Fechar' }).click();

  // E o card mudou de coluna sem precisar recarregar a página.
  await expect(
    page.locator('[data-column="accepted"] [data-testid="order-card-1002"]'),
  ).toBeVisible();
  await expect(page.locator('[data-column="pending"] [data-testid="order-card-1002"]')).toHaveCount(
    0,
  );
});

/*
 * O detalhe deixou de ser janela: aberto, ele escondia justamente as colunas
 * que dizem o que fazer em seguida.
 */
test('o detalhe é painel lateral: o quadro fica visível e o conteúdo troca', async ({ page }) => {
  await fazerLogin(page);

  const painel = page.getByTestId('order-panel');

  // Sem seleção, o painel já está lá com o estado vazio.
  await expect(painel).toContainText('Nenhum pedido aberto');

  await page.getByTestId('order-card-1002').click();
  await expect(painel).toContainText('#1002');
  // O quadro continua na tela, com as colunas todas.
  await expect(page.locator('[data-column="pending"]')).toBeVisible();
  await expect(page.locator('[data-column="preparing"]')).toBeVisible();

  // Clicar em outro card TROCA o conteúdo, sem fechar nada no meio.
  await page.getByTestId('order-card-1003').click();
  await expect(painel).toContainText('#1003');
  await expect(painel).toContainText('Rafael Nunes');
  await expect(painel).not.toContainText('#1002');

  // Fechar volta ao estado vazio, e o quadro nunca saiu do lugar.
  await page.getByRole('button', { name: 'Fechar' }).click();
  await expect(painel).toContainText('Nenhum pedido aberto');
  await expect(page.getByTestId('order-card-1003')).toBeVisible();
});

/*
 * O grupo é o que dá sentido à escolha: "espaguete" em "Acompanhamento" é a
 * troca do que vem no prato; em "Adicional" é uma porção a mais. Achatado, a
 * cozinha monta o prato errado.
 */
test('os adicionais aparecem recuados e agrupados por grupo', async ({ page }) => {
  await fazerLogin(page);
  await page.getByTestId('order-card-1002').click();

  const painel = page.getByTestId('order-panel');
  await expect(painel.getByText('Filé à parmegiana')).toBeVisible();

  const acompanhamento = painel.locator('.options__group', { hasText: 'Acompanhamento' });
  const adicional = painel.locator('.options__group', { hasText: 'Adicional' });
  await expect(acompanhamento.getByText('Espaguete')).toHaveCount(1);
  await expect(adicional.getByText('Espaguete')).toHaveCount(1);
  await expect(adicional.getByText('Bacon')).toHaveCount(1);

  // O preço do adicional aparece só para conferência...
  await expect(adicional).toContainText('12,00');
  // ...e NÃO entra no total: o unit_price_snapshot já o inclui. 45 + 79 = 124,
  // que é o total do pedido — somar os adicionais daria 141.
  await expect(painel.locator('.detail__row--total')).toContainText('124,00');

  // E o aviso de que os adicionais não vinham no contrato saiu da tela.
  await expect(painel).not.toContainText('não vêm no contrato');
});

test('pedido com pagamento online não confirmado fica destacado e travado', async ({ page }) => {
  await fazerLogin(page);

  const cardNaoPago = page.getByTestId('order-card-1001');
  await expect(cardNaoPago).toHaveClass(/order-card--unpaid/);
  await expect(cardNaoPago).toContainText('não preparar');

  await cardNaoPago.click();
  const painel = page.getByTestId('order-panel');
  await expect(painel.getByText(/A cozinha não pode preparar/)).toBeVisible();
  // O botão de aceitar existe, mas travado: a tela não oferece o que vai falhar.
  await expect(painel.getByTestId('change-status-accepted')).toBeDisabled();
});

test('transição recusada pelo backend vira mensagem clara na tela', async ({ page }) => {
  await fazerLogin(page);

  await page.getByTestId('order-card-1002').click();
  const painel = page.getByTestId('order-panel');
  await expect(painel.getByTestId('change-status-accepted')).toBeEnabled();

  // Outro atendente aceitou o mesmo pedido enquanto este estava com o detalhe
  // aberto. O clique agora é uma transição inválida — e o backend recusa.
  api.setStatusFromAnotherUser('ord-1002', 'accepted');
  await painel.getByTestId('change-status-accepted').click();

  await expect(painel.getByTestId('status-error')).toContainText(
    'Não é possível mudar de "Aceito" para "Aceito"',
  );
});

test('pedido novo chega sozinho pelo SSE', async ({ page }) => {
  await fazerLogin(page);
  await expect(page.getByTestId('order-card-1002')).toBeVisible();

  api.pushNewOrder(
    api.makeOrder({
      id: 'ord-1010',
      order_number: 1010,
      customer_name_snapshot: 'Cliente do Stream',
      created_at: new Date().toISOString(),
    }),
  );

  await expect(
    page.locator('[data-column="pending"] [data-testid="order-card-1010"]'),
  ).toBeVisible();
  await expect(page.getByText('Cliente do Stream')).toBeVisible();
});

/*
 * A filial saiu da barra de filtros e virou o seletor do cabeçalho, que vale
 * para o painel inteiro. Este teste é o que garante que ele continua sendo um
 * FILTRO de verdade, e não só um rótulo bonito com nome e endereço.
 */
test('o seletor de filial do cabeçalho filtra o quadro', async ({ page }) => {
  await fazerLogin(page);

  const seletor = page.getByTestId('branch-selector');
  await expect(seletor).toContainText('Pizzaria do Zé — Aldeota');
  await expect(seletor).toContainText('Todas as filiais');
  await expect(page.getByTestId('order-card-1002')).toBeVisible();

  // A barra de filtros não tem mais campo de filial: um só lugar decide isso.
  await expect(page.locator('.toolbar').getByLabel('Filial')).toHaveCount(0);

  const requisicao = page.waitForRequest(
    (request) =>
      request.url().includes('/admin/orders?') &&
      request.url().includes(`branch_id=${FAKE_BRANCH_2.id}`),
  );
  await page.selectOption('.branch__select', FAKE_BRANCH_2.id);
  await requisicao;

  // O endereço da filial escolhida entra no lugar de "todas".
  await expect(seletor).toContainText('Pizzaria do Zé — Zona Norte');
  await expect(seletor).toContainText('Av. Brasil, 900');

  // Os pedidos são todos da matriz, então o quadro da outra filial fica vazio.
  await expect(page.getByTestId('order-card-1002')).toHaveCount(0);
});

/*
 * Cancelar é a única ação da tela que apaga trabalho já feito e não tem
 * desfazer. O motivo é obrigatório porque, sem ele, ninguém consegue dizer no
 * dia seguinte se foi o cliente que desistiu ou a cozinha que não deu conta.
 */
test('cancelar exige motivo e grava o que foi escrito', async ({ page }) => {
  await fazerLogin(page);
  await page.getByTestId('order-card-1002').click();

  const painel = page.getByTestId('order-panel');
  await painel.getByTestId('change-status-cancelled').click();

  // O clique não cancelou nada ainda: abriu a confirmação.
  const confirmacao = page.getByRole('dialog');
  await expect(confirmacao).toContainText('Cancelar o pedido #1002?');
  await expect(confirmacao).toContainText('Esta ação não pode ser desfeita.');
  expect(api.cancelReasons()).toHaveLength(0);

  // Motivo vazio e motivo curto demais mantêm o botão travado.
  const confirmar = confirmacao.getByTestId('confirm-cancel');
  await expect(confirmar).toBeDisabled();
  await confirmacao.getByLabel('Motivo do cancelamento').fill('ok');
  await expect(confirmar).toBeDisabled();

  await confirmacao.getByLabel('Motivo do cancelamento').fill('Cliente desistiu por telefone.');
  await expect(confirmar).toBeEnabled();
  await confirmar.click();

  await expect
    .poll(() => api.cancelReasons())
    .toEqual([{ orderId: 'ord-1002', reason: 'Cliente desistiu por telefone.' }]);

  // O card foi para a coluna de encerrados e o motivo entrou no histórico.
  await expect(
    page.locator('[data-column="closed"] [data-testid="order-card-1002"]'),
  ).toBeVisible();
  await expect(painel.getByText('Cliente desistiu por telefone.')).toBeVisible();
});

test('cancelar recusado pelo backend mostra o erro sem fechar a confirmação', async ({ page }) => {
  await fazerLogin(page);
  await page.getByTestId('order-card-1002').click();
  await page.getByTestId('order-panel').getByTestId('change-status-cancelled').click();

  // Outro atendente concluiu o pedido enquanto a confirmação estava aberta.
  api.setStatusFromAnotherUser('ord-1002', 'completed');

  const confirmacao = page.getByRole('dialog');
  await confirmacao.getByLabel('Motivo do cancelamento').fill('Cliente desistiu.');
  await confirmacao.getByTestId('confirm-cancel').click();

  await expect(confirmacao.getByTestId('cancel-error')).toContainText('estado final');
  // Continua aberta: o lojista precisa ver o que aconteceu antes de sair.
  await expect(confirmacao).toBeVisible();
});

test('ajustar o tempo de preparo usa a faixa que a resposta devolveu', async ({ page }) => {
  await fazerLogin(page);

  // Sem filial escolhida não há o que ajustar — os botões ficam travados.
  await expect(page.getByTestId('prep-time-mais-5')).toBeDisabled();

  await page.selectOption('.branch__select', FAKE_BRANCH.id);
  await expect(page.getByTestId('prep-time-mais-5')).toBeEnabled();

  await page.getByTestId('prep-time-mais-10').click();
  // 25–35 + 10, direto da resposta: nenhuma segunda chamada para reler.
  await expect(page.getByTestId('prep-time-range')).toHaveText('35–45 min');

  await page.getByTestId('prep-time-menos-5').click();
  await expect(page.getByTestId('prep-time-range')).toHaveText('30–40 min');
  expect(api.prepTimeOf(FAKE_BRANCH.id)).toEqual({ min: 30, max: 40 });
});

test('sem faixa base gravada, a tela pede min e max uma vez', async ({ page }) => {
  await fazerLogin(page);
  api.clearPrepTimeBase(FAKE_BRANCH.id);

  await page.selectOption('.branch__select', FAKE_BRANCH.id);
  await page.getByTestId('prep-time-mais-5').click();

  const base = page.getByTestId('prep-time-base');
  await expect(base).toContainText('ainda não tem tempo de preparo gravado');

  await base.getByLabel('Mínimo (min)').fill('20');
  await base.getByLabel('Máximo (min)').fill('30');
  await base.getByRole('button', { name: 'Salvar faixa' }).click();

  await expect(page.getByTestId('prep-time-range')).toHaveText('20–30 min');
  expect(api.prepTimeOf(FAKE_BRANCH.id)).toEqual({ min: 20, max: 30 });
});

/*
 * O 409 de filial fechada NÃO pode cair no mesmo caminho do 409 de base
 * faltando: abrir o campo de min/max aqui faria o lojista preencher a faixa
 * achando que resolveu, e levar outro 409.
 */
test('filial fechada mostra a mensagem e não oferece contorno', async ({ page }) => {
  await fazerLogin(page);
  api.closeBranch(FAKE_BRANCH.id);

  await page.selectOption('.branch__select', FAKE_BRANCH.id);
  await page.getByTestId('prep-time-mais-5').click();

  await expect(page.getByTestId('prep-time-error')).toContainText('A filial está fechada agora');
  await expect(page.getByTestId('prep-time-base')).toHaveCount(0);
  await expect(page.getByTestId('prep-time-range')).toHaveText('—');
});

test('401 em qualquer chamada limpa a sessão e volta ao login', async ({ page }) => {
  await fazerLogin(page);
  await expect(page.getByTestId('order-card-1002')).toBeVisible();

  // Token vencido no servidor: a próxima chamada responde 401.
  api.expireSession();
  await page.getByRole('button', { name: 'Atualizar' }).click();

  await expect(page).toHaveURL(/\/login$/);

  // E a sessão foi apagada mesmo: recarregar não volta para o quadro.
  await page.goto('/pedidos');
  await expect(page).toHaveURL(/\/login$/);
});
