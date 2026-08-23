/**
 * E2E de Clientes.
 *
 * A tela é de leitura pura, então não há gravação para conferir. O que ela tem
 * de errar em silêncio é outra coisa: mostrar a lista errada depois de uma
 * busca, mentir sobre o recorte de filial, ou desenhar uma linha em branco
 * para o cliente que comprou sem dizer o nome.
 */
import { expect, test, type Page } from '@playwright/test';

import {
  installFakeApi,
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

async function entrar(page: Page) {
  await page.goto('/clientes');
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel('E-mail').fill(LOGIN_EMAIL);
  await page.getByLabel('Senha').fill(LOGIN_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

async function abrirClientes(page: Page) {
  await entrar(page);

  await page.getByRole('link', { name: 'Clientes' }).click();
  await expect(page).toHaveURL(/\/clientes$/);
  await expect(page.getByRole('heading', { name: 'Clientes', level: 1 })).toBeVisible();
}

/**
 * A mesma tela, alcançada pelo ENDEREÇO e não pela lateral.
 *
 * Abaixo de 768px a navegação é a barra de baixo, que tem quatro alvos e um
 * "Mais" — "Clientes" não é um link visível ali, e o clique da função acima
 * espera para sempre. Quem testa LARGURA precisa chegar na tela sem depender
 * da forma que a navegação tem naquela largura.
 */
async function abrirClientesPorUrl(page: Page) {
  await entrar(page);

  await page.goto('/clientes');
  await expect(page.getByRole('heading', { name: 'Clientes', level: 1 })).toBeVisible();
}

/*
 * O ITEM DEIXOU DE SER "EM BREVE".
 *
 * A lateral lê `nav.ts`, e o campo `soon` é o que decide as duas coisas ao
 * mesmo tempo: a etiqueta na lateral e a rota cair na página de estado. Se
 * alguém devolver o campo, este teste é o que avisa — sem ele, a tela
 * continuaria construída e inalcançável.
 */
test('Clientes é uma tela de verdade, não mais uma página "em breve"', async ({ page }) => {
  await abrirClientes(page);

  await expect(page.getByTestId('coming-soon')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Clientes\s+Em breve/ })).toHaveCount(0);
});

test('lista quem já comprou, com quanto gastou e há quanto tempo', async ({ page }) => {
  await abrirClientes(page);

  const ana = page.getByRole('row').filter({ hasText: 'Ana Paula' });
  await expect(ana).toContainText('(85) 99999-0000');
  await expect(ana).toContainText('12');
  await expect(ana).toContainText('R$ 748,50');
  // Último pedido é DISTÂNCIA, não data: é assim que se acha quem sumiu.
  await expect(ana).toContainText('hoje');

  const marcos = page.getByRole('row').filter({ hasText: 'Marcos Lima' });
  await expect(marcos).toContainText('há 3 meses');
});

/*
 * Cliente que compra no balcão sem se identificar existe, e o contrato deixa
 * `customer_name` vir vazio. A linha não pode sair em branco: quem lê acha que
 * a tela falhou em carregar.
 */
test('cliente sem nome cadastrado é nomeado, não some', async ({ page }) => {
  await abrirClientes(page);

  const semNome = page.getByRole('row').filter({ hasText: '(85) 97777-6666' });
  await expect(semNome).toContainText('Sem nome');
});

/* O fixo de 10 dígitos e o celular de 11 têm agrupamentos diferentes. */
test('telefone fixo sai agrupado como fixo', async ({ page }) => {
  await abrirClientes(page);

  await expect(page.getByRole('row').filter({ hasText: 'Rafael Nunes' })).toContainText(
    '(85) 3222-4444',
  );
});

test('a busca filtra por nome e por telefone, com o mesmo campo', async ({ page }) => {
  await abrirClientes(page);
  const busca = page.getByLabel('Buscar cliente por nome ou telefone');

  await busca.fill('marcos');
  await expect(page.getByRole('row').filter({ hasText: 'Marcos Lima' })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'Ana Paula' })).toHaveCount(0);

  // O MESMO campo aceita telefone — é um termo só, dois critérios, como a rota
  // descreve. Buscar só por nome deixaria metade do contrato sem cobertura.
  await busca.fill('3222');
  await expect(page.getByRole('row').filter({ hasText: 'Rafael Nunes' })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'Marcos Lima' })).toHaveCount(0);
});

