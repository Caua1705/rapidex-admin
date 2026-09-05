/**
 * E2E de Desempenho.
 *
 * A tela é de leitura pura, então o que ela tem de errar em silêncio é o
 * NÚMERO — e todo número errado aqui compila, monta e parece certo. Os testes
 * abaixo cobrem, um a um, os casos em que o contrato tem uma armadilha:
 * comparação nula virando 0%, variação percentual sobre base de um pedido, a
 * ressalva do total de produtos sumindo, e o escopo de filial ficando implícito
 * ao lado de um seletor que filtra.
 *
 * E cobrem a FORMA da tela, que é o que ela tem de mais fácil de perder numa
 * edição futura: quatro cartões de métrica com minissérie; a série no tempo com
 * o período anterior desenhado; a composição com um denominador só; e nenhuma
 * frase que apareça sem que os dados a sustentem.
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

/* ==========================================================================
 * OS QUATRO CARTÕES DE MÉTRICA
 * ======================================================================= */

/*
 * ESTE TESTE MUDOU DE FORMA DUAS VEZES, e o requisito é o mesmo desde sempre:
 * os valores e a comparação, escritos, sem inventar 0%.
 *
 * Ele já se chamou "os três números crus vêm depois da frase, para
 * conferência", quando a frase era a resposta e o número a conferência. A
 * hierarquia virou: o dono abre a tela para DECIDIR, e o que decide é o número
 * com a variação ao lado — "R$ 3.169,50, -6,8%" diz o que a frase dizia com
 * vinte palavras. Agora eles são CARTÕES, e são quatro.
 */
test('o topo são quatro cartões de métrica, cada um com a comparação', async ({ page }) => {
  await abrirDesempenho(page);

  const cartoes = page.locator('.kpi');
  await expect(cartoes).toHaveCount(4);

  const faturamento = page.getByTestId('perf-kpi-faturamento');
  await expect(faturamento).toContainText('Faturamento');
  await expect(faturamento).toContainText('R$ 3.169,50');
  await expect(faturamento).toContainText('-6,8% vs. os 7 dias anteriores');

  await expect(page.getByTestId('perf-kpi-pedidos')).toContainText('54');
  await expect(page.getByTestId('perf-kpi-ticket')).toContainText('R$ 58,69');
  await expect(page.getByTestId('perf-kpi-cancelamento')).toContainText('10%');
});

/*
 * A MINISSÉRIE É O TERCEIRO CANAL DO CARTÃO, e ela responde o que o número e a
 * variação não respondem: "foi assim a semana toda, ou foi um dia?".
 *
 * Três dos quatro cartões a têm (faturamento, pedidos e ticket saem todos do
 * mesmo `sales-by-day`); o de cancelamento não, porque não existe cancelamento
 * dia a dia em rota nenhuma — e no lugar dele vai a contagem e o valor perdido.
 */
test('os cartões trazem a minissérie do período, e o de cancelamento a contagem', async ({
  page,
}) => {
  await abrirDesempenho(page);

  await expect(page.getByTestId('perf-kpi-faturamento').locator('.mini')).toBeVisible();
  await expect(page.getByTestId('perf-kpi-pedidos').locator('.mini')).toBeVisible();
  await expect(page.getByTestId('perf-kpi-ticket').locator('.mini')).toBeVisible();

  const cancelamento = page.locator('.kpi').filter({ hasText: 'Cancelamento' });
  await expect(cancelamento.locator('.mini')).toHaveCount(0);
  await expect(cancelamento).toContainText('6 pedidos');
  await expect(cancelamento).toContainText('R$ 327,00');
});

/*
 * A COR DO QUARTO CARTÃO É INVERTIDA, e a variação vem de uma SEGUNDA chamada.
 *
 * `/reports/cancellations` não devolve o período anterior (só o `summary`
 * faz isso). A tela pede o relatório duas vezes — a técnica do `byDayPrevious`
 * — e escreve a diferença em pontos percentuais: 10% contra 6,5% são
 * +3,5 p.p., e subir aqui é PIOR. Verde para cima nesta linha diria "boa
 * notícia" sobre mais pedidos perdidos.
 *
 * O falso devolve 6,5% para o período anterior de propósito (ver
 * `initialCancellations`): com 10% nos dois, a diferença seria zero e este
 * teste passaria sem nunca ter exercitado a segunda chamada.
 *
 * A SETA CONTINUA APONTANDO PARA CIMA — quem inverte é a COR. Uma seta para
 * baixo num número que subiu mentiria sobre o número.
 */
