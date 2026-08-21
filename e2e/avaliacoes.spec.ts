/**
 * E2E de Avaliações.
 *
 * A tela é de leitura pura — não há gravação para conferir. O que ela tem de
 * errar em silêncio são três coisas, e as três estão aqui:
 *
 *   1. **A média desabar com o filtro de nota.** É o defeito que o backend
 *      resolveu do lado dele (o `max_rating` não entra no agregado) e que o
 *      painel pode reintroduzir sozinho — bastaria recalcular a média a partir
 *      da lista que está na tela.
 *   2. **A soma das barras discordar da média** exibida ao lado delas.
 *   3. **O estado vazio virar quatro seções zeradas**, que é o que faz o dono
 *      procurar o defeito no painel em vez de olhar para o período.
 */
import { expect, test, type Page } from '@playwright/test';

import {
  installFakeApi,
  FAKE_BRANCH_2,
  LOGIN_EMAIL,
  LOGIN_PASSWORD,
  type FakeApi,
} from './fake-api';
import { escolher, escolherFilial } from './seletor';
import { branchName } from '../src/layout/branch-heading';

let api: FakeApi;

test.beforeEach(async ({ page }) => {
  api = await installFakeApi(page);
});

test.afterEach(() => {
  api.stop();
});

async function entrar(page: Page) {
  await page.goto('/avaliacoes');
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel('E-mail').fill(LOGIN_EMAIL);
  await page.getByLabel('Senha').fill(LOGIN_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

async function abrirAvaliacoes(page: Page) {
  await entrar(page);

  await page.getByRole('link', { name: 'Avaliações' }).click();
  await expect(page).toHaveURL(/\/avaliacoes$/);
  await expect(page.getByRole('heading', { name: 'Avaliações', level: 1 })).toBeVisible();
}

/** A mesma tela pelo ENDEREÇO — a lateral não é um link em toda largura. */
async function abrirPorUrl(page: Page) {
  await entrar(page);
  await page.goto('/avaliacoes');
  await expect(page.getByRole('heading', { name: 'Avaliações', level: 1 })).toBeVisible();
}

/** Entra pelo caminho normal do painel, sem passar por /avaliacoes. */
async function entrarPeloPainel(page: Page) {
  await page.goto('/pedidos');
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel('E-mail').fill(LOGIN_EMAIL);
  await page.getByLabel('Senha').fill(LOGIN_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/pedidos$/);
}

test('a tela existe de verdade, e não é uma página "em breve"', async ({ page }) => {
  await abrirAvaliacoes(page);
  await expect(page.getByTestId('coming-soon')).toHaveCount(0);
});

/* ==========================================================================
 * A RESPOSTA
 * ======================================================================= */

/*
 * A MANCHETE É A ETIQUETA QUE SE REPETIU. É a frase que o backend desenhou a
 * etiqueta fechada para poder escrever, e a razão de a tela existir: "média
 * 3,4" não conserta nada, "3 das 6 notas baixas apontaram Atrasou" conserta.
 */
test('abre com a etiqueta que se repetiu, e não com uma lista cronológica', async ({ page }) => {
  await abrirAvaliacoes(page);

  await expect(page.getByTestId('reviews-veredito')).toHaveText(
    '3 das 6 notas baixas apontaram “Atrasou”.',
  );

  // A seção acionável vem antes da lista, e ranqueada.
  const etiquetas = page.getByTestId('reviews-etiquetas');
  await expect(etiquetas).toContainText('Atrasou');
  await expect(etiquetas).toContainText('Faltou item');
});

test('os três números conferem a frase', async ({ page }) => {
  await abrirAvaliacoes(page);

  // As nove avaliações do período, somando as duas filiais.
  await expect(page.getByTestId('reviews-total')).toHaveText('9');
  await expect(page.getByTestId('reviews-baixas')).toHaveText('6');
  await expect(page.getByTestId('reviews-media')).toHaveText('2,9');
});

/*
 * A soma das etiquetas (5) não fecha com o total de notas baixas (6), e isso
 * não é defeito: a etiqueta é opcional para quem avalia. Sem a linha, duas
 * contagens que discordam na mesma dobra lêem como tela quebrada.
 */
test('explica as notas baixas que não apontaram etiqueta', async ({ page }) => {
  await abrirAvaliacoes(page);

  await expect(page.getByTestId('reviews-frase-sem-etiqueta')).toHaveText(
    '1 nota baixa não apontou etiqueta — escolhê-la é opcional para quem avalia.',
  );
});

/* ==========================================================================
 * O FILTRO DE NOTA — e a propriedade que ele NÃO pode quebrar
 * ======================================================================= */

test('abre recortada em "até 3 estrelas", e diz isso na faixa', async ({ page }) => {
  await abrirAvaliacoes(page);

  await expect(page.getByTestId('reviews-filtro-nota')).toContainText('Até 3 estrelas');

  // A lista traz as seis baixas do período, e nenhuma alta.
  const lista = page.getByTestId('reviews-lista');
  await expect(lista).toContainText('#5471');
  await expect(lista).not.toContainText('#5449');

  // E o recorte viaja no ENDEREÇO, não numa peneira feita no navegador.
  const ultima = api.reviewQueries().at(-1)!;
  expect(ultima.get('max_rating')).toBe('3');
});

/*
 * ============================================================================
 * O TESTE QUE ESTA TELA EXISTE PARA NÃO FALHAR
 * ============================================================================
 *
 * Filtrar para "só as notas baixas" NÃO pode fazer a média desabar. Se ela
 * caísse, o dono concluiria que a semana piorou quando ele só apertou um
 * filtro de lista — e é por isso que o backend mantém `max_rating` fora do
 * agregado.
 *
 * A prova é feita nas DUAS direções (com e sem recorte), porque uma tela que
 * recalculasse a média a partir da lista passaria em metade delas.
 */
test('o filtro de nota recorta a lista e não mexe na média nem nas barras', async ({ page }) => {
  await abrirAvaliacoes(page);

  const media = page.getByTestId('reviews-media');
  const total = page.getByTestId('reviews-total');
  await expect(media).toHaveText('2,9');
  await expect(total).toHaveText('9');

  await escolher(page.getByTestId('reviews-filtro-nota'), 'Todas as notas');

  await expect(page.getByTestId('reviews-lista')).toContainText('#5449');
  // Os mesmos números: o agregado fala do período inteiro, sempre.
  await expect(media).toHaveText('2,9');
  await expect(total).toHaveText('9');

  await escolher(page.getByTestId('reviews-filtro-nota'), 'Só 1 estrela');

  await expect(page.getByTestId('reviews-lista')).not.toContainText('#5468');
  await expect(media).toHaveText('2,9');
  await expect(total).toHaveText('9');
});

/*
 * A MÉDIA E AS BARRAS SÃO O MESMO NÚMERO LIDO DUAS VEZES. O backend as tira do
 * mesmo histograma justamente para que não haja como depurar "média 4,2 sobre
 * barras que somam 4,6" olhando a tela — e a tela não pode desfazer isso
 * recalculando uma das duas a partir da lista.
 */
test('as barras somam a média que está escrita ao lado delas', async ({ page }) => {
  await abrirAvaliacoes(page);

  const contagens = await page.getByTestId('reviews-histograma').locator('li').allInnerTexts();
  // As cinco linhas aparecem sempre, da melhor nota para a pior.
  expect(contagens).toHaveLength(5);

  const numeros = contagens.map((linha) => linha.trim().split(/\s+/).map(Number));
  const soma = numeros.reduce(
    (acumulado, [nota, quantidade]) => acumulado + nota! * quantidade!,
    0,
  );
  const total = numeros.reduce((acumulado, [, quantidade]) => acumulado + quantidade!, 0);

  expect(total).toBe(9);
  expect((soma / total).toFixed(1).replace('.', ',')).toBe(
    await page.getByTestId('reviews-media').innerText(),
  );
});

/* ==========================================================================
 * O RECORTE DE FILIAL
 * ======================================================================= */

test('o seletor do topo recorta as avaliações, e a tela diz qual loja está no ar', async ({
  page,
}) => {
  await abrirAvaliacoes(page);

  await expect(page.getByTestId('reviews-lista')).toContainText('#5439');

  await escolherFilial(page, FAKE_BRANCH_2);

  await expect(page.getByTestId('reviews-escopo')).toContainText(branchName(FAKE_BRANCH_2));
  await expect(page.getByTestId('reviews-total')).toHaveText('1');
  await expect(page.getByTestId('reviews-lista')).toContainText('#5439');
  await expect(page.getByTestId('reviews-lista')).not.toContainText('#5471');

  expect(api.reviewQueries().at(-1)!.get('branch_id')).toBe(FAKE_BRANCH_2.id);
});

/* ==========================================================================
 * O QUE A LINHA MOSTRA — E O QUE ELA NÃO MOSTRA
 * ======================================================================= */

/*
 * A resposta NÃO traz nome nem telefone do cliente, de propósito: os dois já
 * estão em Pedidos, e repetir dado pessoal numa segunda tela é superfície a
 * mais. O que liga a nota ao que aconteceu é o número do pedido.
 */
test('a avaliação mostra nota, etiqueta, número do pedido e comentário — e nenhum dado do cliente', async ({
  page,
}) => {
  await abrirAvaliacoes(page);

  const primeira = page.getByTestId('reviews-lista').locator('li').first();
  await expect(primeira).toContainText('Atrasou');
  await expect(primeira).toContainText('#5471');
  await expect(primeira).toContainText('Esperei 1h40 e a pizza chegou fria.');
  await expect(primeira.getByRole('img', { name: '1 de 5 estrelas' })).toBeVisible();

  // Nenhum nome e nenhum telefone de cliente na tela inteira.
  const corpo = await page.locator('.reviews').innerText();
  expect(corpo).not.toContain('Ana Paula');
  expect(corpo).not.toContain('85999990000');
});

/* ==========================================================================
 * OS DOIS VAZIOS, QUE SÃO DIFERENTES
 * ======================================================================= */

/*
 * NINGUÉM AVALIOU: uma tela, não quatro seções zeradas — e ela precisa dizer
 * COMO o cliente avalia, senão a conclusão do dono é que o recurso não
 * funciona.
 */
test('restaurante sem avaliação vê a explicação, não seções zeradas', async ({ page }) => {
  api.clearReviews();
  await abrirPorUrl(page);

  const vazio = page.getByTestId('reviews-vazio');
  await expect(vazio).toBeVisible();
  await expect(vazio).toContainText('Nenhuma avaliação neste período.');
  await expect(vazio).toContainText('tela de acompanhamento do pedido');

  // Nada de média "—" com cinco barras rentes ao chão.
  await expect(page.getByTestId('reviews-histograma')).toHaveCount(0);
  await expect(page.getByTestId('reviews-media')).toHaveCount(0);
  await expect(page.getByTestId('reviews-etiquetas')).toHaveCount(0);
});

/*
 * O OUTRO VAZIO É NOTÍCIA BOA, e não pode ler como defeito: houve avaliação, e
 * nenhuma foi baixa. Com o recorte de "até 3 estrelas" sendo o padrão da tela,
 * este é o estado em que a lista abre vazia numa semana em que tudo deu certo —
 * e a saída para a lista inteira tem de estar ali, porque adivinhar que o
 * filtro está no alto da faixa é pedir demais.
 */
test('semana sem nota baixa lê como notícia boa, com saída para a lista inteira', async ({
  page,
}) => {
  api.onlyHighReviews();
  await abrirPorUrl(page);

  await expect(page.getByTestId('reviews-veredito')).toHaveText(
    'Nenhuma nota baixa neste período — 3 avaliações foram de 4 ou 5 estrelas.',
  );

  // A seção "o que deu errado" não é desenhada: um bloco anunciando zero custa
  // uma dobra por turno para dizer o que a frase acima já disse.
  await expect(page.getByTestId('reviews-etiquetas')).toHaveCount(0);
  await expect(page.getByTestId('reviews-frase-sem-etiqueta')).toHaveCount(0);
  // O histograma continua: é dele que a média sai.
  await expect(page.getByTestId('reviews-histograma')).toBeVisible();

  const vazio = page.getByTestId('reviews-lista-vazia');
  await expect(vazio).toContainText('Nenhuma nota de até 3 estrelas neste período');

  await page.getByTestId('reviews-ver-tudo').click();
  await expect(page.getByTestId('reviews-lista')).toContainText('#5449');
  await expect(page.getByTestId('reviews-filtro-nota')).toContainText('Todas as notas');
});

/* ==========================================================================
 * PAPEL
 * ======================================================================= */

/*
 * A rota é da GERÊNCIA. Esconder o item da lateral não fecha a porta — o
 * endereço continua digitável, e sem a guarda o atendente cairia numa tela que
 * responde 403 e leria isso como defeito.
 */
test('o balcão não vê Avaliações, nem pelo endereço', async ({ page }) => {
  api.entrarComoPapel('attendant');
  await entrarPeloPainel(page);

  await expect(page.getByRole('link', { name: 'Avaliações' })).toHaveCount(0);

  await page.goto('/avaliacoes');
  await expect(page).toHaveURL(/\/pedidos$/);
});

/*
 * O GERENTE VÊ, e sem precisar escolher filial antes. É a diferença para
 * Desempenho: lá `ensure_pode_ler_dinheiro` recusa o gerente sem recorte, e a
 * tela pede a loja; aqui avaliação não diz quanto entrou, e quem conserta
 * atraso é justamente quem toca a loja.
 */
test('a gerência vê as avaliações sem escolher filial', async ({ page }) => {
  api.entrarComoPapel('manager');
  await abrirPorUrl(page);

  await expect(page.getByTestId('reviews-veredito')).toBeVisible();
  await expect(page.getByTestId('reviews-lista')).toBeVisible();
});

/* ==========================================================================
 * O CELULAR
 * ======================================================================= */

test('em 390px a tela continua inteira e sem rolagem lateral', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await abrirPorUrl(page);

  await expect(page.getByTestId('reviews-veredito')).toBeVisible();
  await expect(page.getByTestId('reviews-etiquetas')).toBeVisible();
  await expect(page.getByTestId('reviews-histograma')).toBeVisible();
  await expect(page.getByTestId('reviews-lista')).toBeVisible();

  const estouro = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(estouro).toBeLessThanOrEqual(1);
});