test('busca sem resultado diz o termo, e não some com a tela', async ({ page }) => {
  await abrirClientes(page);

  await page.getByLabel('Buscar cliente por nome ou telefone').fill('zzzzz');
  await expect(page.getByText(/Nenhum cliente encontrado para .zzzzz./)).toBeVisible();
});

/*
 * O SELETOR DO TOPO FUNCIONA NESTA TELA.
 *
 * `/admin/customers` aceita `branch_id` em query, então trocar de filial no
 * cabeçalho tem que trocar a lista. Este é o teste que separa "a tela lê o
 * seletor" de "a tela ignora o seletor e mostra tudo sempre" — os dois parecem
 * iguais enquanto só houver uma filial na tela.
 */
test('trocar de filial no topo troca a lista', async ({ page }) => {
  await abrirClientes(page);

  await expect(page.getByRole('row').filter({ hasText: 'Ana Paula' })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'Rafael Nunes' })).toBeVisible();

  await escolherFilial(page, FAKE_BRANCH_2);

  // Rafael é o único da Zona Norte no falso.
  await expect(page.getByRole('row').filter({ hasText: 'Rafael Nunes' })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'Ana Paula' })).toHaveCount(0);
  await expect(page.getByText('1 cliente')).toBeVisible();
});

/* ==========================================================================
 * A CLASSIFICAÇÃO RFV
 * ======================================================================= */

/*
 * O rótulo vem do CÓDIGO que o backend manda (`fiel`, `em_risco`), e quem
 * escreve a palavra é o painel — não existe `segment_label` no contrato. Este
 * teste é o que separa "a tela traduz o código" de "a tela imprime o código
 * cru na linha do lojista".
 */
test('cada cliente sai com a classe dele, escrita em português', async ({ page }) => {
  await abrirClientes(page);

  await expect(page.getByRole('row').filter({ hasText: 'Ana Paula' })).toContainText('Fiel');
  await expect(page.getByRole('row').filter({ hasText: 'Marcos Lima' })).toContainText('Perdido');
  await expect(page.getByRole('row').filter({ hasText: 'Juliana Alves' })).toContainText(
    'Em risco',
  );
  await expect(page.getByRole('row').filter({ hasText: '(85) 97777-6666' })).toContainText(
    'Ocasional',
  );

  // O código cru não pode vazar para a tela em lugar nenhum.
  await expect(page.getByText('em_risco')).toHaveCount(0);
});

/*
 * O TICKET MÉDIO É O DO BACKEND, dividido pelos pedidos FATURÁVEIS.
 *
 * A Ana tem 12 pedidos e 10 faturáveis: R$ 748,50 / 10 = R$ 74,85. A divisão
 * ingênua pelo total daria R$ 62,38 — que é exatamente o ticket sub-reportado
 * que o backend acabou de consertar. Se alguém recalcular na tela, este teste
 * cai.
 */
test('o ticket médio divide pelos faturáveis, e a linha diz o denominador', async ({ page }) => {
  await abrirClientes(page);

  const ana = page.getByRole('row').filter({ hasText: 'Ana Paula' });
  await expect(ana).toContainText('R$ 74,85');
  await expect(ana).not.toContainText('R$ 62,38');
  // Sem esta linha, "12 pedidos · R$ 748,50 · R$ 74,85" não fecha e vira chamado.
  await expect(ana).toContainText('10 de 12 pedidos');
});

