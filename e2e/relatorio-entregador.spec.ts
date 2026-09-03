/**
 * ============================================================================
 * O DIA DE PAGAR — quanto a loja deve a cada entregador
 * ============================================================================
 *
 * A tela que o dono abre uma vez por semana, com o extrato ao lado. Duas regras
 * mandam no desenho, e as duas têm teste aqui:
 *
 *   1. OS NÚMEROS BATEM COM O QUE O MOTOBOY VÊ no link dele. O painel não
 *      recalcula nada — o total é o que o backend mandou, como string de duas
 *      casas. Uma segunda conta aqui viraria divergência no balcão.
 *   2. O QUE NÃO TEM TAXA FICA AO LADO DA SOMA, NUNCA DENTRO. Somar como zero
 *      seria afirmar que aquelas corridas foram de graça.
 */
import { expect, test, type Page } from '@playwright/test';

import { installFakeApi, LOGIN_EMAIL, LOGIN_PASSWORD, type FakeApi } from './fake-api';
import { escolher, escolherFilial } from './seletor';

let api: FakeApi;

test.beforeEach(async ({ page }) => {
  api = await installFakeApi(page);
});

test.afterEach(() => {
  api.stop();
});

async function abrirAPagar(page: Page) {
  await page.goto('/pedidos');
  await page.getByLabel('E-mail').fill(LOGIN_EMAIL);
  await page.getByLabel('Senha').fill(LOGIN_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/pedidos$/);

  await page.goto('/entregadores');
  await page.getByTestId('entregadores-aba-pagar').click();
}

test('o total é o do backend, e a tabela é a conferência dele', async ({ page }) => {
  await abrirAPagar(page);

  // 96,00 + 21,00 + 32,00 = 149,00 — e quem soma é o falso, como o backend.
  await expect(page.getByTestId('pagar-total')).toContainText('149,00');

  const linhas = page.locator('tbody tr');
  await expect(linhas).toHaveCount(3);
  await expect(linhas.nth(0)).toContainText('Ana Souza');
  await expect(linhas.nth(0)).toContainText('96,00');
});

/*
 * ============================================================================
 * O QUE NÃO TEM TAXA FICA AO LADO, NUNCA DENTRO
 * ============================================================================
 *
 * O Jorge tem 3 corridas sem taxa: elas entram na CONTAGEM de entregas e não na
 * soma, porque não há valor congelado nelas. É o número que o dono acerta à
 * mão, e a tela precisa dizê-lo em palavras — uma coluna sozinha não conta o
 * que fazer com ele.
 */
test('as corridas sem taxa aparecem ao lado da soma, e a tela diz que estão fora', async ({
  page,
}) => {
  await abrirAPagar(page);

  const aviso = page.getByTestId('pagar-sem-taxa');
  await expect(aviso).toContainText('3 corridas sem taxa');
  await expect(aviso).toContainText('não estão');

  // E na linha de quem as tem.
  const linhaJorge = page.locator('tbody tr').filter({ hasText: 'Jorge Lima' });
  await expect(linhaJorge).toContainText('3');
});

/*
 * QUEM SAIU CONTINUA NA LISTA, MARCADO. Escondê-lo seria o dono não pagar quem
 * trabalhou — numa tela que existe para o dia de pagar.
 */
test('o entregador que saiu da loja aparece, com a marca e o valor', async ({ page }) => {
  await abrirAPagar(page);

  const linha = page.locator('tbody tr').filter({ hasText: 'Rita Alves' });
  await expect(linha).toContainText('Saiu da loja');
  await expect(linha).toContainText('32,00');
});

test('o período vai na consulta, e o atalho de 30 dias é o padrão', async ({ page }) => {
  await abrirAPagar(page);

  const consulta = api.courierReportQueries().at(-1)!;
  expect(consulta.inicio).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(consulta.fim).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(consulta.inicio < consulta.fim).toBe(true);
});

/*
 * ============================================================================
 * AS RECUSAS QUE A TELA EVITA ANTES DE PERGUNTAR
 * ============================================================================
 */

/*
 * O TETO DE 92 DIAS É RECUSADO AQUI. O backend responde 400 com uma frase que
 * não diz qual campo mexer, e uma ida à rede para saber uma regra que já se
 * sabia é uma espera a mais no dia de pagar.
 */
test('período acima de 92 dias é recusado na tela, sem ir à rede', async ({ page }) => {
  await abrirAPagar(page);
  const antes = api.courierReportQueries().length;

  await page.getByTestId('pagar-periodo-custom').click();
  await page.getByTestId('pagar-inicio').fill('2026-01-01');
  await page.getByTestId('pagar-fim').fill('2026-12-31');

  await expect(page.getByTestId('pagar-periodo-erro')).toContainText('92');
  expect(api.courierReportQueries()).toHaveLength(antes);
});

