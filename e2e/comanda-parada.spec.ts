/**
 * ============================================================================
 * A COMANDA QUE PAROU DE SAIR, E A TELA QUE NÃO DIZIA NADA
 * ============================================================================
 *
 * O estado do programa de impressão existia num lugar só do painel inteiro:
 * Loja › Impressão, uma seção de CONFIGURAÇÃO que só abre quem já desconfia. O
 * programa caía às dezenove horas, nenhuma comanda saía, e Pedidos e Cozinha —
 * as duas telas que ficam abertas o turno inteiro — continuavam idênticas até
 * um cliente ligar perguntando do pedido.
 *
 * O dado sempre esteve na mão do painel (`is_online`, calculado pelo backend
 * contra a janela de 90s). Faltava dizê-lo onde o lojista está.
 *
 * O QUE ESTES TESTES PROTEGEM, e por que cada um:
 *
 *   1. rodando não avisa nada — um aviso que aparece sempre não é aviso;
 *   2. parado avisa nas DUAS telas — a regra é uma, o componente é um;
 *   3. nunca instalado NÃO avisa — configuração não é incidente;
 *   4. com várias filiais em vista, a faixa diz em QUAL balcão está a máquina;
 *   5. leitura que não voltou não vira "nenhuma comanda está saindo".
 */
import { expect, test, type Page } from '@playwright/test';

import { installFakeApi, LOGIN_EMAIL, LOGIN_PASSWORD, type FakeApi } from './fake-api';
import { escolherFilial, FAKE_BRANCH, FAKE_BRANCH_2 } from './seletor';
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

async function irParaCozinha(page: Page) {
  await page.getByRole('link', { name: 'Cozinha' }).click();
  await expect(page).toHaveURL(/\/cozinha$/);
}

const faixa = (page: Page) => page.getByTestId('aviso-agente');

/*
 * O CASO NORMAL, e ele é o que dá valor aos outros: uma faixa que aparece
 * sempre vira papel de parede, e no dia em que importasse ninguém a leria.
 */
test('com o programa rodando, nenhuma das duas telas diz nada', async ({ page }) => {
  await entrar(page);
  await escolherFilial(page);
  await expect(page.getByTestId('board-lanes')).toBeVisible();
  await expect(faixa(page)).toHaveCount(0);

  await irParaCozinha(page);
  await expect(page.getByTestId('kitchen-column-preparing')).toBeVisible();
  await expect(faixa(page)).toHaveCount(0);
});

test('programa parado: Pedidos avisa, com o tempo e o que conferir', async ({ page }) => {
  api.setPrintAgentSeconds(FAKE_BRANCH.id, 3600);

  await entrar(page);
  await escolherFilial(page);

  await expect(faixa(page)).toContainText('Nenhuma comanda está saindo');
  await expect(faixa(page)).toContainText('sem sinal há 1 hora');
  await expect(faixa(page)).toContainText('computador do balcão');

  /*
   * COM UMA FILIAL EM VISTA, A FAIXA NÃO REPETE O NOME DELA: o cabeçalho já
   * disse de qual loja é o quadro, e a largura de uma linha é curta.
   */
  await expect(faixa(page)).not.toContainText(branchName(FAKE_BRANCH));
});

/*
 * A MESMA REGRA NA COZINHA, e é aqui que ela mais importa: a via de PRODUÇÃO é
 * a que deveria estar saindo nesta sala, e ninguém abre configuração no meio do
 * serviço.
 */
test('programa parado: a Cozinha avisa igual, sem uma segunda regra', async ({ page }) => {
  api.setPrintAgentSeconds(FAKE_BRANCH.id, 3600);

  await entrar(page);
  await escolherFilial(page);
  await irParaCozinha(page);

  await expect(faixa(page)).toContainText('Nenhuma comanda está saindo');
  await expect(faixa(page)).toContainText('sem sinal há 1 hora');
});

/*
 * "NUNCA INSTALADO" NÃO ACENDE — e esta é a decisão que mantém a faixa legível.
 *
 * `FAKE_BRANCH_2` nunca teve agente: o backend responde 200 com tudo nulo, que
 * é uma resposta e não um erro. Uma loja que não comprou impressora térmica
 * veria esta faixa todo dia, o turno inteiro, para sempre — e no dia em que o
 * programa da OUTRA loja caísse, ela já seria papel de parede. Quem nunca
 * instalou descobre isso em Loja › Impressão, que é onde se instala.
 */
test('filial que nunca instalou o programa não vira alarme diário', async ({ page }) => {
  await entrar(page);
  await escolherFilial(page, FAKE_BRANCH_2);

  await expect(page.getByTestId('board-lanes')).toBeVisible();
  await expect(faixa(page)).toHaveCount(0);
});

/*
 * COM "TODAS AS FILIAIS", A FAIXA NOMEIA A LOJA. É justamente o dono de mais de
 * uma loja — que trabalha com o quadro somado e não escolhe filial — quem não
 * tinha como descobrir sozinho que o computador de uma delas caiu.
 */
test('em todas as filiais, a faixa diz em qual balcão está a máquina parada', async ({ page }) => {
  api.setPrintAgentSeconds(FAKE_BRANCH.id, 3600);

  await entrar(page);
  await expect(page.getByTestId('board-lanes')).toBeVisible();

  await expect(faixa(page)).toContainText(`na ${branchName(FAKE_BRANCH)}`);
  // A outra nunca instalou: ela não entra na frase nem transforma o aviso em
  // "2 filiais".
  await expect(faixa(page)).not.toContainText('2 filiais');
});

/*
 * LEITURA QUE NÃO VOLTOU NÃO VIRA AFIRMAÇÃO.
 *
 * "Nenhuma comanda está saindo" numa queda de rede de três segundos manda o
 * lojista até o balcão à toa, no meio do pico. É o mesmo defeito de devolver o
 * valor de "não há" para dizer "não consegui ler" — e é a razão de a filial sem
 * resposta ficar de fora da conta em vez de entrar como parada.
 */
test('sem resposta sobre o programa, o painel não afirma que a comanda parou', async ({ page }) => {
  await page.route('**/admin/branches/*/print-agent', (route) => route.abort());

  await entrar(page);
  await escolherFilial(page);

  await expect(page.getByTestId('board-lanes')).toBeVisible();
  await expect(faixa(page)).toHaveCount(0);
});