/*
 * `average_ticket` vem 0.0 de quem só tem pedido cancelado, e "R$ 0,00" seria
 * uma afirmação errada: não é que ela gaste zero por pedido, é que não há
 * pedido a dividir.
 */
test('quem não tem pedido faturável não ganha um ticket de R$ 0,00', async ({ page }) => {
  await abrirClientes(page);

  const juliana = page.getByRole('row').filter({ hasText: 'Juliana Alves' });

  /*
   * A asserção é na CÉLULA do ticket, e não na linha: o "Total gasto" dela é
   * R$ 0,00 de verdade — ela não gastou nada, os três pedidos foram cancelados
   * — e isso está certo. O que não pode acontecer é a MESMA cifra aparecer
   * também no ticket médio, onde ela significaria "gasta zero por pedido".
   */
  const ticket = juliana.locator('.ticket');
  await expect(ticket).toContainText('nenhum faturável');
  await expect(ticket).not.toContainText('R$');
});

/*
 * O AVISO DE RECORTE — o teste que o contrato do backend pediu por escrito.
 *
 * A classificação é do recorte da consulta: sem filial ela é do restaurante,
 * com filial é daquela loja, e o MESMO cliente pode ser "fiel" num e "perdido"
 * na outra sem que nenhum dos dois esteja errado. Sem dizer qual recorte está
 * no ar, o lojista troca de filial, vê o rótulo mudar e abre chamado.
 *
 * O aviso mora no `aside` da faixa, que gruda no topo — é o que o mantém na
 * tela na quadragésima linha da lista, que é onde a dúvida aparece.
 */
test('a faixa diz de qual recorte é a classificação, e ele acompanha o seletor', async ({
  page,
}) => {
  await abrirClientes(page);

  const escopo = page.getByTestId('customers-scope');
  await expect(escopo).toHaveText(/classificação do restaurante inteiro/);

  await escolherFilial(page, FAKE_BRANCH_2);
  await expect(escopo).toHaveText(
    new RegExp(`classificação da filial ${branchName(FAKE_BRANCH_2)}`),
  );
});

/*
 * A EXPLICAÇÃO EXISTE, E NÃO OCUPA A TELA.
 *
 * Ela era dois parágrafos acima da lista — sete linhas de prosa antes da
 * primeira linha da tabela, todo dia, para quem já as leu. Hoje mora atrás do
 * ícone de ajuda, ao lado do título.
 *
 * A ASSERÇÃO MUDOU DE FORMA E CONTINUA COBRINDO O MESMO REQUISITO: o conteúdo
 * é o mesmo, palavra por palavra; o que se acrescenta é que ele começa
 * FECHADO. Sem esta primeira metade, alguém "conserta" a tela devolvendo os
 * parágrafos para cima da tabela e o teste continua verde.
 */
test('a explicação começa fechada e abre no ícone de ajuda', async ({ page }) => {
  await abrirClientes(page);

  const rfv = page.getByTestId('customers-nota-rfv');
  const base = page.getByTestId('customers-nota-base');
  await expect(rfv).toHaveCount(0);
  await expect(base).toHaveCount(0);

  const ajuda = page.getByTestId('customers-ajuda');
  await expect(ajuda).toHaveAttribute('aria-expanded', 'false');
  await ajuda.click();
  await expect(ajuda).toHaveAttribute('aria-expanded', 'true');

  // O que a tabela não consegue dizer sozinha: por que não há coluna de e-mail.
  await expect(base).toContainText('E-mail e CPF são da conta do cliente');

  // E as duas perguntas que o contrato do backend avisou que virariam chamado.
  await expect(rfv).toContainText('Fiel no restaurante e Perdido numa loja');
  await expect(rfv).toContainText('O ritmo é de cada cliente');
  await expect(rfv).toContainText('não conta cancelado nem recusado');
});

