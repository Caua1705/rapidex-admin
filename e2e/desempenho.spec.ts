/**
 * E2E de Desempenho.
 *
 * A tela é de leitura pura, então o que ela tem de errar em silêncio é o
 * NÚMERO — e todo número errado aqui compila, monta e parece certo. Os testes
 * abaixo cobrem, um a um, os casos em que o contrato tem uma armadilha:
 * comparação nula virando 0%, a ressalva do total de produtos sumindo, e o
 * escopo de filial ficando implícito ao lado de um seletor que não filtra.
 *
 * E cobrem a premissa da tela, que é o que ela tem de mais fácil de perder numa
 * edição futura: A PRIMEIRA COISA DA PÁGINA É UMA FRASE, e nenhuma frase
 * aparece sem que os dados a sustentem.
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

/*
 * A PREMISSA DA TELA, em forma de teste.
 *
 * O veredito é a primeira coisa depois do cabeçalho e da barra de período, e
 * ele é uma FRASE: direção, tamanho da variação e valor, numa sentença que o
 * lojista lê de pé, sem interpretar gráfico nenhum.
 */
test('a primeira coisa da tela é uma frase, não um número', async ({ page }) => {
  await abrirDesempenho(page);

  const veredito = page.getByTestId('perf-veredito');
  await expect(veredito).toContainText('6,8% menos que os 7 dias anteriores');
  /* O valor em reais fica nos três números abaixo, não na frase: os dois na
     mesma dobra seriam a mesma informação duas vezes (§8). */
  await expect(veredito).not.toContainText('3.169,50');
});

/*
 * A CAUSA VEM DA SEGUNDA CHAMADA DE `sales-by-day`.
 *
 * O fake devolve uma série diferente para o período anterior (ver
 * `VALORES_ANTERIORES`), com um único dia muito maior: a queda do período tem
 * um culpado, e a frase tem de nomeá-lo. Sem a segunda chamada, esta asserção
 * é a que falha.
 */
test('a frase nomeia os dias que explicam a variação', async ({ page }) => {
  await abrirDesempenho(page);

  await expect(page.getByTestId('perf-veredito')).toContainText('puxado para baixo por');
});

/*
 * PERÍODO SEM VENDA É UMA TELA, NÃO SEIS SEÇÕES ZERADAS.
 *
 * R$ 0,00 repetido em três números, um gráfico rente ao chão e quatro tabelas
 * vazias não dizem "não vendeu": dizem "a tela quebrou". A linha dos excluídos
 * fica mesmo aqui — zero faturado com dois cancelados é justamente quando os
 * dois precisam ser vistos.
 */
test('período sem venda diz isso, em vez de mostrar seis seções zeradas', async ({ page }) => {
  api.emptyReports();
  await abrirDesempenho(page);

  await expect(page.getByTestId('perf-vazio')).toContainText(
    'Nenhum pedido foi faturado neste período',
  );
  await expect(page.getByTestId('perf-excluidos')).toContainText('2 pedidos não entram');

  await expect(page.locator('.numeros__item')).toHaveCount(0);
  await expect(page.locator('.perf__secao')).toHaveCount(0);

  // O escopo continua dito: ele qualifica o período, não os números.
  await expect(page.getByTestId('perf-escopo')).toBeVisible();
});

test('os três números crus vêm depois da frase, para conferência', async ({ page }) => {
  await abrirDesempenho(page);

  const faturamento = page.locator('.numeros__item').filter({ hasText: 'Faturamento' });
  await expect(faturamento).toContainText('R$ 3.169,50');
  await expect(faturamento).toContainText('-6,8% vs. os 7 dias anteriores');

  await expect(page.locator('.numeros__item').filter({ hasText: 'Ticket médio' })).toContainText(
    'R$ 58,69',
  );
  await expect(page.locator('.numeros__item').filter({ hasText: 'Pedidos' })).toContainText('54');
});

