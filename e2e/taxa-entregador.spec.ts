/**
 * ============================================================================
 * A TAXA POR CORRIDA — o que a LOJA paga ao motoboy
 * ============================================================================
 *
 * Ela mora ao lado do frete do cliente, na mesma aba, com a MESMA fórmula. É
 * exatamente por isso que estes testes existem: dois pares de campos parecidos
 * na mesma tela é a receita para alguém ajustar o valor errado — e o valor
 * errado ali é o que o cliente paga.
 *
 * A REGRA DURA, e ela é do contrato: `null` é "sem taxa", NUNCA zero. Zero é um
 * número que soma no histórico que o dono usa para pagar o motoboy; uma filial
 * sem taxa que aparecesse como "R$ 0,00" faria o dono concluir que não deve
 * nada.
 */
import { expect, test, type Page } from '@playwright/test';

import { installFakeApi, LOGIN_EMAIL, LOGIN_PASSWORD, type FakeApi } from './fake-api';
import { escolherFilial, FAKE_BRANCH } from './seletor';

let api: FakeApi;

test.beforeEach(async ({ page }) => {
  api = await installFakeApi(page);
});

test.afterEach(() => {
  api.stop();
});

async function abrirEntrega(page: Page) {
  await page.goto('/pedidos');
  await page.getByLabel('E-mail').fill(LOGIN_EMAIL);
  await page.getByLabel('Senha').fill(LOGIN_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/pedidos$/);

  await page.goto('/loja/entrega');
  await escolherFilial(page);
  await expect(page.getByTestId('courier-fee')).toBeVisible();
}

/*
 * O ESTADO INICIAL DE TODA FILIAL, e o caso que mais importa: ninguém
 * configurou nada. O falso nasce assim de propósito.
 */
test('filial sem taxa não mostra R$ 0,00 — mostra que não há taxa', async ({ page }) => {
  await abrirEntrega(page);

  await expect(page.getByTestId('courier-fee-atual')).toContainText('Sem taxa');
  await expect(page.getByTestId('courier-fee-atual')).not.toContainText('0,00');

  // E o estado é EXPLICADO: o dono precisa saber o que acontece com o
  // histórico do motoboy, senão ele lê as corridas sem valor como já pagas.
  await expect(page.getByTestId('courier-fee-sem-taxa')).toContainText('sem valor');

  // Os campos nascem em branco, e não com zero digitado.
  await expect(page.getByTestId('courier-fee-base')).toHaveValue('');
  await expect(page.getByTestId('courier-fee-per-km')).toHaveValue('');
});

test('a taxa gravada volta na tela com a fórmula à vista', async ({ page }) => {
  api.setCourierFee(FAKE_BRANCH.id, 8, 1.5);

  await abrirEntrega(page);

  const atual = page.getByTestId('courier-fee-atual');
  await expect(atual).toContainText('8,00');
  await expect(atual).toContainText('por corrida');
  await expect(atual).toContainText('1,50');
  await expect(atual).toContainText('por km');
});

/*
 * DINHEIRO SOBE COMO STRING DE DUAS CASAS. `8,1` como número pode chegar
 * 8,099999 do outro lado do JSON, e o `Decimal` do Python guardaria isso.
 */
test('gravar manda o dinheiro como string de duas casas, e só o campo mexido', async ({ page }) => {
  await abrirEntrega(page);

  await page.getByTestId('courier-fee-base').fill('8,1');
  await page.getByTestId('courier-fee-save').click();

  await expect(page.getByTestId('courier-fee-salvo')).toBeVisible();

  const corpo = api.courierFeePatches().at(-1)!;
  expect(corpo).toEqual({ courier_fee_base: '8.10' });
  // O por-km não foi tocado, então ele NÃO entra no corpo: campo ausente é
  // "não mexa", e mandá-lo reescreveria por cima de um valor que a tela não
  // alterou.
  expect(corpo).not.toHaveProperty('courier_fee_per_km');
});

/*
 * APAGAR É `null` EXPLÍCITO. Omitir o campo seria "não mexa" — e quem limpou o
 * campo mandou apagar. É a mesma regra de `printing_sector_id`.
 */
test('limpar o campo manda null explícito, e a tela volta a dizer "sem taxa"', async ({ page }) => {
  api.setCourierFee(FAKE_BRANCH.id, 8, null);

  await abrirEntrega(page);
  await expect(page.getByTestId('courier-fee-atual')).toContainText('8,00');

  await page.getByTestId('courier-fee-base').fill('');
  await page.getByTestId('courier-fee-save').click();

  await expect(page.getByTestId('courier-fee-atual')).toContainText('Sem taxa');
  expect(api.courierFeePatches().at(-1)).toEqual({ courier_fee_base: null });
});