/*
 * Esc FECHA E DEVOLVE O FOCO ao ícone. Sem a devolução, quem fechou a ajuda
 * pelo teclado é largado no fim do documento e o próximo Tab começa de novo —
 * é a mesma regra do `ds/Select`, e ela some sem ninguém ver.
 */
test('a ajuda fecha no Esc e devolve o foco ao ícone', async ({ page }) => {
  await abrirClientes(page);

  const ajuda = page.getByTestId('customers-ajuda');
  await ajuda.click();
  await expect(page.getByTestId('customers-nota-rfv')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('customers-nota-rfv')).toHaveCount(0);
  await expect(ajuda).toBeFocused();
});

/*
 * ============================================================================
 * OS TRÊS FILTROS
 * ============================================================================
 *
 * A tela NÃO tinha filtro, e a ausência era de propósito enquanto a rota não
 * tinha os parâmetros: a classificação era derivada na leitura sobre a página já
 * paginada, e filtrar o array recebido devolveria "os em risco das 50 linhas
 * baixadas" com cara de resposta sobre a base inteira.
 *
 * O contrato de 21/08/2026 abriu os cinco, aplicados ANTES do `LIMIT`. A
 * asserção que substituiu a da ausência trava a mesma preocupação de outra
 * forma: **o critério viaja no ENDEREÇO**. Uma tela que voltasse a peneirar o
 * array mostraria a mesma lista curta e não deixaria rastro nenhum na query.
 */

async function abrirFiltros(page: Page) {
  await page.getByTestId('customers-filtros').click();
  await expect(page.getByTestId('customers-filtro-aplicar')).toBeVisible();
}

/** A query do último GET /admin/customers que chegou ao falso. */
function ultimaQuery(): URLSearchParams | undefined {
  const queries = api.customerQueries();
  return queries[queries.length - 1];
}

test('o critério de classe vai na query, e não numa peneira do navegador', async ({ page }) => {
  await abrirClientes(page);

  await abrirFiltros(page);
  await page.getByTestId('customers-filtro-classe').click();
  await page.getByRole('option', { name: 'Em risco' }).click();
  await page.getByTestId('customers-filtro-aplicar').click();

  // A lista responde ao recorte...
  await expect(page.getByRole('row').filter({ hasText: 'Juliana Alves' })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'Ana Paula' })).toHaveCount(0);

  // ...e o recorte foi PEDIDO, não calculado aqui.
  expect(ultimaQuery()?.get('segment')).toBe('em_risco');
});

test('a faixa de ticket vai como decimal de duas casas', async ({ page }) => {
  await abrirClientes(page);

  await abrirFiltros(page);
  await page.getByTestId('customers-filtro-min').fill('50');
  await page.getByTestId('customers-filtro-max').fill('70');
  await page.getByTestId('customers-filtro-aplicar').click();

  await expect(page.getByRole('row').filter({ hasText: 'Marcos Lima' })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'Rafael Nunes' })).toHaveCount(0);

  expect(ultimaQuery()?.get('min_ticket')).toBe('50.00');
  expect(ultimaQuery()?.get('max_ticket')).toBe('70.00');
});

/*
 * AS DUAS DATAS SÃO O DIA DA OPERAÇÃO, e atravessam sem conversão. Um `Date` no
 * meio do caminho reintroduziria o fuso do navegador e mandaria o dia vizinho —
 * e o cliente que pediu às 23h cairia fora de um recorte que termina hoje.
 */
test('o período do último pedido vai como AAAA-MM-DD, sem passar por Date', async ({ page }) => {
  await abrirClientes(page);

  await abrirFiltros(page);
  await page.getByTestId('customers-filtro-de').fill('2026-08-01');
  await page.getByTestId('customers-filtro-ate').fill('2026-08-21');
  await page.getByTestId('customers-filtro-aplicar').click();

  expect(ultimaQuery()?.get('last_order_from')).toBe('2026-08-01');
  expect(ultimaQuery()?.get('last_order_to')).toBe('2026-08-21');
});