test('o cancelamento compara com o período anterior, e subir é vermelho', async ({ page }) => {
  await abrirDesempenho(page);

  const cancelamento = page.getByTestId('perf-kpi-cancelamento');
  await expect(cancelamento).toContainText('+3,5 p.p. vs. os 7 dias anteriores');
  await expect(cancelamento.locator('.kpi__delta')).toHaveClass(/kpi__delta--down/);
});

/*
 * A ARMADILHA Nº 1. `change_percent` nulo significa "o período anterior foi
 * zero". Um `?? 0` escreveria "0%" e diria que o ticket médio ficou parado —
 * quando o que houve é que não havia período anterior com movimento. As duas
 * frases levam a decisões opostas.
 */
test('comparação sem período anterior diz "sem comparação", nunca 0%', async ({ page }) => {
  await abrirDesempenho(page);

  const ticket = page.getByTestId('perf-kpi-ticket');
  await expect(ticket).toContainText('sem comparação');
  await expect(ticket).not.toContainText('0%');
});

/*
 * ============================================================================
 * A LOJA QUE ACABOU DE ABRIR — o defeito mais visível da tela antiga
 * ============================================================================
 *
 * Com 54 pedidos agora e UM no período anterior, o backend responde
 * `+5300.0%` com toda a razão aritmética. Desenhar isso é medir o denominador,
 * não a loja — e o inverso (1 pedido antes, 0 agora) pintava "-100%" em
 * vermelho gigante numa loja que só ainda não vendeu hoje.
 *
 * A guarda tem nome e corte declarado (`BASE_MINIMA_PARA_VARIACAO`, cinco
 * pedidos), e o que a tela mostra no lugar NÃO é um travessão mudo: é a BASE,
 * que é a resposta verdadeira para "por que não tem variação aqui".
 */
test('base pequena no período anterior não vira percentual, e sim a base', async ({ page }) => {
  api.lojaNova();
  await abrirDesempenho(page);

  const faturamento = page.getByTestId('perf-kpi-faturamento');
  await expect(faturamento).toContainText('sem comparação — 1 pedido no período anterior');
  await expect(faturamento).not.toContainText('%');

  // E sem direção não há cor: pintar de verde o que não se sabe é afirmar.
  await expect(faturamento.locator('.kpi__delta')).toHaveClass(/kpi__delta--vazio/);
});

/*
 * PERÍODO SEM VENDA É UMA TELA, NÃO OITO BLOCOS ZERADOS.
 *
 * R$ 0,00 repetido em quatro cartões, uma linha rente ao chão e quatro listas
 * em branco não dizem "não vendeu": dizem "a tela quebrou". A linha dos
 * excluídos fica mesmo aqui — zero faturado com dois cancelados é justamente
 * quando os dois precisam ser vistos.
 */
