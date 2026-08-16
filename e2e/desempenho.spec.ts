/**
 * E2E de Desempenho.
 *
 * A tela é de leitura pura, então o que ela tem de errar em silêncio é o
 * NÚMERO — e todo número errado aqui compila, monta e parece certo. Os testes
 * abaixo cobrem, um a um, os casos em que o contrato tem uma armadilha:
 * comparação nula virando 0%, forma de pagamento nula virando "Outro", a
 * ressalva do total de produtos sumindo, e o escopo de filial ficando implícito
 * ao lado de um seletor que não filtra.
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

async function abrirDesempenho(page: Page) {
  await page.goto('/desempenho');
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel('E-mail').fill(LOGIN_EMAIL);
  await page.getByLabel('Senha').fill(LOGIN_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();

  await page.getByRole('link', { name: 'Desempenho' }).click();
  await expect(page).toHaveURL(/\/desempenho$/);
  await expect(page.getByRole('heading', { name: 'Desempenho', level: 1 })).toBeVisible();
}

test('Desempenho é uma tela de verdade, não mais uma página "em breve"', async ({ page }) => {
  await abrirDesempenho(page);

  await expect(page.getByTestId('coming-soon')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Desempenho\s+Em breve/ })).toHaveCount(0);
});

test('o resumo traz faturamento, pedidos e ticket médio', async ({ page }) => {
  await abrirDesempenho(page);

  const faturamento = page.locator('.tile').filter({ hasText: 'Faturamento' });
  await expect(faturamento).toContainText('R$ 3.169,50');
  await expect(faturamento).toContainText('-6,8% vs. os 7 dias anteriores');

  await expect(page.locator('.tile').filter({ hasText: 'Ticket médio' })).toContainText('R$ 58,69');
  await expect(page.locator('.tile').filter({ hasText: 'Pedidos' })).toContainText('54');
});

/*
 * A ARMADILHA Nº 1. `change_percent` nulo significa "o período anterior foi
 * zero". Um `?? 0` escreveria "0%" e diria que o ticket médio ficou parado —
 * quando o que houve é que não havia período anterior com movimento. As duas
 * frases levam a decisões opostas.
 */
test('comparação sem período anterior diz "sem comparação", nunca 0%', async ({ page }) => {
  await abrirDesempenho(page);

  const tile = page.locator('.tile').filter({ hasText: 'Ticket médio' });
  await expect(tile).toContainText('sem comparação');
  await expect(tile).not.toContainText('0%');
});

/*
 * A ARMADILHA Nº 2. "Outro" é uma forma de pagamento de verdade, escolhível na
 * configuração da filial. Nulo é pedido cuja forma NINGUÉM registrou — e é
 * isso que o lojista precisa ler para ir investigar.
 */
test('forma de pagamento nula não vira "Outro"', async ({ page }) => {
  await abrirDesempenho(page);

  const secao = page.locator('.perf__secao').filter({ hasText: 'Formas de pagamento' });
  await expect(secao).toContainText('Sem forma registrada');
  await expect(secao).not.toContainText('Outro');
  await expect(secao).toContainText('Pix');
});

/*
 * A ARMADILHA Nº 3. `listed_revenue_total` NÃO fecha com o faturamento do
 * resumo — é receita bruta de item, sem cupom, cashback nem taxas. Os dois
 * números na mesma tela sem a ressalva fazem a tela parecer com erro de conta,
 * e o texto vem pronto do backend em `revenue_note`.
 */
test('o total de produtos vem com a ressalva do backend colada nele', async ({ page }) => {
  await abrirDesempenho(page);

  const secao = page.locator('.perf__secao').filter({ hasText: 'Mais vendidos' });
  await expect(secao).toContainText('R$ 1.947,60');
  await expect(secao).toContainText('não fecha com o faturamento do resumo');
});

/*
 * O ESCOPO, ESCRITO.
 *
 * Nenhuma das seis rotas aceita `branch_id`, e o seletor de filial do topo
 * continua visível em toda tela do painel. Sem o aviso, ele pareceria um filtro
 * que pegou, e o lojista leria o faturamento de duas lojas como o de uma.
 *
 * O teste vai além do texto: troca de filial no topo e confere que o
 * faturamento NÃO muda — que é a afirmação que o aviso faz.
 */
test('a tela avisa que soma todas as filiais, e o seletor do topo não a muda', async ({ page }) => {
  await abrirDesempenho(page);

  const aviso = page.getByTestId('perf-escopo');
  await expect(aviso).toContainText('todas as filiais');
  await expect(aviso).toContainText('não muda nada aqui');

  const faturamento = page.locator('.tile').filter({ hasText: 'Faturamento' });
  await expect(faturamento).toContainText('R$ 3.169,50');

  await escolherFilial(page, FAKE_BRANCH_2);

  // O MESMO número: é exatamente isso que o aviso afirma. Se um dia o backend
  // ganhar `branch_id`, este teste é o que avisa que o aviso ficou mentiroso.
  await expect(faturamento).toContainText('R$ 3.169,50');
  await expect(aviso).toBeVisible();
});

/*
 * NÃO EXISTE ROTA POR HORA no contrato, e a tela não reserva lugar para uma:
 * espaço guardado para o que ninguém prometeu construir é ruído permanente.
 */
test('não há gráfico nem lugar reservado para horários de pico', async ({ page }) => {
  await abrirDesempenho(page);

  await expect(page.getByText(/hor[áa]rio de pico/i)).toHaveCount(0);
  await expect(page.getByText(/por hora/i)).toHaveCount(0);
});

test('o período troca entre 7 e 30 dias, e "Escolher…" abre as datas', async ({ page }) => {
  await abrirDesempenho(page);

  await expect(page.getByTestId('perf-period-last7')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Data inicial')).toHaveCount(0);

  await page.getByTestId('perf-period-last30').click();
  await expect(page.getByTestId('perf-period-last30')).toHaveAttribute('aria-pressed', 'true');

  await page.getByTestId('perf-period-custom').click();
  await expect(page.getByLabel('Data inicial')).toBeVisible();
  await expect(page.getByLabel('Data final')).toBeVisible();
});

/* Data invertida é barrada aqui, antes do 422 do backend — a frase do Pydantic
   é pior de ler que a nossa. */
test('período invertido é recusado antes de virar requisição', async ({ page }) => {
  await abrirDesempenho(page);

  await page.getByTestId('perf-period-custom').click();
  await page.getByLabel('Data inicial').fill('2026-08-20');
  await page.getByLabel('Data final').fill('2026-08-01');

  await expect(page.getByText('A data inicial é depois da final.')).toBeVisible();
});

/*
 * O gráfico é série única e os números não podem existir só no hover: quem usa
 * teclado ou leitor de tela chega neles pela tabela equivalente.
 */
test('o gráfico de dias tem tabela equivalente para quem não tem ponteiro', async ({ page }) => {
  await abrirDesempenho(page);

  const tabela = page.getByRole('table', { name: 'Faturamento e pedidos por dia' });
  await expect(tabela).toBeAttached();
  await expect(tabela.getByRole('row')).not.toHaveCount(0);
});