/*
 * A ARMADILHA Nº 1. `change_percent` nulo significa "o período anterior foi
 * zero". Um `?? 0` escreveria "0%" e diria que o ticket médio ficou parado —
 * quando o que houve é que não havia período anterior com movimento. As duas
 * frases levam a decisões opostas.
 */
test('comparação sem período anterior diz "sem comparação", nunca 0%', async ({ page }) => {
  await abrirDesempenho(page);

  const item = page.locator('.numeros__item').filter({ hasText: 'Ticket médio' });
  await expect(item).toContainText('sem comparação');
  await expect(item).not.toContainText('0%');
});

/*
 * A LINHA DOS EXCLUÍDOS É PERMANENTE, e fica colada no faturamento, porque é o
 * faturamento que ela qualifica.
 */
test('os pedidos excluídos são ditos junto do número que eles qualificam', async ({ page }) => {
  await abrirDesempenho(page);

  await expect(page.getByTestId('perf-excluidos')).toContainText(
    '3 pedidos não entram nestes números',
  );
});

/*
 * A SEÇÃO DE FORMAS DE PAGAMENTO SAIU — e é de propósito.
 *
 * A rota existe e devolve a tabela inteira, mas "57,4% em Pix" não muda decisão
 * nenhuma do lojista: é gráfico decorativo. O que sobrou é uma frase, e só
 * quando o número vira ação — aqui, dinheiro acima do limiar, que é troco a
 * separar antes do turno.
 */
test('forma de pagamento é uma frase acionável, não uma tabela decorativa', async ({ page }) => {
  await abrirDesempenho(page);

  await expect(page.getByRole('table', { name: 'Faturamento por forma de pagamento' })).toHaveCount(
    0,
  );
  await expect(page.getByTestId('perf-frase-pagamento-dinheiro')).toContainText('troco');
});

/*
 * TODA FRASE TEM LIMIAR, E O QUE NÃO BATE NÃO APARECE.
 *
 * Na fixture a retirada é 20,8% do faturamento — abaixo do limiar em que ela
 * vira canal. A tela não escreve uma frase morna sobre isso: fica sem frase.
 */
test('frase cuja condição não bate simplesmente não aparece', async ({ page }) => {
  await abrirDesempenho(page);

  await expect(page.getByTestId('perf-frase-retirada')).toHaveCount(0);
  // A de concentração bate (um produto é 60% da receita listada) e aparece.
  await expect(page.getByTestId('perf-frase-concentracao')).toContainText('Pizza Calabresa G');
});

/*
 * A ARMADILHA Nº 2. `listed_revenue_total` NÃO fecha com o faturamento do
 * resumo — é receita bruta de item, sem cupom, cashback nem taxas. Os dois
 * números na mesma tela sem a ressalva fazem a tela parecer com erro de conta,
 * e o texto vem pronto do backend em `revenue_note`.
 */
test('o total de produtos vem com a ressalva do backend colada nele', async ({ page }) => {
  await abrirDesempenho(page);

  const secao = page.locator('.perf__secao').filter({ hasText: 'O que vendeu' });
  await expect(secao).toContainText('R$ 1.947,60');
  await expect(secao).toContainText('não fecha com o faturamento do resumo');
});

/*
 * O ESCOPO, ESCRITO.
 *
 * Nenhuma das rotas aceita `branch_id`, e o seletor de filial do topo continua
 * visível em toda tela do painel. Sem o aviso, ele pareceria um filtro que
 * pegou, e o lojista leria o faturamento de duas lojas como o de uma.
 *
 * O teste vai além do texto: troca de filial no topo e confere que o
 * faturamento NÃO muda — que é a afirmação que o aviso faz.
 */
test('a tela avisa que soma todas as filiais, e o seletor do topo não a muda', async ({ page }) => {
  await abrirDesempenho(page);

  const aviso = page.getByTestId('perf-escopo');
  await expect(aviso).toContainText('todas as filiais');
  await expect(aviso).toContainText('não muda nada aqui');

  const faturamento = page.locator('.numeros__item').filter({ hasText: 'Faturamento' });
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