/*
 * ZERO DIGITADO É UM ACORDO, e não um campo em branco. A regra "null nunca é
 * zero" lida ao contrário: mostrar um zero gravado como "sem taxa" apagaria uma
 * escolha do lojista.
 */
test('zero digitado é gravado como zero, e a tela escreve R$ 0,00', async ({ page }) => {
  await abrirEntrega(page);

  await page.getByTestId('courier-fee-base').fill('0');
  await page.getByTestId('courier-fee-save').click();

  await expect(page.getByTestId('courier-fee-salvo')).toBeVisible();
  expect(api.courierFeePatches().at(-1)).toEqual({ courier_fee_base: '0.00' });

  await expect(page.getByTestId('courier-fee-atual')).toContainText('0,00');
  await expect(page.getByTestId('courier-fee-atual')).not.toContainText('Sem taxa');
});

/*
 * O AVISO QUE EVITA O CHAMADO. Mudar a taxa às 19h não muda a corrida que o
 * motoboy pegou às 18h — o valor é congelado na atribuição.
 */
test('a tela avisa que a mudança não alcança corrida já atribuída', async ({ page }) => {
  await abrirEntrega(page);

  await expect(page.getByTestId('courier-fee-congelada')).toContainText('próximas');
  await expect(page.getByTestId('courier-fee-congelada')).toContainText('não mudam');
});

/*
 * ============================================================================
 * AS RECUSAS — nenhuma escrita nasce só no caminho feliz
 * ============================================================================
 */

test('negativo é recusado pelo backend, e a tela mostra a recusa', async ({ page }) => {
  await abrirEntrega(page);

  await page.getByTestId('courier-fee-per-km').fill('-1');
  await page.getByTestId('courier-fee-save').click();

  /*
   * A TELA RECUSA ANTES DE SAIR, e é isso que se prova aqui: o corpo nem
   * chega ao falso. O `ge=0` do Pydantic continua sendo a última palavra — o
   * falso o cobra —, mas o lojista não precisa de uma ida à rede para saber
   * que não existe taxa negativa.
   */
  await expect(page.getByTestId('courier-fee-problema')).toContainText('negativo');
  expect(api.courierFeePatches()).toHaveLength(0);
});

test('403 do backend aparece na tela, e o valor em vigor não muda', async ({ page }) => {
  api.setCourierFee(FAKE_BRANCH.id, 8, null);
  await abrirEntrega(page);

  await page.route('**/admin/branches/*/courier-fee', (route) => {
    // Só a ESCRITA é recusada: sem o filtro de método, este handler comeria
    // também o GET que monta a seção, e o teste passaria por outro motivo.
    if (route.request().method() !== 'PATCH') return route.fallback();
    return route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'Apenas o proprietário pode mudar a taxa do entregador.' }),
    });
  });

  await page.getByTestId('courier-fee-base').fill('12,00');
  await page.getByTestId('courier-fee-save').click();

  await expect(page.getByTestId('courier-fee-problema')).toContainText('proprietário');
  // O valor EM VIGOR continua sendo o que está gravado: uma escrita recusada
  // não pode deixar a tela afirmando o número que ela não conseguiu gravar.
  await expect(page.getByTestId('courier-fee-atual')).toContainText('8,00');
});

test('leitura que falha não vira "sem taxa"', async ({ page }) => {
  await page.route('**/admin/branches/*/courier-fee', (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return route.abort();
  });

  await abrirEntrega(page);

  /*
   * Sem resposta, a tela NÃO afirma nada sobre quanto a loja paga. "Sem taxa"
   * numa queda de rede é a pior frase que esta seção pode dizer errado: o dono
   * concluiria que não deve nada ao motoboy.
   */
  await expect(page.getByTestId('courier-fee-error')).toBeVisible();
  await expect(page.getByTestId('courier-fee-atual')).toHaveCount(0);
  await expect(page.getByTestId('courier-fee-sem-taxa')).toHaveCount(0);
});

/*
 * LER É DA GERÊNCIA, GRAVAR É DO DONO. O painel SOME, NÃO DESABILITA — mas o
 * que some é o CAMPO, não a seção: escondê-la faria o gerente concluir que a
 * loja não paga o motoboy pelo painel, e voltar a perguntar ao dono no
 * WhatsApp, que é o trabalho que esta tela existe para acabar.
 */
test('o gerente lê a taxa e não vê os campos', async ({ page }) => {
  api.entrarComoPapel('manager');
  api.setCourierFee(FAKE_BRANCH.id, 8, null);

  await abrirEntrega(page);

  await expect(page.getByTestId('courier-fee-atual')).toContainText('8,00');
  await expect(page.getByTestId('courier-fee-so-leitura')).toContainText('proprietário');

  await expect(page.getByTestId('courier-fee-base')).toHaveCount(0);
  await expect(page.getByTestId('courier-fee-save')).toHaveCount(0);
});
