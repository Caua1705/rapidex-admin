/**
 * E2E DO CASHBACK — as quatro coisas que a tela não pode errar.
 *
 * Não é uma varredura de campos: cada teste aqui guarda uma armadilha que
 * compila, responde 200 e erra dinheiro do lojista.
 *
 *   1. `source` tem TRÊS valores, e `none` não é `enabled: false`;
 *   2. `weekday` 0 é SEGUNDA — o `getDay()` do JS gravaria a terça na segunda;
 *   3. dia ausente de `weekdays` HERDA o base, nunca zero — e a lista
 *      SUBSTITUI a anterior inteira;
 *   4. percentual e dinheiro vão como STRING de duas casas.
 *
 * Mais o que separa esta tela das outras: ler é da gerência, escrever é só do
 * dono, e o aviso de faturamento não é opcional.
 */
import { expect, test, type Page } from '@playwright/test';

import { installFakeApi, FAKE_BRANCH, LOGIN_EMAIL, LOGIN_PASSWORD, type FakeApi } from './fake-api';

let api: FakeApi;

test.beforeEach(async ({ page }) => {
  api = await installFakeApi(page);
});

test.afterEach(() => {
  api.stop();
});

async function entrar(page: Page) {
  await page.goto('/cashback');
  await page.getByLabel('E-mail').fill(LOGIN_EMAIL);
  await page.getByLabel('Senha').fill(LOGIN_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: 'Cashback' })).toBeVisible();
}

function regraDaRede(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cb-rede',
    restaurant_id: 'rest-1',
    branch_id: null,
    enabled: true,
    default_percent: '5.00',
    min_redeem_balance: '10.00',
    expiry_days: 60,
    weekdays: [],
    ...overrides,
  };
}

/* ==========================================================================
 * 1. O AVISO, E A ORIGEM
 * ======================================================================= */

/*
 * O aviso não é resultado de nada que o lojista fez — é a natureza do que esta
 * tela grava. Por isso ele abre a tela em vez de aparecer depois do erro.
 */
test('o aviso de faturamento abre a tela e não depende de nada', async ({ page }) => {
  await entrar(page);
  await expect(page.getByTestId('cashback-aviso')).toContainText('faturamento no mesmo minuto');
  await expect(page.getByTestId('cashback-aviso')).toContainText('base da comissão');
});

/*
 * "NINGUÉM CONFIGUROU" É UMA FRASE, "CONFIGURADO E DESLIGADO" É OUTRA. Os dois
 * caem em SEM_CASHBACK no checkout e só o segundo tem números para mostrar —
 * tratá-los igual esconderia do lojista que ele nunca ligou a campanha.
 */
test('source none diz que ninguém configurou, e o formulário nasce desligado', async ({ page }) => {
  await entrar(page);

  await expect(page.getByTestId('cashback-origem')).toContainText('Nenhuma regra configurada');
  await expect(page.getByTestId('cashback-default-percent')).toHaveValue('');
  await expect(page.getByTestId('cashback-enabled')).toHaveAttribute('aria-checked', 'false');
});

/*
 * A PEÇA QUE SÓ EXISTE PORQUE `source` EXISTE. Sem ela, a filial que herda e a
 * que tem regra própria mostram o mesmo formulário — e quem ajusta a terça
 * "da rede" numa tela de filial na verdade desliga a herança daquela loja.
 */
test('a filial que herda avisa que salvar CRIA uma sobrescrita', async ({ page }) => {
  api.setCashbackRestaurantRule(regraDaRede());
  await entrar(page);

  await page.getByTestId('cashback-escopo-filial').click();
  await expect(page.getByTestId('cashback-origem')).toContainText('Herdando a regra da rede');
  await expect(page.getByTestId('cashback-origem')).toContainText('CRIA uma regra só desta loja');

  // E os valores mostrados são os herdados, não um formulário em branco.
  await expect(page.getByTestId('cashback-default-percent')).toHaveValue('5');

  // Herdando não há sobrescrita a apagar: o botão não é desenhado.
  await expect(page.getByTestId('cashback-apagar')).toHaveCount(0);
});

