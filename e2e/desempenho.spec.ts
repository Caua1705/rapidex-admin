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

import {
  installFakeApi,
  FAKE_BRANCH,
  FAKE_BRANCH_2,
  LOGIN_EMAIL,
  LOGIN_PASSWORD,
  type FakeApi,
} from './fake-api';
import { escolherFilial } from './seletor';
import { branchName } from '../src/layout/branch-heading';

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
    '6 pedidos não entram nestes números',
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
  await expect(secao).toContainText('R$ 2.495,60');
  await expect(secao).toContainText('não fecha com o faturamento do resumo');
});

/*
 * O ESCOPO, ESCRITO — E ELE MUDOU DE ASSUNTO.
 *
 * Este teste afirmava o contrário: que as rotas NÃO aceitavam `branch_id`, que
 * o aviso dizia "o seletor do topo não muda nada aqui", e que trocar de filial
 * devolvia o MESMO faturamento. Ele até previu a virada, por escrito — "se um
 * dia o backend ganhar `branch_id`, este teste é o que avisa que o aviso ficou
 * mentiroso". Ganhou, na revisão `20260820_0026`, e foi ele que avisou.
 *
 * O REQUISITO NÃO MUDOU, só a forma: a tela tem de dizer QUAL recorte produziu
 * estes números, porque "faturou R$ 12 mil" significa coisas diferentes para
 * uma loja e para a rede. Antes isso se provava mostrando que o seletor não
 * pegava; agora, mostrando que ele pega e que o aviso o acompanha.
 */
test('a tela diz de qual recorte são os números, e o seletor do topo os muda', async ({ page }) => {
  await abrirDesempenho(page);

  const aviso = page.getByTestId('perf-escopo');
  await expect(aviso).toContainText('todas as filiais');

  const faturamento = page.locator('.numeros__item').filter({ hasText: 'Faturamento' });
  await expect(faturamento).toContainText('R$ 3.169,50');

  await escolherFilial(page, FAKE_BRANCH_2);

  // O número MUDA, e o aviso passa a nomear a loja. Sem uma das duas coisas o
  // lojista leria o faturamento de uma loja como o da rede, ou o contrário.
  await expect(faturamento).toContainText('R$ 1.349,50');
  await expect(aviso).toContainText('da filial');
  await expect(aviso).toContainText(branchName(FAKE_BRANCH_2));
});

/*
 * ============================================================================
 * NÃO EXISTE FATURAMENTO POR HORA — e o requisito continua o mesmo
 * ============================================================================
 *
 * ESTE TESTE MUDOU DE FORMA, NÃO DE ASSUNTO. Ele dizia "não há gráfico por
 * hora, ponto", e o que ele protegia era outra coisa: que a tela não INVENTE um
 * recorte que o backend não entrega. Nenhuma das seis rotas de relatório desce
 * abaixo do dia, então um "horário de pico de faturamento" só poderia sair de
 * estimativa — e estimativa nesta tela é proibida.
 *
 * O que passou a existir é de outra natureza e vem de outra rota: a HORA DE
 * ENTRADA dos pedidos que não viraram venda, contada a partir do `created_at`
 * de `GET /admin/orders`. É contagem, não dinheiro, e ela vive dentro de "O que
 * não virou venda". A asserção abaixo separa as duas coisas.
 */
test('não há faturamento por hora, e o pico de vendas não é inventado', async ({ page }) => {
  await abrirDesempenho(page);

  await expect(page.getByText(/hor[áa]rio de pico/i)).toHaveCount(0);
  await expect(page.getByText(/faturamento por hora/i)).toHaveCount(0);

  // A tabela equivalente do gráfico de dias continua sendo a única série de
  // DINHEIRO da tela — a de hora conta pedidos.
  await expect(page.getByRole('table', { name: 'Faturamento e pedidos por dia' })).toBeAttached();
});

/* ==========================================================================
 * LOTE 6 — AS FILIAIS LADO A LADO
 * ======================================================================= */

