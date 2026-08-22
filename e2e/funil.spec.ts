/**
 * E2E do Funil.
 *
 * O QUE ESTA SUÍTE PROTEGE, acima de tudo: que a tela NUNCA desenhe "0 sessões"
 * quando o que aconteceu foi "ninguém contou".
 *
 * São duas afirmações opostas sobre o negócio, e o dado que as separa é o mesmo
 * zero. Enquanto o app do cliente não dispara os eventos do cardápio — que é
 * hoje, e é o estado padrão do backend falso —, os quatro primeiros degraus vêm
 * zerados e o quinto vem cheio. Uma tela que lesse isso literalmente diria ao
 * lojista que ninguém entrou no cardápio, e ele concluiria que não tem
 * movimento quando o que ele não tem é medição.
 *
 * O resto cobre o que a tela não pode contrariar: o `orders_count` do funil não
 * fecha com o do resumo (a ressalva vem escrita), e o período não alcança o que
 * o banco já apagou.
 */
import { expect, test, type Page } from '@playwright/test';

import { installFakeApi, LOGIN_EMAIL, LOGIN_PASSWORD, type FakeApi } from './fake-api';
import { escolher } from './seletor';
import { RETENCAO_DIAS } from '../src/funnel/funnel-model';

let api: FakeApi;

test.beforeEach(async ({ page }) => {
  api = await installFakeApi(page);
});

test.afterEach(() => {
  api.stop();
});

