/**
 * E2E dos setores de impressão.
 *
 * A funcionalidade vive em duas telas e é o cruzamento delas que dá errado:
 * setor é POR FILIAL, produto é DO RESTAURANTE. Os testes daqui cobrem a aba
 * que administra os setores, o campo no produto, a coluna de conferência e a
 * aplicação em lote — que é a razão de tudo isto existir, para o cardápio de 80
 * itens não ser configurado clique a clique.
 */
import { expect, test, type Page } from '@playwright/test';

import { branchName } from '../src/layout/branch-heading';
import { installFakeApi, FAKE_BRANCH, LOGIN_EMAIL, LOGIN_PASSWORD, type FakeApi } from './fake-api';
import { escolher, escolherFilial, opcoesDe } from './seletor';

let api: FakeApi;

test.beforeEach(async ({ page }) => {
  api = await installFakeApi(page);
});

test.afterEach(() => {
  api.stop();
});

async function fazerLogin(page: Page) {
  await page.goto('/pedidos');
  await page.getByLabel('E-mail').fill(LOGIN_EMAIL);
  await page.getByLabel('Senha').fill(LOGIN_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/pedidos$/);
}

async function abrirAbaImpressao(page: Page) {
  await page.getByRole('link', { name: 'Minha loja' }).click();
  await page.getByTestId('store-anchor-impressao').click();
}

/**
 * Aplicar setor à categoria mora no menu de três pontinhos, ao lado do nome da
 * categoria — e não mais ao lado de "Novo item". A ação sobrescreve a categoria
 * inteira, então ela não pode ter o peso visual da ação do dia a dia.
 */
async function abrirMenuDaCategoria(page: Page) {
  await page.getByTestId('category-actions-open').click();
}

// --- a aba em Minha loja --------------------------------------------------

test('a tela Impressão lista os setores da filial resolvida', async ({ page }) => {
  await fazerLogin(page);
  await abrirAbaImpressao(page);

  // Setor é por filial, e com "todas" no topo a tela resolve a principal em
  // vez de pedir uma — a lista aparece sem nenhum clique a mais, e a linha
  // auxiliar diz de qual filial ela é.
  await expect(page.getByTestId('store-branch-required')).toHaveCount(0);
  await expect(page.getByTestId('store-branch-note')).toHaveText(
    `vale só para a filial ${branchName(FAKE_BRANCH)}`,
  );

  await expect(page.getByTestId('print-sector-sec-chapa')).toContainText('Chapa');
  // O desativado continua na lista: o que some da tela ninguém reativa.
  await expect(page.getByTestId('print-sector-sec-bar')).toContainText('Bar');
  await expect(page.getByTestId('print-sector-sec-bar')).toContainText('Desativado');
});

/*
 * A TELA DE IMPRESSÃO INTEIRA, e o contrato dela com a honestidade.
 *
 * Três dos quatro blocos não têm backend: o programa de impressão não manda
 * heartbeat, não relata as impressoras da máquina e não tem rota de impressão
 * de teste. Eles mostram o estado honesto do que ainda não existe — e este
 * teste guarda justamente o que NÃO pode aparecer: nenhum ponto verde de
 * "conectado", nenhuma lista de impressoras fabricada, nenhum botão de teste
 * que não vai a lugar nenhum.
 */
test('Impressão explica o programa local sem inventar estado de conexão', async ({ page }) => {
  await fazerLogin(page);
  await abrirAbaImpressao(page);

  // O que a tela precisa ensinar a quem nunca ouviu falar do programa.
  await expect(page.getByTestId('print-agent-block')).toContainText(
    'A comanda não sai do navegador',
  );
  await expect(page.getByTestId('print-agent-status')).toContainText(
    'ainda não mostra se o programa está rodando',
  );

  // Sem jargão: o lojista não tem por que saber o que é um agente ou um daemon.
  const texto = (await page.getByTestId('print-agent-block').innerText()).toLowerCase();
  expect(texto).not.toContain('daemon');
  expect(texto).not.toContain('agente');
  expect(texto).not.toContain('headless');

  // O bloco de impressoras EXPLICA a ausência da lista em vez de mostrar uma
  // lista vazia sem motivo.
  await expect(page.getByTestId('printers-empty')).toContainText(
    'vão aparecer aqui, com um teste por impressora',
  );

  await expect(page.getByTestId('test-print-block')).toContainText('48 colunas');
});