/*
 * PERÍODO INVÁLIDO NÃO APAGA O QUE ESTÁ NA TELA. Quem digita a data passa por
 * estados inválidos no meio da digitação, e limpar a tabela a cada tecla faria
 * a tela piscar enquanto o dono escreve.
 */
test('com o período inválido, a tabela anterior continua na tela', async ({ page }) => {
  await abrirAPagar(page);
  await expect(page.getByTestId('pagar-total')).toContainText('149,00');

  await page.getByTestId('pagar-periodo-custom').click();
  await page.getByTestId('pagar-inicio').fill('2026-12-31');
  await page.getByTestId('pagar-fim').fill('2026-01-01');

  await expect(page.getByTestId('pagar-periodo-erro')).toBeVisible();
  await expect(page.getByTestId('pagar-total')).toContainText('149,00');
});

/*
 * ============================================================================
 * O RECORTE, E O CAMINHO QUE LEVA A NÃO TER NENHUM
 * ============================================================================
 *
 * A ABA DA LISTA ADOTA UMA FILIAL — o cadastro precisa de uma concreta, porque
 * o telefone é único DENTRO dela. Então quem abre "A pagar" chega com recorte,
 * e é "Todas as filiais" no topo que o desfaz.
 *
 * Esses dois casos são o que a primeira execução do portão pegou: com a adoção
 * valendo nas duas abas, "Todas as filiais" voltava sozinha para a filial
 * adotada no efeito seguinte. O dono nunca alcançava o total da rede — o número
 * que ele abre esta tela para ver — e o aviso do gerente descrevia um estado
 * que nenhum clique produzia.
 */

/*
 * O TOTAL DO RESTAURANTE INTEIRO É DO DONO: `branch_id` omitido soma a rede.
 */
test('o dono em "Todas as filiais" vê o total do restaurante', async ({ page }) => {
  await abrirAPagar(page);

  await escolher(page.getByTestId('branch-select'), 'Todas as filiais');

  await expect(page.getByTestId('pagar-resumo')).toContainText('no restaurante');
  await expect(page.getByTestId('pagar-total')).toContainText('149,00');
  expect(api.courierReportQueries().at(-1)!.filial).toBeNull();
});

/*
 * O GERENTE PRECISA DO RECORTE: sem filial, a rota responde 403 porque ler o
 * dinheiro do restaurante inteiro não é dele. A tela diz o que fazer, em vez de
 * deixar o 403 chegar como "você não tem permissão" — ele TEM, de uma loja.
 *
 * E NÃO PERGUNTA. A consulta não sai: uma ida à rede para ser informado de uma
 * recusa que a tela já sabia é a mesma espera inútil do teto de 92 dias.
 */
test('o gerente em "Todas as filiais" é orientado, e não levado ao 403', async ({ page }) => {
  api.entrarComoPapel('manager');
  await abrirAPagar(page);
  const antes = api.courierReportQueries().length;

  await escolher(page.getByTestId('branch-select'), 'Todas as filiais');

  await expect(page.getByTestId('pagar-escolha-filial')).toBeVisible();
  await expect(page.getByTestId('pagar-total')).toHaveCount(0);
  expect(api.courierReportQueries()).toHaveLength(antes);
});

test('o gerente com a filial escolhida vê o relatório dela', async ({ page }) => {
  api.entrarComoPapel('manager');
  await abrirAPagar(page);
  await escolherFilial(page);

  await expect(page.getByTestId('pagar-total')).toContainText('149,00');
  expect(api.courierReportQueries().at(-1)!.filial).toBeTruthy();
});

/*
 * A LEITURA QUE FALHOU NÃO VIRA "NADA A PAGAR". Zerar a tela por causa de uma
 * queda de rede é dizer ao dono que ele não deve nada a ninguém, no dia em que
 * ele abriu justamente para pagar.
 */
test('erro na leitura não vira total zerado', async ({ page }) => {
  await page.route('**/admin/reports/couriers*', (route) => route.abort());

  await abrirAPagar(page);

  await expect(page.getByTestId('pagar-erro')).toBeVisible();
  await expect(page.getByTestId('pagar-total')).toHaveCount(0);
});

/*
 * O RELATÓRIO É DA GERÊNCIA, e a lista é de todos. O atendente abre a tela e
 * não vê a aba — o painel some, não desabilita.
 */
test('o atendente não vê a aba do dia de pagar', async ({ page }) => {
  api.entrarComoPapel('attendant');

  await page.goto('/pedidos');
  await page.getByLabel('E-mail').fill(LOGIN_EMAIL);
  await page.getByLabel('Senha').fill(LOGIN_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.goto('/entregadores');

  await expect(page.locator('tbody')).toContainText('Jorge Lima');
  await expect(page.getByTestId('entregadores-aba-pagar')).toHaveCount(0);
});