async function abrirFunil(page: Page) {
  await page.goto('/funil');
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel('E-mail').fill(LOGIN_EMAIL);
  await page.getByLabel('Senha').fill(LOGIN_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();

  await page.getByRole('link', { name: 'Funil' }).click();
  await expect(page).toHaveURL(/\/funil$/);
  await expect(page.getByRole('heading', { name: 'Funil', level: 1 })).toBeVisible();
}

test('o Funil é uma tela própria, ao lado de Desempenho e fora dela', async ({ page }) => {
  await abrirFunil(page);

  await expect(page.getByTestId('coming-soon')).toHaveCount(0);
  // A tela de dinheiro continua sendo outra: nenhum faturamento aqui.
  await expect(page.getByRole('heading', { name: 'Desempenho', level: 1 })).toHaveCount(0);
});

/* ==========================================================================
 * O ESTADO DE HOJE — a medição desligada
 * ======================================================================= */

test('sem medição, a tela diz que ninguém CONTOU — não que ninguém entrou', async ({ page }) => {
  await abrirFunil(page);

  const veredito = page.getByTestId('funil-veredito');
  await expect(veredito).toContainText('a medição, não o movimento');
  /*
   * A PROVA ESTÁ NA PRÓPRIA FRASE: houve pedido no período, e ninguém pede sem
   * abrir o cardápio. É o que separa este caso de um período genuinamente
   * parado.
   */
  await expect(veredito).toContainText('34 pedidos');

  await expect(page.getByTestId('funil-sem-medicao')).toContainText(
    'ainda não está ligada no app do cliente',
  );
});

test('sem medição, os quatro primeiros degraus mostram “—” e o quinto mostra o número real', async ({
  page,
}) => {
  await abrirFunil(page);

  const degraus = page.getByTestId('funil-degraus').getByRole('listitem');
  /*
   * ESTA É A ASSERÇÃO CENTRAL DA SUÍTE. Um "0" em qualquer um dos quatro
   * primeiros seria a tela afirmando que ninguém passou por ali — e o quinto
   * degrau, cheio, provaria o contrário três linhas abaixo.
   */
  await expect(degraus.nth(0)).toContainText('sem medição');
  await expect(degraus.nth(0)).not.toContainText('0 sessões');
  await expect(degraus.nth(3)).toContainText('sem medição');

  // O pedido não vem de evento nenhum: ele é real hoje, e aparece.
  await expect(degraus.nth(4)).toContainText('34');
  await expect(degraus.nth(4)).toContainText('pedidos');
});

test('sem medição, a coluna de sessões da tabela de origens também é “—”', async ({ page }) => {
  await abrirFunil(page);

  // "0 sessões" ao lado de "34 pedidos" afirmaria que 34 pessoas pediram sem
  // nunca abrir o cardápio.
  const linha = page.getByRole('row').filter({ hasText: 'Direto' });
  await expect(linha).toContainText('—');
  await expect(linha).toContainText('34');

  await expect(page.getByTestId('funil-frase-so-direta')).toContainText(
    'enquanto o app não devolver a origem',
  );
});

/* ==========================================================================
 * COM A MEDIÇÃO LIGADA
 * ======================================================================= */

test('com medição, a tela nomeia o degrau que vaza e o que fazer a respeito', async ({ page }) => {
  api.measureFunnel();
  await abrirFunil(page);

  // 1240 abriram o cardápio, 372 abriram um produto: 30% — a maior perda.
  const veredito = page.getByTestId('funil-veredito');
  await expect(veredito).toContainText('Abriu um produto');
  await expect(veredito).toContainText('problema de cardápio');
  await expect(veredito).toContainText('14 terminaram um pedido');

  // A marca visual sai da MESMA regra da frase: os dois apontam o mesmo degrau.
  await expect(page.getByTestId('funil-vazamento')).toContainText('Maior perda');
  await expect(page.getByTestId('funil-vazamento')).toContainText('30%');
});

test('com medição, a origem que traz gente e não vende ganha a frase da seção', async ({
  page,
}) => {
  api.measureFunnel();
  await abrirFunil(page);

  await expect(page.getByTestId('funil-frase-origem-sem-conversao')).toContainText(
    'instagram-bio',
  );
  await expect(page.getByTestId('funil-frase-origem-sem-conversao')).toContainText(
    '230 sessões e nenhum pedido',
  );
});

test('o filtro de origem recorta os DEGRAUS e mantém todas as origens na lista', async ({
  page,
}) => {
  api.measureFunnel();
  await abrirFunil(page);

  /*
   * REGEX, E NÃO O RÓTULO EXATO: a opção do seletor leva o `hint` com a
   * contagem de pedidos ao lado ("qr-mesa-04 · 80 pedidos"), e é ele que faz a
   * escolha entre dois QRs parecidos ser possível sem abrir a tabela.
   */
  await escolher(page.getByTestId('funil-filtro-origem'), /qr-mesa-04/);

  // Os degraus passam a ser os daquela origem, e a tela diz o recorte.
  await expect(page.getByTestId('funil-escopo')).toContainText('qr-mesa-04');

  /*
   * E A TABELA CONTINUA COM AS TRÊS. É a propriedade que o backend garante de
   * propósito: `sources` vem inteira mesmo com o filtro ligado. Filtrada, ela
   * teria uma linha só — e o seletor perderia as outras opções assim que
   * alguém escolhesse a primeira.
   */
  await expect(page.getByRole('row').filter({ hasText: 'instagram-bio' })).toHaveCount(1);
  await expect(page.getByRole('row').filter({ hasText: 'Direto' })).toHaveCount(1);
});

/* ==========================================================================
 * AS DUAS RESSALVAS QUE A TELA NÃO PODE PERDER
 * ======================================================================= */

test('a ressalva do orders_count vem escrita, com as palavras do backend', async ({ page }) => {
  await abrirFunil(page);

  /*
   * O NÚMERO DO FUNIL NÃO FECHA COM O DE DESEMPENHO, e é de propósito: este
   * conta cancelado e recusado, porque mede se a PESSOA terminou de pedir. Sem
   * a ressalva na tela, duas telas do mesmo painel dizem números diferentes de
   * "pedidos" no mesmo período e nenhuma explica por quê.
   */
  await expect(page.getByTestId('funil-orders-note')).toContainText('cancelados e recusados');
  await expect(page.getByTestId('funil-orders-note')).toContainText('/reports/summary');
});

test('o período não oferece o que o banco já apagou', async ({ page }) => {
  await abrirFunil(page);

  await expect(page.getByTestId('funil-escopo')).toContainText(`últimos ${RETENCAO_DIAS} dias`);

  await page.getByTestId('funil-periodo-custom').click();

  /*
   * O `min` DO CAMPO É O PRIMEIRO DIA COM EVENTO. O calendário do navegador
   * desabilita o resto, então a data que o expurgo já levou não chega a ser
   * escolhível — e um recorte que a alcançasse devolveria os quatro primeiros
   * degraus mordidos, com o quinto cheio, sem nada acender.
   */
  const de = page.getByTestId('funil-data-de');
  const min = await de.getAttribute('min');
  expect(min).toBeTruthy();

  const hoje = new Date();
  const limite = new Date(hoje.getTime() - (RETENCAO_DIAS - 1) * 86_400_000);
  expect(min).toBe(limite.toISOString().slice(0, 10));
});

test('um começo anterior à retenção não vira requisição: vira uma frase', async ({ page }) => {
  await abrirFunil(page);

  await page.getByTestId('funil-periodo-custom').click();
  // Digitado à mão, passando por cima do `min` do calendário.
  await page.getByTestId('funil-data-de').fill('2020-01-01');

  await expect(page.getByRole('alert')).toContainText(`${RETENCAO_DIAS} dias`);
});