test('a filial com regra própria oferece voltar a herdar, e volta mesmo', async ({ page }) => {
  api.setCashbackRestaurantRule(regraDaRede());
  api.setCashbackBranchRule(
    FAKE_BRANCH.id,
    regraDaRede({ id: 'cb-fil', default_percent: '12.00' }),
  );
  await entrar(page);

  await page.getByTestId('cashback-escopo-filial').click();
  await expect(page.getByTestId('cashback-origem')).toContainText('regra própria');
  await expect(page.getByTestId('cashback-default-percent')).toHaveValue('12');

  await page.getByTestId('cashback-apagar').click();

  /*
   * ELE ERA UM DELETE DIRETO NO CLIQUE, e o rótulo honesto ("voltar a herdar")
   * era justamente o que escondia o problema: uma frase gentil não é um aviso
   * de que não há volta. A regra própria da filial — percentual, teto, dias e
   * formas de pagamento que geram — é apagada no servidor, e desfazer é
   * redigitar tudo. Numa tela cujo próprio aviso diz que isto mexe em
   * faturamento no mesmo minuto.
   */
  const confirmacao = page.getByRole('dialog');
  await expect(confirmacao).toContainText('Voltar a herdar a regra da rede?');
  await expect(confirmacao).toContainText('é apagada');
  // Nada aconteceu ainda: a filial continua com a regra dela.
  await expect(page.getByTestId('cashback-default-percent')).toHaveValue('12');

  // Sair preserva, e o botão diz o que preserva.
  await confirmacao.getByRole('button', { name: 'Manter a regra própria' }).click();
  await expect(page.getByTestId('cashback-origem')).toContainText('regra própria');
  await expect(page.getByTestId('cashback-default-percent')).toHaveValue('12');

  await page.getByTestId('cashback-apagar').click();
  await page.getByTestId('cashback-apagar-confirm-confirmar').click();

  // Depois do 204 a tela RECARREGA em vez de adivinhar: quem diz o que passou a
  // valer é a resposta, e ela devolve a regra da rede.
  await expect(page.getByTestId('cashback-origem')).toContainText('Herdando a regra da rede');
  await expect(page.getByTestId('cashback-default-percent')).toHaveValue('5');
});

/* ==========================================================================
 * 2 e 3. A SEMANA — o número do dia e o que o campo vazio significa
 * ======================================================================= */

/*
 * A ARMADILHA QUE MAIS CUSTA, e ela é dupla.
 *
 * O dia vai como 1 (terça no backend), não 2 (terça no `getDay()` do JS); e os
 * outros seis dias SAEM do corpo, porque sair do corpo é como se escreve "este
 * dia herda o base". Sete linhas congelariam os sete no valor da caixa.
 */
test('a terça de 10% grava como weekday 1, e os outros seis dias não vão no corpo', async ({
  page,
}) => {
  await entrar(page);

  await page.getByTestId('cashback-enabled').click();
  await page.getByTestId('cashback-default-percent').fill('5');
  await page.getByTestId('cashback-min-redeem').fill('10');
  await page.getByTestId('cashback-dia-1').fill('10');

  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText('Alterações salvas')).toBeVisible();

  const puts = api.cashbackPuts();
  expect(puts).toHaveLength(1);
  expect(puts[0]?.escopo).toBe('rede');
  expect(puts[0]?.body.weekdays).toEqual([{ weekday: 1, percent: '10.00' }]);
});

/*
 * A tela DIZ o que o campo vazio faz. Descobrir isso depois de salvar é
 * descobrir com o cashback dos outros seis dias já desligado — e não haveria
 * erro nenhum para acusar, porque a tela mostraria exatamente o que foi
 * digitado.
 */
test('a grade explica que dia em branco usa o base, e mostra os sete dias', async ({ page }) => {
  await entrar(page);

  await expect(page.getByText('Dia em branco usa o percentual base')).toBeVisible();
  for (const dia of [0, 1, 2, 3, 4, 5, 6]) {
    await expect(page.getByTestId(`cashback-dia-${dia}`)).toBeVisible();
  }
  // Segunda é o primeiro campo da grade, como na tela de horários.
  await expect(page.getByLabel('Segunda-feira')).toBeVisible();
});

/* ==========================================================================
 * 4. DINHEIRO E PERCENTUAL COMO STRING
 * ======================================================================= */

/*
 * `Numeric(5,2)` promete duas casas, e `10.00` como número JSON vira `10.0`.
 * A vírgula que o lojista digita também tem de sobreviver ao caminho.
 */
test('percentual e dinheiro vão como string de duas casas, aceitando vírgula', async ({ page }) => {
  await entrar(page);

  await page.getByTestId('cashback-enabled').click();
  await page.getByTestId('cashback-default-percent').fill('7,5');
  await page.getByTestId('cashback-min-redeem').fill('20');
  await page.getByTestId('cashback-expiry').fill('30');

  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText('Alterações salvas')).toBeVisible();

  expect(api.cashbackPuts()[0]?.body).toMatchObject({
    enabled: true,
    default_percent: '7.50',
    min_redeem_balance: '20.00',
    expiry_days: 30,
  });
});

/* ==========================================================================
 * O TETO DE SANIDADE
 * ======================================================================= */

/*
 * 30% de cashback quebra o restaurante sozinho, e o banco aceita até 100. A
 * recusa é da TELA, e ela é dura: guarda de digitação não é aviso que se
 * atravessa clicando — é o que separa "10" de "100".
 */