/*
 * A PERGUNTA QUE A SOMA ENGOLIA. Para quem tem duas lojas, "qual das duas vai
 * melhor" é a primeira pergunta, e a tela respondia com um pedido de desculpas:
 * somava as duas e avisava que estava somando.
 *
 * A fixture divide 3.169,50 em 1.820,00 (Aldeota) e 1.349,50 (Zona Norte), e a
 * soma FECHA — é isso que este teste prova junto: as partes somam o todo que a
 * banda do topo mostra.
 */
test('em "todas as filiais", a tela compara as lojas em vez de só somá-las', async ({ page }) => {
  await abrirDesempenho(page);

  const filiais = page.getByTestId('perf-filiais');
  await expect(filiais).toContainText(branchName(FAKE_BRANCH));
  await expect(filiais).toContainText(branchName(FAKE_BRANCH_2));
  await expect(filiais).toContainText('R$ 1.820,00');
  await expect(filiais).toContainText('R$ 1.349,50');

  // A banda do topo continua mostrando a soma das duas.
  const faturamento = page.locator('.numeros__item').filter({ hasText: 'Faturamento' });
  await expect(faturamento).toContainText('R$ 3.169,50');
});

/*
 * A ORDEM É A RESPOSTA: maior faturamento primeiro. Em ordem alfabética ou na
 * ordem em que o token devolveu as filiais, "qual vai melhor" voltaria a exigir
 * que o olho comparasse dois números de quatro dígitos.
 */
test('a comparação vem ordenada por faturamento, maior primeiro', async ({ page }) => {
  await abrirDesempenho(page);

  const linhas = page.getByTestId('perf-filiais').locator('.fatias__rotulo');
  await expect(linhas.first()).toHaveText(branchName(FAKE_BRANCH));
  await expect(linhas.last()).toHaveText(branchName(FAKE_BRANCH_2));
});

/*
 * A FRASE QUE DESMONTA O NÚMERO DO TOPO. Na fixture a rede caiu 6,8% — mas ela
 * não caiu por igual: a Aldeota SUBIU 14,5% e a Zona Norte caiu 25,5%. Sem esta
 * frase, o dono leria "a semana foi pior" e procuraria a causa na rede inteira.
 */
test('a comparação diz quando uma loja subiu e a outra caiu', async ({ page }) => {
  await abrirDesempenho(page);

  const frase = page.getByTestId('perf-frase-filial-contraste');
  await expect(frase).toContainText(branchName(FAKE_BRANCH));
  await expect(frase).toContainText(branchName(FAKE_BRANCH_2));
  await expect(frase).toContainText('não foi a rede, foi uma loja');
});

/*
 * COM UMA FILIAL ESCOLHIDA A COMPARAÇÃO SOME, e não é economia de espaço: a
 * linha de escopo passa a afirmar "estes números são da filial X", e pôr o
 * faturamento da vizinha logo abaixo faria a tela contradizer a própria legenda
 * três centímetros depois de escrevê-la.
 *
 * (O gerente nunca chega em "todas as filiais": `ensure_pode_ler_dinheiro`
 * recusa quem não é dono sem recorte, e a tela pede a filial antes de pedir os
 * relatórios. Ver `papeis.spec.ts`.)
 */
test('com uma filial escolhida, a tela é sobre ela e não compara', async ({ page }) => {
  await abrirDesempenho(page);
  await expect(page.getByTestId('perf-filiais')).toBeVisible();

  await escolherFilial(page, FAKE_BRANCH_2);

  await expect(page.getByTestId('perf-filiais')).toHaveCount(0);
  await expect(page.getByTestId('perf-escopo')).toContainText('da filial');
});

/* ==========================================================================
 * LOTE 6 — A HORA DOS CANCELAMENTOS
 * ======================================================================= */

/*
 * O DADO VEM DA LISTAGEM DE PEDIDOS, e não do relatório de cancelamentos —
 * `/reports/cancellations` cruza situação com pagamento e não tem relógio
 * nenhum. A fixture põe seis pedidos que não viraram venda há três dias, três
 * deles às 20h locais.
 */