/*
 * O TOTAL É O DO RECORTE, e não o da base nem o da página.
 *
 * É a consequência de os filtros valerem antes do `LIMIT`, e a coisa que a tela
 * não conseguiria reproduzir sozinha: com um `Array.filter` na página, o
 * contador diria o total da base e a lista mostraria uma linha.
 */
test('o contador passa a ser o total do recorte', async ({ page }) => {
  await abrirClientes(page);
  await expect(page.getByText('5 clientes')).toBeVisible();

  await abrirFiltros(page);
  await page.getByTestId('customers-filtro-classe').click();
  await page.getByRole('option', { name: 'Em risco' }).click();
  await page.getByTestId('customers-filtro-aplicar').click();

  await expect(page.getByText('1 cliente', { exact: true })).toBeVisible();
});

/*
 * O NÚMERO NO BOTÃO É O QUE PAGA O ESCONDERIJO.
 *
 * Um filtro atrás de um botão é um filtro que ninguém lembra que ligou — é a
 * razão pela qual Pedidos não esconde os seus. Aqui a faixa gruda no topo e o
 * número continua na tela na quadragésima linha. Sem ele, a tela mentiria por
 * omissão sobre estar recortada.
 *
 * A FAIXA CONTA COMO UM: dois campos de ticket preenchidos são UM critério.
 */
test('o botão diz quantos critérios estão ligados, e a faixa conta como um', async ({ page }) => {
  await abrirClientes(page);

  const botao = page.getByTestId('customers-filtros');
  await expect(botao).toHaveText('Filtros');

  await abrirFiltros(page);
  await page.getByTestId('customers-filtro-min').fill('20');
  await page.getByTestId('customers-filtro-max').fill('80');
  await page.getByTestId('customers-filtro-classe').click();
  await page.getByRole('option', { name: 'Fiel' }).click();
  await page.getByTestId('customers-filtro-aplicar').click();

  await expect(botao).toContainText('2');
});

test('Limpar desliga tudo de uma vez e some junto', async ({ page }) => {
  await abrirClientes(page);

  await abrirFiltros(page);
  await page.getByTestId('customers-filtro-classe').click();
  await page.getByRole('option', { name: 'Perdido' }).click();
  await page.getByTestId('customers-filtro-aplicar').click();
  await expect(page.getByRole('row').filter({ hasText: 'Ana Paula' })).toHaveCount(0);

  await page.getByTestId('customers-filtros-limpar').click();

  await expect(page.getByRole('row').filter({ hasText: 'Ana Paula' })).toBeVisible();
  await expect(page.getByTestId('customers-filtros-limpar')).toHaveCount(0);
});

/*
 * FECHAR SEM APLICAR NÃO DEIXA RASTRO. O rascunho é semeado na abertura a partir
 * do que está aplicado — abrir de novo mostra o recorte que está no ar, e não o
 * que alguém começou a digitar e desistiu.
 */
test('fechar sem aplicar descarta o rascunho', async ({ page }) => {
  await abrirClientes(page);

  await abrirFiltros(page);
  await page.getByTestId('customers-filtro-min').fill('99');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('customers-filtro-aplicar')).toHaveCount(0);
  // Nada foi aplicado: a lista continua inteira e o botão não conta critério.
  await expect(page.getByTestId('customers-filtros')).toHaveText('Filtros');

  await abrirFiltros(page);
  await expect(page.getByTestId('customers-filtro-min')).toHaveValue('');
});

/*
 * ============================================================================
 * INTERVALO INVERTIDO É BARRADO ANTES DE VIRAR 400
 * ============================================================================
 *
 * O backend responde 400, e não lista vazia — está certo, porque lista vazia
 * deixaria o lojista procurando o cliente que sumiu da tela. Mas um 400 apaga a
 * lista e a troca por uma tarja vermelha genérica, quando o conserto é uma data
 * que a pessoa acabou de digitar.
 *
 * Então "Aplicar" trava, a mensagem aparece no campo errado, e NENHUMA chamada
 * sai. A última asserção é a que importa: se a requisição saísse, o teste
 * passaria pela mensagem e a lista teria sumido de qualquer forma.
 */
