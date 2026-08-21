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
 * NÃO EXISTE FILTRO POR CLASSE, e a ausência é de propósito: a rota não tem
 * `?segment=`, e a classificação é derivada na LEITURA sobre a página já
 * paginada. Filtrar o array recebido devolveria "os em risco das 50 linhas
 * baixadas" com cara de resposta sobre a base inteira — que é pior do que não
 * filtrar. Este teste trava a ausência para que ela não volte como um seletor
 * plausível na barra.
 */
test('a tela não oferece filtro por classificação', async ({ page }) => {
  await abrirClientes(page);

  await expect(page.getByRole('combobox', { name: /classifica/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Em risco$/ })).toHaveCount(0);
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
 */
test('a linha não é clicável: não há rota de detalhe do cliente', async ({ page }) => {
  await abrirClientes(page);

  const ana = page.getByRole('row').filter({ hasText: 'Ana Paula' });
  await expect(ana.getByRole('link')).toHaveCount(0);
  await expect(ana.getByRole('button')).toHaveCount(0);
});
