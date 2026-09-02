/**
 * E2E da borda de erro.
 *
 * ============================================================================
 * O DEFEITO QUE ELE COBRE, E POR QUE NENHUM TESTE O PEGAVA
 * ============================================================================
 *
 * Não existia `ErrorBoundary` em lugar nenhum do `src/`. Qualquer exceção de
 * render — um campo que o backend passou a mandar `null`, um `.map` em
 * `undefined` — apagava a tela inteira: branco, mudo, sem "recarregar" e sem
 * nada chegando ao suporte. No sábado, no celular, no meio do movimento.
 *
 * E A TELA BRANCA NÃO TINHA TESTE PORQUE NÃO TINHA CÓDIGO. É por isso que
 * ninguém tinha reparado.
 *
 * O falso quebra a listagem de propósito (`quebrarListagemDePedidos`), e a
 * forma da mentira é a do defeito real: **200, JSON válido, `items: null`.**
 * Não é rede caída nem 500 — o painel já trata os dois com mensagem na tela.
 * É a resposta que passa por tudo e explode no render.
 */
import { expect, test } from '@playwright/test';

import { installFakeApi, LOGIN_EMAIL, LOGIN_PASSWORD, type FakeApi } from './fake-api';

let api: FakeApi;

test.beforeEach(async ({ page }) => {
  api = await installFakeApi(page);
});

test.afterEach(() => {
  api.stop();
});

async function entrarComOQuadroQuebrado(page: import('@playwright/test').Page) {
  api.quebrarListagemDePedidos();
  await page.goto('/pedidos');
  await page.getByLabel('E-mail').fill(LOGIN_EMAIL);
  await page.getByLabel('Senha').fill(LOGIN_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/pedidos$/);
}

test('a tela que quebra vira uma tela com saída, e a lateral continua de pé', async ({ page }) => {
  await entrarComOQuadroQuebrado(page);

  await expect(page.getByTestId('erro-da-tela')).toBeVisible();
  await expect(page.getByText('Esta tela parou de funcionar')).toBeVisible();

  /*
   * A METADE QUE MAIS IMPORTA: a borda fica DENTRO da moldura, então o defeito
   * de UMA tela não leva o painel junto. A lateral, o cabeçalho e as outras
   * seções continuam ali — a pessoa navega para outro lugar e continua
   * trabalhando, em vez de perder o painel por causa de uma tela.
   */
  await expect(page.getByRole('navigation', { name: 'Seções do painel' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Cardápio' })).toBeVisible();
});

test('sair da tela quebrada pela lateral funciona, e a borda não persegue a próxima', async ({
  page,
}) => {
  await entrarComOQuadroQuebrado(page);
  await expect(page.getByTestId('erro-da-tela')).toBeVisible();

  await page.getByRole('link', { name: 'Cardápio' }).click();
  await expect(page).toHaveURL(/\/cardapio$/);

  /*
   * SEM A `key={pathname}` NA BORDA, ISTO FALHARIA: o React guarda o estado de
   * erro do componente, e a seção seguinte nasceria quebrada também — o painel
   * inteiro pareceria perdido por causa de uma tela.
   */
  await expect(page.getByTestId('erro-da-tela')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Cardápio' })).toBeVisible();
});

/*
 * A OUTRA METADE DO ITEM, e a que muda a vida do suporte: sem ela, a pessoa
 * recarrega, o erro some da tela e some do mundo. `POST /admin/error-reports`
 * estava pronto no backend e o painel nunca o chamava.
 */
test('o relato chega ao backend com o log e a tela, sem ninguém copiar nada', async ({ page }) => {
  await entrarComOQuadroQuebrado(page);

  // O botão nasce travado: relato sem história é log sem pergunta.
  await expect(page.getByTestId('erro-enviar')).toBeDisabled();

  await page
    .getByTestId('erro-descricao')
    .fill('Abri os pedidos no começo do turno e a tela sumiu.');
  await page.getByTestId('erro-enviar').click();

  await expect(page.getByTestId('erro-protocolo')).toBeVisible();
  await expect(page.getByTestId('erro-protocolo')).toContainText('relato-1');

  const [relato] = api.errorReports();
  expect(relato?.description).toBe('Abri os pedidos no começo do turno e a tela sumiu.');
  // A TELA vai sozinha, e é o caminho da URL — o que o suporte digita para
  // chegar no mesmo lugar.
  expect(relato?.screen).toBe('/pedidos');
  // O LOG vai sozinho, e traz a árvore de componentes: é ela que diz em que
  // tela o erro nasceu, e é o que ninguém consegue copiar de uma tela branca.
  expect(String(relato?.error_log)).toContain('--- componentes ---');
  expect(String(relato?.error_log).length).toBeGreaterThan(0);

  /*
   * `extra="forbid"` no backend: restaurante, filial e usuário saem do TOKEN.
   * Um corpo que os mandasse é 422 em produção — e o falso responde 422 também,
   * para que este teste continue valendo se alguém acrescentar um campo aqui.
   */
  expect(Object.keys(relato ?? {}).sort()).toEqual(['description', 'error_log', 'screen']);
});

test('quando o envio do relato falha, o log fica na tela para ir pelo WhatsApp', async ({
  page,
}) => {
  await entrarComOQuadroQuebrado(page);

  /*
   * A INTERNET CAIU JUNTO — e este é o caso que importa, não a sessão expirada.
   *
   * Sessão expirada NÃO chega aqui: o 401 derruba a sessão e devolve ao login,
   * que é o comportamento certo e já testado em outro lugar. O que sobra, e o
   * que acontece de verdade na loja, é a conexão intermitente — e é aí que o
   * relato não sai e a pessoa fica sem nada.
   *
   * A rota entra DEPOIS do falso de propósito: o Playwright casa as rotas na
   * ordem inversa do registro, então esta vence para este caminho e o resto do
   * painel continua falando com o falso.
   */
  await page.route('**/admin/error-reports', (route) => route.abort());

  await page.getByTestId('erro-descricao').fill('Sumiu tudo ao abrir os pedidos.');
  await page.getByTestId('erro-enviar').click();

  const falha = page.getByTestId('erro-falha-do-envio');
  await expect(falha).toBeVisible();
  // O log em texto copiável é o pior caso, e ele continua melhor que branco.
  await expect(falha).toContainText('--- componentes ---');
  await expect(page.getByTestId('erro-enviar')).toContainText('Tentar enviar de novo');
});