test('data invertida trava o Aplicar e não chega a chamar a rota', async ({ page }) => {
  await abrirClientes(page);

  const antes = api.customerQueries().length;

  await abrirFiltros(page);
  await page.getByTestId('customers-filtro-de').fill('2026-08-21');
  await page.getByTestId('customers-filtro-ate').fill('2026-08-01');

  await expect(page.getByText('A data inicial é depois da final.')).toBeVisible();
  await expect(page.getByTestId('customers-filtro-aplicar')).toBeDisabled();
  expect(api.customerQueries().length).toBe(antes);
});

test('ticket invertido trava o Aplicar, com a mensagem no campo do ticket', async ({ page }) => {
  await abrirClientes(page);

  await abrirFiltros(page);
  await page.getByTestId('customers-filtro-min').fill('80');
  await page.getByTestId('customers-filtro-max').fill('20');

  await expect(page.getByText('O ticket mínimo é maior que o máximo.')).toBeVisible();
  await expect(page.getByTestId('customers-filtro-aplicar')).toBeDisabled();
});

/*
 * O VAZIO COM FILTRO LIGADO DIZ A CAUSA CERTA E OFERECE A SAÍDA. Um "nenhum
 * cliente encontrado" sem o botão mandaria a pessoa procurar no lugar errado.
 */
test('recorte sem resultado oferece limpar os filtros', async ({ page }) => {
  await abrirClientes(page);

  await abrirFiltros(page);
  await page.getByTestId('customers-filtro-min').fill('9999');
  await page.getByTestId('customers-filtro-aplicar').click();

  await expect(page.getByText('Nenhum cliente com esses critérios.')).toBeVisible();
  await page.getByTestId('customers-vazio-limpar').click();

  await expect(page.getByRole('row').filter({ hasText: 'Ana Paula' })).toBeVisible();
});

/*
 * ============================================================================
 * O RITMO — a linha que fecha o caso de dois clientes com a mesma distância
 * ============================================================================
 *
 * `cadence_days` com `days_since_last_order` é o par que explica o rótulo. Sem
 * ele a tela dizia a REGRA ("o ritmo é de cada cliente") e a regra não fecha o
 * caso: quem olha duas linhas e dois rótulos diferentes precisa dos números
 * daquelas duas pessoas.
 */
test('cada linha diz o ritmo daquele cliente, ao lado da classe', async ({ page }) => {
  await abrirClientes(page);

  const juliana = page.getByRole('row').filter({ hasText: 'Juliana Alves' });
  await expect(juliana).toContainText('Em risco');
  await expect(juliana).toContainText('ritmo de 8 dias');

  const marcos = page.getByRole('row').filter({ hasText: 'Marcos Lima' });
  await expect(marcos).toContainText('Perdido');
  await expect(marcos).toContainText('ritmo de 20 dias');
});

/*
 * QUEM TEM UM PEDIDO SÓ NÃO TEM RITMO MEDIDO. O backend usa 30 como valor de
 * partida (não há intervalo a medir); escrever "ritmo de 30 dias" ao lado de "1
 * pedido" seria a tela afirmando um hábito que ninguém observou.
 */
test('não inventa ritmo para quem tem um pedido só', async ({ page }) => {
  await abrirClientes(page);
  await escolherFilial(page, FAKE_BRANCH_2);

  const rafael = page.getByRole('row').filter({ hasText: 'Rafael Nunes' });
  await expect(rafael).toContainText('Novo');
  await expect(rafael).not.toContainText('ritmo');
});