test('período sem venda mantém a FORMA da tela, e troca o conteúdo', async ({ page }) => {
  api.emptyReports();
  await abrirDesempenho(page);

  await expect(page.getByTestId('perf-vazio')).toContainText(
    'Nenhum pedido foi faturado neste período',
  );
  await expect(page.getByTestId('perf-excluidos')).toContainText('2 pedidos não entram');

  /*
   * OS QUATRO CARTÕES CONTINUAM LÁ, COM TRAVESSÃO. Uma versão anterior desta
   * rodada trocava a página inteira por uma frase solta num cartão, e o
   * resultado era pior que o problema: mil pixels de nada, sem nenhuma pista do
   * que aquela tela mostra quando há venda.
   *
   * E travessão NÃO É "zero reais": os dois parecem a mesma coisa e não são. Um
   * faturamento de zero afirmado com todas as letras é a leitura que faz o
   * lojista achar que o painel quebrou.
   */
  await expect(page.locator('.kpi')).toHaveCount(4);

  const faturamento = page.getByTestId('perf-kpi-faturamento');
  await expect(faturamento).toContainText('—');
  await expect(faturamento).toContainText('sem venda no período');
  await expect(faturamento).not.toContainText('0,00');
  await expect(faturamento.locator('.mini')).toHaveCount(0);

  /*
   * E A TAXA DE CANCELAMENTO TAMBÉM TEM PISO DE BASE.
   *
   * Aqui entraram dois pedidos e os dois foram cancelados: o backend responde
   * "100.0" com toda a razão, e como manchete de 28px isso diz "a operação
   * parou". O que a tela mostra é a contagem, que é a informação de verdade e
   * cabe inteira sem inventar uma taxa. Ver `taxaTemBase`.
   */
  const cancelamento = page.getByTestId('perf-kpi-cancelamento');
  await expect(cancelamento).not.toContainText('100%');
  await expect(cancelamento).toContainText('sem taxa — 2 pedidos no período');
  await expect(cancelamento).toContainText('R$ 96,00');

  /* Cada bloco diz o que apareceria ali — o pedido desta rodada, literalmente:
     "um vazio elegante, com uma linha dizendo o que apareceria ali". */
  await expect(page.getByText(/a linha do faturamento dia a dia aparece aqui/i)).toBeVisible();
  await expect(page.getByText(/aqui aparece para onde o dinheiro foi/i)).toBeVisible();
  await expect(page.getByText(/aqui aparecem os cinco que mais saíram/i)).toBeVisible();
  await expect(
    page.getByText(/aqui aparece a divisão entre Pix, cartão e dinheiro/i),
  ).toBeVisible();

  /* E o gráfico não desenha uma linha rente ao chão: sem escala não há série, e
     a tabela equivalente de zeros também não é desenhada. */
  await expect(
    page.getByRole('table', { name: 'Faturamento por dia, com o período anterior' }),
  ).toHaveCount(0);

  // O escopo continua dito: ele qualifica o período, não os números.
  await expect(page.getByTestId('perf-escopo')).toBeVisible();
});

/* ==========================================================================
 * O GRÁFICO — a série no tempo, com o período anterior desenhado
 * ======================================================================= */

/*
 * O PERÍODO ANTERIOR ESTÁ NO GRÁFICO, não só numa frase.
 *
 * `sales-by-day` já era pedido duas vezes, e a segunda série existia na
 * memória e não na tela. Agora as duas são desenhadas, alinhadas dia a dia
 * (o 1º dia deste período sobre o 1º do anterior), e a tabela equivalente —
 * a única forma de ler o gráfico sem ponteiro — traz as duas colunas.
 *
 * A fixture tem o 2º dia em R$ 9,00 agora e R$ 1.400,00 antes: é a linha em
 * que as duas séries mais se afastam, e é a que a tabela precisa mostrar.
 */
test('o gráfico desenha o período anterior junto, e a tabela traz as duas séries', async ({
  page,
}) => {
  await abrirDesempenho(page);

  await expect(page.getByTestId('perf-grafico-legenda')).toContainText('este período');
  await expect(page.getByTestId('perf-grafico-legenda')).toContainText('os 7 dias anteriores');

  const tabela = page.getByRole('table', { name: 'Faturamento por dia, com o período anterior' });
  await expect(tabela).toBeAttached();
  await expect(tabela.getByRole('columnheader', { name: 'Este período' })).toBeAttached();
  await expect(tabela.getByRole('columnheader', { name: 'Período anterior' })).toBeAttached();

  const segundoDia = tabela.getByRole('row').nth(2);
  await expect(segundoDia).toContainText('R$ 9,00');
  await expect(segundoDia).toContainText('R$ 1.400,00');
});

/*
 * A MESMA ROTA TRAZ PEDIDOS POR DIA, e a tela alterna sem pedir nada de novo.
 * O que muda é a medida, e a tabela equivalente acompanha — senão o leitor de
 * tela ficaria com o faturamento enquanto o olho vê pedidos.
 */