/*
 * O NÚMERO QUE FAZ ESTA TELA VALER A ABERTURA: item sem setor não sai na
 * comanda de produção, e hoje o lojista só descobre isso no sábado à noite,
 * quando a cozinha não recebe o pedido.
 */
test('Impressão mostra quantos itens tem cada setor e quantos ficaram sem', async ({ page }) => {
  await fazerLogin(page);
  await abrirAbaImpressao(page);

  // No falso, só prod-1 aponta para a Chapa; os outros cinco estão sem setor.
  await expect(page.getByTestId('print-sector-count-sec-chapa')).toHaveText('1 item');
  // Setor vazio E desativado: os dois qualificadores dividem a mesma célula.
  await expect(page.getByTestId('print-sector-count-sec-bar')).toHaveText(
    'nenhum item · Desativado',
  );

  await expect(page.getByTestId('sector-coverage')).toContainText('5 itens');
  await expect(page.getByTestId('sector-coverage')).toContainText('não imprime em setor nenhum');
});

test('cria, renomeia e desativa um setor', async ({ page }) => {
  await fazerLogin(page);
  await escolherFilial(page);
  await abrirAbaImpressao(page);

  // Criar.
  await page.getByTestId('print-sector-new-name').fill('Sobremesa');
  await page.getByTestId('print-sector-create').click();
  await expect(page.getByText('Sobremesa')).toBeVisible();
  expect(api.printSectors().some((entry) => entry.name === 'Sobremesa')).toBe(true);

  // Renomear.
  await page.getByTestId('print-sector-rename-sec-chapa').click();
  await page.getByTestId('print-sector-rename-input').fill('Chapa quente');
  await page.getByTestId('print-sector-rename-save').click();
  await expect(page.getByTestId('print-sector-sec-chapa')).toContainText('Chapa quente');

  // Desativar — e não excluir: os produtos guardam o id do setor.
  await page.getByRole('switch', { name: 'Chapa quente: desativar' }).click();
  await expect(page.getByTestId('print-sector-sec-chapa')).toContainText('Desativado');
  await expect
    .poll(() => api.printSectors().find((entry) => entry.id === 'sec-chapa')?.is_active)
    .toBe(false);

  // Nunca some da lista.
  await expect(page.getByTestId('print-sector-sec-chapa')).toBeVisible();
});

test('nome repetido é recusado antes de sair da tela', async ({ page }) => {
  await fazerLogin(page);
  await escolherFilial(page);
  await abrirAbaImpressao(page);

  const antes = api.printSectors().length;

  // Duas linhas "Chapa" deixariam o lojista sem saber qual escolher no produto.
  await page.getByTestId('print-sector-new-name').fill('  chapa  ');
  await page.getByTestId('print-sector-create').click();

  await expect(page.getByTestId('store-error')).toContainText('Já existe um setor');
  expect(api.printSectors()).toHaveLength(antes);
});

// --- o cardápio -----------------------------------------------------------

test('a lista de produtos mostra o setor de cada item', async ({ page }) => {
  await fazerLogin(page);
  await escolherFilial(page);
  await page.getByRole('link', { name: 'Cardápio' }).click();

  /*
   * A conferência de bate-pronto: um item configurado e dois não. É exatamente
   * o que o lojista precisa enxergar sem abrir item por item.
   */
  await expect(page.getByTestId('product-sector-prod-1')).toHaveText('Chapa');
  // Sem setor a célula fica vazia: o que se procura aqui é o item que TEM um.
  await expect(page.getByTestId('product-sector-prod-2')).toHaveText('');
  await expect(page.getByTestId('product-sector-prod-3')).toHaveText('');
});

/*
 * A COLUNA SUMIA E A AÇÃO FICAVA TRAVADA. Sem filial escolhida, o Cardápio
 * deixava de desenhar a coluna de setor e desabilitava "Aplicar setor a todos
 * os itens" — uma coluna a menos sem nada dizendo por quê, mais um controle
 * que o lojista não tinha como usar dali. Hoje a filial é resolvida e a coluna
 * DIZ de qual loja ela responde, que era a informação que faltava — no
 * CABEÇALHO da própria coluna, e não mais numa legenda solta no canto da linha
 * de busca, do outro lado da tela do que ela qualificava.
 */