test('os cancelamentos ganham corte por horário, com a hora que concentra', async ({ page }) => {
  await abrirDesempenho(page);

  const horas = page.getByTestId('perf-horas');
  await expect(horas).toContainText('A que horas eles entraram');

  const tabela = page.getByRole('table', {
    name: 'Pedidos que não viraram venda, por hora de entrada',
  });
  await expect(tabela).toBeAttached();
  await expect(tabela.getByRole('row')).not.toHaveCount(0);

  await expect(page.getByTestId('perf-frase-hora-cancelamento')).toContainText('20h');
});

/*
 * A HORA É A DE ENTRADA, E A TELA DIZ ISSO.
 *
 * `AdminOrderListItem` devolve `created_at`; o instante do CANCELAMENTO não
 * está no contrato. A diferença importa — um pedido que entra às 20h e é
 * recusado às 20h05 e outro que entra às 20h e é cancelado às 21h30 caem os
 * dois nas 20h, e a ação que cada um pede não é a mesma. Chamar isso de "hora
 * do cancelamento" seria uma mentira de uma palavra.
 */
test('a tela não chama a hora de entrada de "hora do cancelamento"', async ({ page }) => {
  await abrirDesempenho(page);

  await expect(page.getByTestId('perf-horas')).toContainText('hora é a de ENTRADA do pedido');
  await expect(page.getByText(/hora em que foi cancelado/i)).toHaveCount(0);
});

/* ==========================================================================
 * LOTE 6 — OS GRUPOS DE PRODUTO
 * ======================================================================= */

/*
 * RANKING DIZ O QUE VENDE, GRUPO DIZ O QUE FAZER. Os dois convivem, e a ordem
 * é a decisão: o grupo primeiro, porque a premissa da tela é que o dono abre o
 * painel para saber o que fazer amanhã.
 *
 * A fixture tem os três grupos povoados de propósito — com três produtos, como
 * era antes, todos caíam em "campeões" e dois dos ramos ficavam sem teste.
 */
test('os produtos viram grupos de ação, e o ranking continua embaixo', async ({ page }) => {
  await abrirDesempenho(page);

  await expect(page.getByTestId('perf-grupo-campeoes')).toContainText('Pizza Calabresa G');
  await expect(page.getByTestId('perf-grupo-promissores')).toContainText('Refrigerante lata');
  await expect(page.getByTestId('perf-grupo-repensaveis')).toContainText('Água 500 ml');

  /*
    O CORTE ESTÁ ESCRITO NA TELA, e o teste continua cobrando isso — mudou o
    LUGAR, não o requisito: ele morava dentro de cada grupo e virou uma legenda
    para os três, porque a mesma régua explicada em três frases quase iguais
    gastava três linhas (§8). "Campeão" sem o corte continua sendo uma opinião,
    e é isso que a asserção protege.
  */
  await expect(page.getByTestId('perf-sem-sazonais')).toContainText('campeão a partir de 5%');

  const secao = page.locator('.perf__secao').filter({ hasText: 'O que vendeu' });
  await expect(secao).toContainText('Ranking por unidades');
});

/*
 * ============================================================================
 * O QUARTO GRUPO NÃO EXISTE, E A TELA DIZ POR QUÊ — não fica em silêncio
 * ============================================================================
 *
 * "Sazonais" é o quarto nome do padrão de mercado, e ele não é detectável com o
 * que o contrato devolve: `/reports/products` traz um período agregado por vez,
 * sem recorte de tempo dentro dele. Uma variação entre duas janelas não separa
 * sazonalidade de crescimento, de promoção, de item em falta nem de estreia.
 *
 * Este teste é a fechadura: quem for "completar os quatro quadrantes" quebra
 * aqui em vez de publicar um chute que tira um prato do cardápio de alguém.
 */
test('não existe grupo de sazonais, e a tela explica a ausência', async ({ page }) => {
  await abrirDesempenho(page);

  await expect(page.getByTestId('perf-grupo-sazonais')).toHaveCount(0);
  await expect(page.getByTestId('perf-sem-sazonais')).toContainText('seria chute');
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