test('o gráfico alterna entre faturamento e pedidos', async ({ page }) => {
  await abrirDesempenho(page);

  await expect(page.getByTestId('perf-medida-faturamento')).toHaveAttribute('aria-pressed', 'true');

  await page.getByTestId('perf-medida-pedidos').click();
  await expect(page.getByTestId('perf-medida-pedidos')).toHaveAttribute('aria-pressed', 'true');

  await expect(
    page.getByRole('table', { name: 'Pedidos por dia, com o período anterior' }),
  ).toBeAttached();
  await expect(
    page.getByRole('table', { name: 'Faturamento por dia, com o período anterior' }),
  ).toHaveCount(0);
});

/*
 * A FRASE-VEREDITO SOBREVIVEU À PODA, e sobreviveu como LEGENDA do gráfico.
 *
 * Ela era a primeira coisa da tela; hoje as onze outras frases saíram e ela
 * ficou, porque é a única que diz o que a forma não diz: a CAUSA por dia
 * ("puxado para baixo por…"). Ela não repete o valor em reais, que já está no
 * cartão logo acima.
 */
test('a única frase do topo é a legenda do gráfico, e nomeia os dias que explicam', async ({
  page,
}) => {
  await abrirDesempenho(page);

  const veredito = page.getByTestId('perf-veredito');
  await expect(veredito).toContainText('6,8% menos que os 7 dias anteriores');
  await expect(veredito).toContainText('puxado para baixo por');
  await expect(veredito).not.toContainText('3.169,50');
});

/*
 * ============================================================================
 * NÃO EXISTE FATURAMENTO POR HORA — e o requisito continua o mesmo
 * ============================================================================
 *
 * O que ele protege é que a tela não INVENTE um recorte que o backend não
 * entrega. Nenhuma das seis rotas de relatório desce abaixo do dia, então um
 * "horário de pico de faturamento" só poderia sair de estimativa — e
 * estimativa nesta tela é proibida. O agrupamento do gráfico é dia ou semana; a
 * hora não está entre as opções porque ela não existe. O pedido ao backend
 * está em `scratchpad/pedido-backend-desempenho.md`.
 *
 * O que existe por hora é de outra natureza e vem de outra rota: a HORA DE
 * ENTRADA dos pedidos que não viraram venda, contada a partir do `created_at`
 * de `GET /admin/orders`. É contagem, não dinheiro.
 */
test('não há faturamento por hora, e o pico de vendas não é inventado', async ({ page }) => {
  await abrirDesempenho(page);

  await expect(page.getByText(/hor[áa]rio de pico/i)).toHaveCount(0);
  await expect(page.getByText(/faturamento por hora/i)).toHaveCount(0);

  // A tabela equivalente do gráfico continua sendo a única série de DINHEIRO da
  // tela — a de hora conta pedidos.
  await expect(
    page.getByRole('table', { name: 'Faturamento por dia, com o período anterior' }),
  ).toBeAttached();
});

/* ==========================================================================
 * A COMPOSIÇÃO — para onde o dinheiro foi
 * ======================================================================= */

/*
 * UM DENOMINADOR SÓ NO CARTÃO INTEIRO.
 *
 * A identidade do contrato é `revenue_total = subtotal + entrega + serviço −
 * desconto`. O desconto é uma SUBTRAÇÃO, não uma fatia, e desenhá-lo como uma
 * quarta parcela ao lado das outras três somaria mais de 100% de um todo de
 * 100. Por isso ele aparece com sinal de menos, depois de um fio, medido
 * contra o mesmo bruto.
 *
 * A fixture: bruto = 94% + 7,57% + 3,41% de 3.169,50 = 3.331,66. Produtos são
 * 2.979,33, ou 89,4% dele.
 */
