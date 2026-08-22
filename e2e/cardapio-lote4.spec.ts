/**
 * E2E do LOTE 4 do cardápio: o item que saiu de venda sozinho, o arrastar e a
 * seleção múltipla.
 *
 * AS TRÊS TÊM O MESMO TIPO DE DEFEITO POSSÍVEL, e é por isso que estão juntas:
 * as três compilam, montam e parecem certas com a regra errada por trás.
 *
 *   - o estado bloqueado pode ser DEDUZIDO em vez de lido, e a dedução diverge
 *     do backend no dia em que a regra mudar de um lado só;
 *   - o arrastar pode mandar a lista CURTA, e aí a tela mostra a ordem certa e
 *     grava a errada;
 *   - a ação em massa pode gravar metade e dizer que gravou tudo.
 *
 * Nenhum dos três aparece na tela de quem está testando à mão.
 */
import { expect, test, type Page } from '@playwright/test';

import { installFakeApi, LOGIN_EMAIL, LOGIN_PASSWORD, type FakeApi } from './fake-api';

let api: FakeApi;

test.beforeEach(async ({ page }) => {
  api = await installFakeApi(page);
});

test.afterEach(() => {
  api.stop();
});

async function abrirCardapio(page: Page) {
  await page.goto('/cardapio');
  await page.getByLabel('E-mail').fill(LOGIN_EMAIL);
  await page.getByLabel('Senha').fill(LOGIN_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.goto('/cardapio');
  await expect(page.getByRole('heading', { name: 'Cardápio', level: 1 })).toBeVisible();
}

/** "Acompanhamentos" — onde mora o item bloqueado e a lista de quatro. */
async function abrirAcompanhamentos(page: Page) {
  await page.getByTestId('category-select-cat-2').click();
  await expect(page.getByRole('heading', { name: 'Acompanhamentos' })).toBeVisible();
}

/* ==========================================================================
 * 1. O ITEM QUE SAIU DE VENDA SOZINHO
 * ======================================================================= */

test('o item fora de venda por grupo obrigatório é marcado, e diferente de esgotado', async ({
  page,
}) => {
  await abrirCardapio(page);
  await abrirAcompanhamentos(page);

  /*
   * OS DOIS INTERRUPTORES DO LOJISTA ESTÃO LIGADOS neste item — ativo e
   * disponível — e mesmo assim ele não vende. É o caso inteiro: antes, a linha
   * aparecia como qualquer outra.
   */
  const bloqueado = page.getByTestId('product-blocked-prod-7');
  await expect(bloqueado).toBeVisible();
  await expect(bloqueado).toHaveText(/Sem opção/);

  // E NÃO é "Esgotado": são estados diferentes com ações diferentes, e a linha
  // do item esgotado de verdade continua dizendo a outra palavra.
  const linhaBloqueada = page.getByTestId('product-row-prod-7');
  await expect(linhaBloqueada).not.toContainText('Esgotado');
  await expect(linhaBloqueada).not.toContainText('Inativo');
});

test('o aviso do topo conta os bloqueados e diz o que fazer', async ({ page }) => {
  await abrirCardapio(page);
  await abrirAcompanhamentos(page);

  /*
   * A ETIQUETA NA LINHA NÃO É ACHÁVEL sozinha: numa categoria de oitenta itens,
   * quem não estava rolando por ali nunca vê a linha 47. O aviso é o que
   * transforma a marca em informação encontrável — e ele diz a AÇÃO, que é o
   * que não cabe numa etiqueta de 116px.
   */
  const aviso = page.getByTestId('menu-bloqueados');
  await expect(aviso).toContainText('Um item desta lista está fora de venda');
  await expect(aviso).toContainText('grupo obrigatório');
  await expect(aviso).toContainText('reative uma opção');
});

test('categoria sem item bloqueado não desenha o aviso', async ({ page }) => {
  await abrirCardapio(page);

  // Lanches tem esgotado e inativo, e nenhum bloqueado: o aviso não aparece.
  // Um aviso permanente é um aviso que ninguém lê.
  await expect(page.getByTestId('menu-bloqueados')).toHaveCount(0);
});

/* ==========================================================================
 * 2. ARRASTAR PARA REORDENAR
 * ======================================================================= */

/**
 * O gesto, em Pointer Events.
 *
 * `page.dragTo()` NÃO SERVE: ele usa a API de arrastar nativa do HTML
 * (`dragstart`/`drop`), e esta tela não a usa — ela usa Pointer Events, porque
 * a nativa não existe no toque. O gesto tem de ser encenado no mesmo vocabulário
 * que o código escuta.
 */
async function arrastar(page: Page, deTestId: string, paraTestId: string) {
  /*
   * O PUNHO ESTÁ EM LUGARES DIFERENTES nas duas listas, e é consequência do
   * markup: na lista de itens o `data-testid` está no próprio `<li>` e o punho
   * é filho dele; na barra de categorias o testid está no BOTÃO que abre a
   * categoria, e o punho é irmão desse botão. O primeiro seletor cobre a
   * primeira, o segundo sobe um nível para cobrir a segunda.
   */
  const alvo = page.getByTestId(deTestId);
  const dentro = alvo.locator('.item__punho');
  const punho =
    (await dentro.count()) > 0 ? dentro : alvo.locator('xpath=..').locator('.rail__punho');
  const origem = await punho.boundingBox();
  const destino = await page.getByTestId(paraTestId).boundingBox();
  if (!origem || !destino) throw new Error('sem caixa para arrastar');

  await page.mouse.move(origem.x + origem.width / 2, origem.y + origem.height / 2);
  await page.mouse.down();
  // Dois passos: o primeiro passa da folga do toque, o segundo escolhe o alvo.
  await page.mouse.move(origem.x + origem.width / 2, origem.y + origem.height / 2 + 12);
  await page.mouse.move(destino.x + destino.width / 2, destino.y + destino.height - 4, {
    steps: 8,
  });
  await page.mouse.up();
}

test('arrastar um item grava a lista COMPLETA da categoria, na ordem nova', async ({ page }) => {
  await abrirCardapio(page);
  await abrirAcompanhamentos(page);

  // Ordem inicial da categoria, por `sort_order`.
  await expect(page.locator('.item__name')).toHaveText([
    'Batata frita M',
    'Batata rústica',
    'Batata rústica',
    'Onion rings',
  ]);

  await arrastar(page, 'product-row-prod-4', 'product-row-prod-7');

  /*
   * A ASSERÇÃO QUE NENHUMA LEITURA DE TELA ALCANÇA: o corpo que foi para a
   * rota. Uma tela que arrastasse certo e mandasse a lista curta mostraria a
   * ordem certa e gravaria a errada — e o backend, ao receber menos ids do que
   * a categoria tem, apagaria a posição de quem ficou de fora.
   */
  await expect.poll(async () => (await api.productReorderCalls()).length).toBeGreaterThan(0);

  const chamada = (await api.productReorderCalls())[0]!;
  expect(chamada.categoryId).toBe('cat-2');
  expect(chamada.productIds).toEqual(['prod-5', 'prod-6', 'prod-7', 'prod-4']);
});

test('as setas continuam existindo, e é elas que a WCAG 2.5.7 exige', async ({ page }) => {
  await abrirCardapio(page);
  await abrirAcompanhamentos(page);

  /*
   * ARRASTAR É O ATALHO, A SETA É O CAMINHO. Quem usa teclado, leitor de tela
   * ou está com uma mão na comanda não arrasta — e sem a seta a ordem do
   * cardápio ficaria fora do alcance dessas três pessoas.
   */
  await page.getByRole('button', { name: 'Mover Onion rings para cima' }).click();

  await expect.poll(async () => (await api.productReorderCalls()).length).toBeGreaterThan(0);

  const chamada = (await api.productReorderCalls())[0]!;
  // Trocou com o vizinho de cima, e mandou a categoria inteira.
  expect(chamada.productIds).toEqual(['prod-4', 'prod-5', 'prod-7', 'prod-6']);
});

test('com a busca ligada o punho some E a tela diz por quê', async ({ page }) => {
  await abrirCardapio(page);
  await abrirAcompanhamentos(page);

  await page.getByLabel('Buscar item nesta categoria').fill('Batata');

  /*
   * A ROTA EXIGE A CATEGORIA COMPLETA, e com a busca a lista é um recorte. O
   * controle sai — mas com a FRASE junto: um punho que desaparece quando se
   * digita é lido como defeito, e o lojista fica procurando o que ele fez.
   */
  await expect(page.getByTestId('menu-sem-arrastar')).toContainText('limpe a busca');
  await expect(page.locator('.item__punho')).toHaveCount(0);
});

test('arrastar categoria grava a lista completa da filial', async ({ page }) => {
  await abrirCardapio(page);

  await arrastar(page, 'category-select-cat-1', 'category-select-cat-3');

  await expect.poll(async () => (await api.reorderCalls()).length).toBeGreaterThan(0);

  const chamada = (await api.reorderCalls())[0]!;
  // `branch_id` obrigatório: a lista completa de uma loja é parcial para a
  // outra, e sem o recorte o backend não sabe qual das duas ela pretende ser.
  expect(chamada.branchId).toBeTruthy();
  expect(chamada.categoryIds).toEqual(['cat-2', 'cat-3', 'cat-1']);
});

/* ==========================================================================
 * 3. ESGOTAR VÁRIOS DE UMA VEZ
 * ======================================================================= */

test('marcar vários como esgotados chama a rota de cada um e confirma o desfecho', async ({
  page,
}) => {
  await abrirCardapio(page);
  await abrirAcompanhamentos(page);

  await page.getByTestId('product-select-prod-4').check();
  await page.getByTestId('product-select-prod-5').check();

  await expect(page.getByTestId('menu-selecao')).toContainText('2 itens selecionados');
  await page.getByTestId('menu-esgotar-selecionados').click();

  /*
   * NÃO EXISTE ROTA EM LOTE: são duas chamadas à MESMA rota do interruptor da
   * linha. É o que faz o papel da ação em massa ser idêntico ao do individual —
   * `PATCH /admin/products/{id}/availability` é PESSOAS, e o balcão continua
   * podendo.
   */
  await expect.poll(async () => (await api.availabilityCalls()).length).toBe(2);
  const chamadas = await api.availabilityCalls();
  expect(chamadas.map((item) => item.productId).sort()).toEqual(['prod-4', 'prod-5']);
  expect(chamadas.every((item) => item.isAvailable === false)).toBe(true);

  // O desfecho é dito INCLUSIVE no sucesso: sem atomicidade, "2 itens" é a
  // única confirmação de que os dois foram mesmo.
  await expect(page.getByTestId('menu-resultado-massa')).toContainText('2 itens');
  // E a seleção sai sozinha quando tudo gravou.
  await expect(page.getByTestId('menu-selecao')).toHaveCount(0);
});

test('falha parcial NOMEIA quem ficou para trás e mantém a seleção', async ({ page }) => {
  api.failAvailability('prod-5');
  await abrirCardapio(page);
  await abrirAcompanhamentos(page);

  await page.getByTestId('product-select-prod-4').check();
  await page.getByTestId('product-select-prod-5').check();
  await page.getByTestId('menu-esgotar-selecionados').click();

  /*
   * O CASO QUE A AÇÃO EM MASSA NÃO PODE ERRAR. São N requisições sem
   * atomicidade nenhuma, e um "não deu certo" genérico depois de meia gravação
   * deixa o lojista sem saber quais itens continuam vendendo. No meio do
   * serviço ele não vai conferir cinco linhas uma a uma.
   */
  const resultado = page.getByTestId('menu-resultado-massa');
  await expect(resultado).toContainText('Batata rústica');
  await expect(resultado).toContainText('1 de 2');

  // A seleção FICA: é o que permite tentar de novo sem remarcar item por item.
  await expect(page.getByTestId('menu-selecao')).toBeVisible();

  // E a linha que falhou continua no estado antigo, e não num "esgotado" que
  // nunca gravou.
  await expect(page.getByTestId('product-row-prod-5')).toHaveAttribute('data-available', 'true');
});

test('a seleção não sobrevive à troca de categoria', async ({ page }) => {
  await abrirCardapio(page);
  await abrirAcompanhamentos(page);

  await page.getByTestId('product-select-prod-4').check();
  await expect(page.getByTestId('menu-selecao')).toBeVisible();

  /*
   * O BUG QUE ESTE TESTE FECHA: a seleção é uma lista de ids, e trocar de
   * categoria troca os produtos debaixo dela. Sobrevivendo, a ação em massa
   * cairia sobre itens que não estão na tela — o lojista marcaria "esgotado"
   * em coisas que ele não está vendo.
   */
  await page.getByTestId('category-select-cat-1').click();
  await expect(page.getByTestId('menu-selecao')).toHaveCount(0);
});

test('"selecionar todos" marca o que está NA TELA, e diz quantos são', async ({ page }) => {
  await abrirCardapio(page);
  await abrirAcompanhamentos(page);

  /*
   * "Todos" É O QUE ESTÁ CARREGADO, e o rótulo acessível escreve o número: a
   * lista é paginada e pode estar filtrada, e uma caixa que marcasse a
   * categoria inteira faria quatro itens virarem quarenta sem ninguém pedir.
   */
  await page.getByTestId('menu-selecionar-todos').check();
  await expect(page.getByTestId('menu-selecao')).toContainText('4 itens selecionados');
});