test('sem filial escolhida, a coluna de setor diz de qual filial ela é', async ({ page }) => {
  await fazerLogin(page);
  await page.getByRole('link', { name: 'Cardápio' }).click();

  await expect(page.getByTestId('product-row-prod-1')).toBeVisible();
  await expect(page.getByTestId('product-sector-prod-1')).toBeVisible();
  const cabecalho = page.getByTestId('menu-sector-scope');
  await expect(cabecalho).toContainText('Impressão');
  await expect(cabecalho).toContainText(branchName(FAKE_BRANCH));

  await abrirMenuDaCategoria(page);
  await expect(page.getByTestId('apply-sector-open')).toBeEnabled();
});

test('o campo de setor no produto oferece só os ativos, com "Não imprimir"', async ({ page }) => {
  await fazerLogin(page);
  await escolherFilial(page);
  await page.getByRole('link', { name: 'Cardápio' }).click();

  await page.getByRole('button', { name: 'Editar X-Salada' }).click();

  const campo = page.getByTestId('product-print-sector');
  await expect(campo).toBeVisible();
  // "Não imprimir" é uma escolha legítima e é onde o item sem setor está.
  await expect(campo).toHaveText('Não imprimir');

  // "Bar" está desativado: não pode ser oferecido — seria mandar comanda para
  // uma impressora que o lojista acabou de tirar do ar.
  expect(await opcoesDe(campo)).toEqual(['Não imprimir', 'Chapa']);

  await escolher(campo, 'Chapa');
  await page.getByRole('button', { name: 'Salvar' }).click();

  await expect(page.getByTestId('product-sector-prod-2')).toHaveText('Chapa');
  expect(api.products().find((item) => item.id === 'prod-2')?.printing_sector_id).toBe('sec-chapa');
});

test('aplicar o setor à categoria inteira resolve os 80 cliques', async ({ page }) => {
  await fazerLogin(page);
  await escolherFilial(page);
  await page.getByRole('link', { name: 'Cardápio' }).click();

  await abrirMenuDaCategoria(page);
  await page.getByTestId('apply-sector-open').click();

  /*
   * A contagem aparece ANTES de confirmar: é o que separa a ação certa da ação
   * lamentada. E o número que importa não é o total — é quantos JÁ têm setor,
   * porque são esses que alguém apontou à mão e vão ser sobrescritos. No falso,
   * a categoria tem 3 itens e só o X-Burger está configurado.
   */
  const aviso = page.getByTestId('apply-sector-warning');
  await expect(aviso).toContainText('3 itens');
  await expect(aviso).toContainText('já tinham outro setor');
  await expect(aviso).toContainText('1 já tem setor definido');

  await escolher(page.getByTestId('apply-sector-select'), 'Chapa');
  await page.getByTestId('apply-sector-confirm').click();

  // Uma chamada só, e não uma por produto.
  await expect.poll(() => api.categorySectorCalls()).toHaveLength(1);
  expect(api.categorySectorCalls()[0]).toMatchObject({
    categoryId: 'cat-1',
    printSectorId: 'sec-chapa',
  });

  // Todos os itens da categoria passam a imprimir na chapa — inclusive os que
  // estavam em "Não imprimir".
  await expect(page.getByTestId('product-sector-prod-2')).toHaveText('Chapa');
  await expect(page.getByTestId('product-sector-prod-3')).toHaveText('Chapa');

  // E a categoria vizinha não foi tocada.
  expect(
    api.products().find((item) => item.id === 'prod-4')?.printing_sector_id ?? null,
  ).toBeNull();
});

test('aplicar "Não imprimir" à categoria limpa o setor de todos', async ({ page }) => {
  await fazerLogin(page);
  await escolherFilial(page);
  await page.getByRole('link', { name: 'Cardápio' }).click();

  await expect(page.getByTestId('product-sector-prod-1')).toHaveText('Chapa');

  await abrirMenuDaCategoria(page);
  await page.getByTestId('apply-sector-open').click();
  // "Não imprimir" é o valor padrão do diálogo e vale como escolha.
  await page.getByTestId('apply-sector-confirm').click();

  await expect(page.getByTestId('product-sector-prod-1')).toHaveText('');
  expect(api.categorySectorCalls().at(-1)?.printSectorId).toBeNull();
});