test('a composição divide o bruto e separa o que sai dele', async ({ page }) => {
  await abrirDesempenho(page);

  const composicao = page.getByTestId('perf-composicao');
  await expect(composicao).toContainText('Produtos');
  await expect(composicao).toContainText('R$ 2.979,33');
  await expect(composicao).toContainText('89,5%');
  await expect(composicao).toContainText('Taxa de entrega');
  await expect(composicao).toContainText('Taxa de serviço');

  // As saídas levam o sinal de menos, para não serem lidas como quarta parcela.
  await expect(composicao).toContainText('− R$ 158,48'); // desconto: 5% de 3.169,50
  await expect(composicao).toContainText('Comissão da plataforma');
});

/*
 * O CASHBACK QUE A TELA MOSTRA É O RESGATADO, e o nome é a informação.
 *
 * "Concedido" (o crédito gerado na venda) não existe em resposta nenhuma de
 * `/admin`. O que existe é `CommissionReportItem.cashback_redeemed_amount`,
 * pedido a pedido — o que o cliente GASTOU do saldo em pedidos do período.
 * Chamar um do outro seria uma mentira de uma palavra sobre dinheiro.
 */
test('o cashback aparece como RESGATADO, somado do extrato de comissão', async ({ page }) => {
  await abrirDesempenho(page);

  const composicao = page.getByTestId('perf-composicao');
  await expect(composicao).toContainText('Cashback resgatado');
  await expect(composicao).not.toContainText('Cashback concedido');
});

/* ==========================================================================
 * DE ONDE VEM — as filiais lado a lado
 * ======================================================================= */

/*
 * A PERGUNTA QUE A SOMA ENGOLIA. Para quem tem duas lojas, "qual das duas vai
 * melhor" é a primeira pergunta, e a tela respondia com um pedido de desculpas:
 * somava as duas e avisava que estava somando.
 *
 * A fixture divide 3.169,50 em 1.820,00 (Aldeota) e 1.349,50 (Zona Norte), e a
 * soma FECHA — é isso que este teste prova junto: as partes somam o todo que o
 * cartão do topo mostra.
 */