/*
 * ============================================================================
 * SETE COLUNAS CABEM EM TODA LARGURA — ou a lista rola de lado, que é pior
 * ============================================================================
 *
 * A classificação e o ticket médio levaram a tabela de cinco para sete colunas,
 * e sete colunas com o respiro de página em cada célula pedem 769px de largura
 * mínima. Em 768px a faixa disponível é de 700 — a tabela rompia a margem e a
 * lista passava a rolar na horizontal, que some justamente com a PRIMEIRA
 * coluna, a que identifica a linha.
 *
 * O conserto foi o respiro da célula (`--tabela-pad`) apertar por faixa, e ele
 * depende de uma correção no primitivo: `ds/DataTable.css` declarava o padrão
 * na própria `.ds-tabela`, e valor escrito no elemento vence valor herdado — a
 * página escrevia e a tabela ignorava. É uma cadeia de três peças, invisível na
 * revisão de código e óbvia na tela. Por isso ela é medida, e não conferida no
 * olho.
 *
 * As larguras são as do sistema: 640 (a tabela volta a ser tabela), 768 (a
 * lateral vira trilha de ícones), 1024 e 1440.
 */
for (const largura of [640, 768, 1024, 1440]) {
  test(`a lista cabe na largura de ${largura}px, sem rolagem lateral`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    await abrirClientesPorUrl(page);
    await expect(page.getByRole('row').filter({ hasText: 'Ana Paula' })).toBeVisible();

    const medida = await page.evaluate(() => ({
      documento: document.documentElement.scrollWidth,
      janela: window.innerWidth,
      tabela: document.querySelector('.ds-tabela')?.scrollWidth ?? 0,
      faixa: document.querySelector('.customers__corpo')?.clientWidth ?? 0,
    }));

    expect(medida.documento).toBeLessThanOrEqual(medida.janela);
    // A tabela dentro da faixa: é aqui que a rolagem lateral apareceria, dentro
    // do corpo que já rola na vertical, sem a página inteira acusar nada.
    expect(medida.tabela).toBeLessThanOrEqual(medida.faixa);
  });
}

/*
 * A tela não abre o cliente e não leva aos pedidos dele: não existe rota de
 * detalhe, e `/admin/orders` busca por NOME, não por telefone — o link juntaria
 * duas "Ana Paula". Este teste trava a ausência de propósito, para que ela não
 * volte como um link plausível numa rodada distraída.
 *
 * ============================================================================
 * A EXCEÇÃO: `tel:` NÃO É NAVEGAÇÃO
 * ============================================================================
 *
 * Este teste começou proibindo QUALQUER link na linha, e a guarda era ampla de
 * propósito. O telefone discável a atravessou, e ele é legítimo pelo que a
 * própria guarda protege: `tel:` não abre tela nenhuma do painel, não inventa
 * rota de detalhe e não busca pedido nenhum por nome — ele entrega o número ao
 * discador do aparelho e o painel fica onde estava. O risco que o comentário
 * acima nomeia (duas "Ana Paula" juntadas por uma busca) continua impossível.
 *
 * Então a guarda ESTREITA em vez de sair: nada de `href` que navegue dentro do
 * painel, e o único link tolerado é o de discagem. Uma rodada distraída que
 * ponha um `<Link to=...>` aqui continua batendo neste teste.
 */
test('a linha não é clicável: não há rota de detalhe do cliente', async ({ page }) => {
  await abrirClientes(page);

  const ana = page.getByRole('row').filter({ hasText: 'Ana Paula' });
  await expect(ana.getByRole('button')).toHaveCount(0);

  // Nenhum link que navegue no painel — nem absoluto, nem relativo.
  await expect(ana.locator('a[href^="/"], a[href^="."], a[href^="http"]')).toHaveCount(0);

  // E o único que existe é o que disca, com o número desta linha.
  const links = ana.getByRole('link');
  await expect(links).toHaveCount(1);
  await expect(links).toHaveAttribute('href', 'tel:+5585999990000');
});