test('acima de 30% a tela recusa salvar, e nada é chamado', async ({ page }) => {
  await entrar(page);

  await page.getByTestId('cashback-enabled').click();
  await page.getByTestId('cashback-default-percent').fill('45');
  await page.getByRole('button', { name: 'Salvar' }).click();

  /*
   * O MOTIVO APARECE NOS DOIS LUGARES, e é de propósito: no campo, para dizer
   * QUAL dos onze está errado, e na barra grudada no rodapé, porque o lojista
   * clica em Salvar com a grade da semana na tela e o campo culpado fora dela.
   */
  await expect(page.getByRole('alert').filter({ hasText: /30% é o teto desta tela/ })).toHaveCount(
    2,
  );
  expect(api.cashbackPuts()).toHaveLength(0);
});

/* Acima de 10% ainda pode ser deliberado — a tela avisa e deixa passar. */
test('acima de 10% avisa, nomeia o campo e não impede', async ({ page }) => {
  await entrar(page);

  await page.getByTestId('cashback-enabled').click();
  await page.getByTestId('cashback-default-percent').fill('15');
  await page.getByTestId('cashback-min-redeem').fill('0');

  await expect(page.getByTestId('cashback-incomum')).toContainText('Base');

  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText('Alterações salvas')).toBeVisible();
  expect(api.cashbackPuts()).toHaveLength(1);
});

/* ==========================================================================
 * OS PAPÉIS
 * ======================================================================= */

/*
 * LER É GERÊNCIA, ESCREVER É DO DONO. Some o CONTROLE, fica o DADO — um
 * formulário que aceita digitação e nunca grava é pior que uma tela ausente.
 */
test('o gerente lê a regra e não vê como salvá-la', async ({ page }) => {
  api.entrarComoPapel('manager');
  api.setCashbackRestaurantRule(regraDaRede());
  await entrar(page);

  await expect(page.getByTestId('cashback-default-percent')).toHaveValue('5');
  await expect(page.getByTestId('cashback-somente-leitura')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Salvar' })).toHaveCount(0);
});

/* O percentual é termo comercial, não alavanca de balcão — e a senha do balcão
   é a que mais circula. O atendente não chega nem digitando o endereço. */
test('o atendente não alcança a tela nem pelo endereço', async ({ page }) => {
  api.entrarComoPapel('attendant');
  await page.goto('/cashback');
  await page.getByLabel('E-mail').fill(LOGIN_EMAIL);
  await page.getByLabel('Senha').fill(LOGIN_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page).toHaveURL(/\/pedidos$/);
  await expect(page.getByRole('link', { name: 'Cashback' })).toHaveCount(0);
});

/* ==========================================================================
 * `earns_cashback` NA FORMA DE PAGAMENTO
 * ======================================================================= */

/*
 * O CAMPO DO DONO DENTRO DE UMA ROTA DA GERÊNCIA. Quem decide é o CORPO, não o
 * caminho — a mesma forma do preço no PATCH de produto, e a mesma consequência:
 * não basta esconder o controle.
 */
test('o dono marca quais formas de pagamento geram cashback', async ({ page }) => {
  await entrar(page);
  await page.goto('/loja/pagamento');

  const pix = page.getByTestId('payment-cashback-pay-pix');
  await expect(pix).toBeChecked();
  // A do dinheiro nasce sem cashback, e a caixa mostra isso.
  await expect(page.getByTestId('payment-cashback-pay-dinheiro')).not.toBeChecked();

  await pix.click();
  await expect
    .poll(() => api.paymentMethods().find((m) => m.id === 'pay-pix')?.earns_cashback)
    .toBe(false);
  await expect(pix).not.toBeChecked();
  await expect(page.getByTestId('store-error')).toHaveCount(0);
});

/* Some o CONTROLE, fica o DADO: o gerente continua lendo qual forma está fora
   da campanha — é metade do diagnóstico de "por que este pedido não creditou". */
test('o gerente lê quais formas ficam fora da campanha, sem poder mudar', async ({ page }) => {
  api.entrarComoPapel('manager');
  await page.goto('/loja/pagamento');
  await page.getByLabel('E-mail').fill(LOGIN_EMAIL);
  await page.getByLabel('Senha').fill(LOGIN_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page.getByTestId('payment-method-pay-dinheiro')).toContainText('Sem cashback');
  await expect(page.getByTestId('payment-cashback-pay-pix')).toHaveCount(0);
  // E a forma que gera não escreve nada: `true` é o normal, e rotular o normal
  // em nove linhas de dez é ruído.
  await expect(page.getByTestId('payment-method-pay-pix')).not.toContainText('cashback');
});