test('em "todas as filiais", a tela compara as lojas em vez de só somá-las', async ({ page }) => {
  await abrirDesempenho(page);

  const filiais = page.getByTestId('perf-filiais');
  await expect(filiais).toContainText(branchName(FAKE_BRANCH));
  await expect(filiais).toContainText(branchName(FAKE_BRANCH_2));
  await expect(filiais).toContainText('R$ 1.820,00');
  await expect(filiais).toContainText('R$ 1.349,50');

  // O cartão do topo continua mostrando a soma das duas.
  await expect(page.getByTestId('perf-kpi-faturamento')).toContainText('R$ 3.169,50');
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
 * A SEGUNDA (E ÚLTIMA) FRASE DA TELA. Na fixture a rede caiu 6,8% — mas ela
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
 * COM UMA FILIAL ESCOLHIDA A COMPARAÇÃO SOME, e o cartão NÃO fica vazio: ele
 * troca de assunto.
 *
 * Não é economia de espaço — a linha de escopo passa a afirmar "estes números
 * são da filial X", e pôr o faturamento da vizinha ao lado faria a tela
 * contradizer a própria legenda três centímetros depois de escrevê-la. O que
 * entra no lugar responde outra pergunta que o mesmo `summary` já traz.
 *
 * (O gerente nunca chega em "todas as filiais": `ensure_pode_ler_dinheiro`
 * recusa quem não é dono sem recorte, e a tela pede a filial antes de pedir os
 * relatórios. Ver `papeis.spec.ts`.)
 */
test('com uma filial escolhida, o cartão das filiais dá lugar a entrega × retirada', async ({
  page,
}) => {
  await abrirDesempenho(page);
  await expect(page.getByTestId('perf-filiais')).toBeVisible();
  await expect(page.getByTestId('perf-tipos')).toHaveCount(0);

  await escolherFilial(page, FAKE_BRANCH_2);

  await expect(page.getByTestId('perf-filiais')).toHaveCount(0);
  await expect(page.getByTestId('perf-tipos')).toBeVisible();
  await expect(page.getByTestId('perf-escopo')).toContainText('da filial');
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
 * uma loja e para a rede.
 */
test('a tela diz de qual recorte são os números, e o seletor do topo os muda', async ({ page }) => {
  await abrirDesempenho(page);

  const aviso = page.getByTestId('perf-escopo');
  await expect(aviso).toContainText('todas as filiais');

  const faturamento = page.getByTestId('perf-kpi-faturamento');
  await expect(faturamento).toContainText('R$ 3.169,50');

  await escolherFilial(page, FAKE_BRANCH_2);

  // O número MUDA, e o aviso passa a nomear a loja. Sem uma das duas coisas o
  // lojista leria o faturamento de uma loja como o da rede, ou o contrário.
  await expect(faturamento).toContainText('R$ 1.349,50');
  await expect(aviso).toContainText('da filial');
  await expect(aviso).toContainText(branchName(FAKE_BRANCH_2));
});

/* ==========================================================================
 * O QUE VENDE × COMO PAGAM
 * ======================================================================= */

/*
 * A TABELA DE QUATRO COLUNAS VIROU CINCO LINHAS COM BARRA.
 *
 * A barra mede UNIDADES, que é o que ordena a lista (`/reports/products`
 * devolve o ranking por unidades vendidas): uma barra de receita numa lista
 * ordenada por unidade desenharia uma escada fora de ordem, e o lojista
 * concluiria que a tela está errada.
 */
test('os produtos viram cinco linhas com barra, quantidade e faturamento', async ({ page }) => {
  await abrirDesempenho(page);

  const produtos = page.getByTestId('perf-produtos');
  await expect(produtos.locator('.ranking__linha')).toHaveCount(5);

  const primeiro = produtos.locator('.ranking__linha').first();
  await expect(primeiro).toContainText('Pizza Calabresa G');
  await expect(primeiro).toContainText('unidades');
  await expect(primeiro).toContainText('pedidos');
});

/*
 * A ARMADILHA Nº 2. `listed_revenue_total` NÃO fecha com o faturamento do
 * resumo — é receita bruta de item, sem cupom, cashback nem taxas. Os dois
 * números na mesma tela sem a ressalva fazem a tela parecer com erro de conta,
 * e o texto vem pronto do backend em `revenue_note`.
 */
test('o total de produtos vem com a ressalva do backend colada nele', async ({ page }) => {
  await abrirDesempenho(page);

  const cartao = page.locator('.ds-card').filter({ hasText: 'Produtos mais vendidos' });
  await expect(cartao).toContainText('R$ 2.495,60');
  await expect(cartao).toContainText('não fecha com o faturamento do resumo');
});

/*
 * ESTE TESTE MUDOU DE FORMA. Chamava-se "forma de pagamento é uma frase
 * acionável, não uma tabela decorativa", e uma rodada anterior tinha reduzido a
 * rota inteira a UMA frase condicional — "57,4% em Pix não muda decisão".
 *
 * Muda: a taxa de cada meio é diferente, e o dinheiro em espécie é troco e
 * risco. A distribuição volta como FATIAS (poucos valores comparáveis, cada um
 * com sua barra — a mesma peça de entrega × retirada), sem virar tabela de
 * quatro colunas. E `payment_method` nulo continua sendo "sem forma
 * registrada", nunca "Outro" — que é uma forma de pagamento de verdade.
 */
test('as formas de pagamento são desenhadas, e a nula não vira "Outro"', async ({ page }) => {
  await abrirDesempenho(page);

  const pagamentos = page.getByTestId('perf-pagamentos');
  await expect(pagamentos).toContainText('Pix');
  await expect(pagamentos).toContainText('R$ 1.820,00');
  await expect(pagamentos).toContainText('57,4%');
  await expect(pagamentos).toContainText('Sem forma registrada');
  await expect(pagamentos).not.toContainText('Outro');

  await expect(page.getByRole('table', { name: 'Faturamento por forma de pagamento' })).toHaveCount(
    0,
  );
});

/*
 * O BAIRRO NÃO EXISTE, E A TELA NÃO O INVENTA.
 *
 * `AdminOrderListItem` não traz endereço nenhum — o bairro só aparece em
 * `OrderDetailResponse`, um pedido por vez. Ler o bairro de um mês seria uma
 * requisição por pedido. Este teste é a fechadura contra "completar o quadro"
 * com uma estimativa por CEP ou por entregador.
 */
test('não existe bloco de bairros, e a ausência está escrita', async ({ page }) => {
  await abrirDesempenho(page);

  await expect(page.getByText(/pedidos por bairro/i)).toHaveCount(0);
  await expect(page.getByTestId('perf-limites')).toContainText('bairro');
});

/* ==========================================================================
 * O RODAPÉ — o que não virou venda
 * ======================================================================= */

/*
 * A QUEBRA É UMA LISTA, E O PONTO SAI DO ESTÁGIO.
 *
 * `is-<estágio>` e não `is-<status do backend>`: a escala de cor tem sete
 * estágios visuais e a máquina de estados do backend tem mais nomes. Escrever
 * `is-cancelled` daria uma classe que não existe e um ponto sem cor — sem nada
 * quebrar, que é o pior desfecho.
 */
test('o que não virou venda mostra situação, pagamento, contagem e valor', async ({ page }) => {
  await abrirDesempenho(page);

  const quebra = page.getByTestId('perf-quebra');
  await expect(quebra).toContainText('Cancelado');
  await expect(quebra).toContainText('pedidos');
  await expect(quebra.locator('.is-cancelado')).not.toHaveCount(0);
});

/*
 * O DADO DA HORA VEM DA LISTAGEM DE PEDIDOS, e não do relatório de
 * cancelamentos — `/reports/cancellations` cruza situação com pagamento e não
 * tem relógio nenhum. A fixture põe seis pedidos que não viraram venda há três
 * dias, três deles às 20h locais.
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
 * A PODA DA PROSA, E O QUE SOBROU
 * ======================================================================= */

/*
 * ESTE TESTE É NOVO, E É A FECHADURA DA RODADA.
 *
 * A tela tinha DOZE frases de leitura, uma por regra de `insights.ts`, e o
 * diagnóstico do dono foi que ela "parece um relatório de texto". Sobraram
 * duas, e cada uma diz o que a forma não diz: o veredito com a causa por dia, e
 * o contraste entre filiais.
 *
 * Sem esta contagem, a poda se desfaz sozinha na próxima rodada — cada frase
 * de volta parece inofensiva, e as doze voltam uma a uma.
 */
test('sobraram DUAS frases de leitura na tela inteira', async ({ page }) => {
  await abrirDesempenho(page);

  await expect(page.locator('[data-testid^="perf-frase-"]')).toHaveCount(1);
  await expect(page.getByTestId('perf-veredito')).toHaveCount(1);

  // As que saíram, nomeadas: elas continuam em `insights.ts`, sem consumidor.
  await expect(page.getByTestId('perf-frase-ticket-ou-volume')).toHaveCount(0);
  await expect(page.getByTestId('perf-frase-dia-fraco')).toHaveCount(0);
  await expect(page.getByTestId('perf-frase-desconto')).toHaveCount(0);
  await expect(page.getByTestId('perf-frase-concentracao')).toHaveCount(0);
});

/*
 * Das cinco perguntas do dono, quatro coisas não têm dado no backend hoje: quem
 * compra (novo × recorrente e o cashback concedido), o tempo de preparo, o
 * faturamento por hora e o bairro. Os pedidos estão em
 * `scratchpad/pedido-backend-desempenho.md`.
 *
 * Uma tela de desempenho que finge cobrir tudo é pior que uma que diz onde não
 * enxerga. A linha é uma, no pé — não uma seção vazia com título anunciando o
 * nada. Este teste é a fechadura contra as duas saídas erradas: apagar a linha
 * (silêncio) ou preencher a pergunta com o que sobrou.
 */
test('a tela diz o que ainda não responde, e por quê', async ({ page }) => {
  await abrirDesempenho(page);

  const limites = page.getByTestId('perf-limites');
  await expect(limites).toContainText('quem compra');
  await expect(limites).toContainText('tempo de preparo');
  await expect(limites).toContainText('backend');
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
