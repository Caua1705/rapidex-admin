/**
 * E2E do cardápio.
 *
 * Cobre as cinco regras da tela que dão errado em silêncio — o backend aceita,
 * a tela não reclama, e o cardápio publicado sai errado:
 *
 *   1. o cardápio é DE UMA FILIAL, e a tela recorta por ela;
 *   1b. parear a chave de catálogo grava nos DOIS lados, e editar um item
 *       pareado não desfaz o par;
 *   2. reordenar categoria manda a LISTA COMPLETA de ids da filial;
 *   3. esgotar usa PATCH /admin/products/{id}/availability, não o PATCH do
 *      produto inteiro;
 *   4. `is_active` e `is_available` são eixos diferentes;
 *   5. não existe excluir — existe desativar.
 */
import { expect, test, type Page } from '@playwright/test';

import { installFakeApi, LOGIN_EMAIL, LOGIN_PASSWORD, type FakeApi } from './fake-api';
import { escolher, FAKE_BRANCH, FAKE_BRANCH_2 } from './seletor';
import { branchName } from '../src/layout/branch-heading';

let api: FakeApi;

test.beforeEach(async ({ page }) => {
  api = await installFakeApi(page);
});

test.afterEach(() => {
  api.stop();
});

async function abrirCardapio(page: Page) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(LOGIN_EMAIL);
  await page.getByLabel('Senha').fill(LOGIN_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/pedidos$/);

  await page.getByRole('link', { name: 'Cardápio' }).click();
  await expect(page).toHaveURL(/\/cardapio$/);
  await expect(page.getByRole('heading', { name: 'Lanches' })).toBeVisible();
}

test('abre na primeira categoria com os itens dela', async ({ page }) => {
  await abrirCardapio(page);

  await expect(page.getByText('X-Burger Clássico')).toBeVisible();
  await expect(page.getByText('X-Salada')).toBeVisible();
  // Preço em real, com vírgula decimal.
  await expect(page.getByText('R$ 24,90')).toBeVisible();

  // Categoria inativa aparece na barra — é ela que o lojista precisa achar
  // para reativar — e vem marcada.
  await expect(page.getByText('Sobremesas')).toBeVisible();
  await expect(page.getByText('Inativa')).toBeVisible();
});

/*
 * A contagem responde "qual categoria está vazia?" — a pergunta que faz o
 * lojista descobrir que subiu o cardápio pela metade ANTES do cliente. Sem ela,
 * a única forma de saber é abrir categoria por categoria.
 */
test('cada categoria mostra quantos itens tem, inclusive a vazia', async ({ page }) => {
  await abrirCardapio(page);

  await expect(page.getByTestId('category-count-cat-1')).toHaveText('3 itens');
  // Quatro desde que "Onion rings" entrou no falso — ele é o item que saiu de
  // venda sozinho, por grupo obrigatório vazio. Ver `initialProducts`.
  await expect(page.getByTestId('category-count-cat-2')).toHaveText('4 itens');
  // Zero é o número que importa: é a categoria que ninguém percebeu que ficou
  // sem item. Ele aparece escrito, e não como linha em branco.
  await expect(page.getByTestId('category-count-cat-3')).toHaveText('0 itens');
});

test('criar um item atualiza a contagem da categoria na barra', async ({ page }) => {
  await abrirCardapio(page);
  await expect(page.getByTestId('category-count-cat-1')).toHaveText('3 itens');

  await page.getByRole('button', { name: 'Novo item' }).click();
  await page.getByLabel('Nome do item').fill('X-Tudo');
  await page.getByLabel('Preço').fill('32,00');
  await page.getByRole('button', { name: 'Salvar' }).click();

  await expect(page.getByTestId('category-count-cat-1')).toHaveText('4 itens');
});

test('esgotar um item usa a rota de disponibilidade e não some com a linha', async ({ page }) => {
  await abrirCardapio(page);

  const linha = page.getByTestId('product-row-prod-1');
  const interruptor = linha.getByRole('switch');
  await expect(interruptor).toHaveAttribute('aria-checked', 'true');

  await interruptor.click();

  await expect(interruptor).toHaveAttribute('aria-checked', 'false');
  await expect(linha.getByText('Esgotado')).toBeVisible();
  // O estado é dito uma vez só na linha, não em tag e rótulo ao mesmo tempo.
  await expect(linha.getByText('Esgotado')).toHaveCount(1);

  // A rota certa, com o corpo de um campo só.
  await expect
    .poll(() => api.availabilityCalls())
    .toEqual([{ productId: 'prod-1', isAvailable: false }]);
  expect(api.product('prod-1')?.is_available).toBe(false);
  // Esgotar não desativa: o item continua no cardápio, para voltar a vender.
  expect(api.product('prod-1')?.is_active).toBe(true);

  // E volta.
  await interruptor.click();
  await expect(interruptor).toHaveAttribute('aria-checked', 'true');
  await expect.poll(() => api.availabilityCalls()).toHaveLength(2);
});

test('item inativo esmaece e não oferece o interruptor de disponível', async ({ page }) => {
  await abrirCardapio(page);

  // "Combo Duplo" está inativo E marcado como disponível: são eixos diferentes.
  const inativo = page.getByTestId('product-row-prod-3');
  await expect(inativo).toHaveClass(/item--inactive/);
  await expect(inativo.getByText('Inativo')).toBeVisible();
  await expect(inativo.getByRole('switch')).toHaveCount(0);

  // O item ativo ao lado continua com o interruptor.
  await expect(page.getByTestId('product-row-prod-1').getByRole('switch')).toHaveCount(1);
});

test('reordenar categoria manda a lista completa de ids', async ({ page }) => {
  await abrirCardapio(page);

  /*
   * As setas de reordenar só aparecem com o ponteiro na linha — elas ocupam o
   * lugar da contagem, e é isso que tira da barra uma coluna de setinhas
   * permanentes competindo com o nome da categoria. Por isso o teste passa o
   * mouse antes de clicar, como a pessoa faz.
   */
  await page.getByTestId('category-select-cat-2').hover();
  await page.getByRole('button', { name: 'Mover Acompanhamentos para cima' }).click();

  await expect.poll(() => api.reorderCalls()).toHaveLength(1);
  const chamada = api.reorderCalls()[0]!;

  // A FILIAL VAI NO CORPO. Sem ela o backend responde 422 — e a lista completa
  // de uma loja é parcial para a outra, então sem o recorte não haveria como
  // saber qual das duas esta lista pretende ser.
  expect(chamada.branchId).toBe(FAKE_BRANCH.id);

  // A ordem nova...
  expect(chamada.categoryIds).toEqual(['cat-2', 'cat-1', 'cat-3']);
  /*
   * ...e, o que mais importa, TODAS as categorias DESTA FILIAL — inclusive a
   * inativa (cat-3), que não foi tocada. Mandar só o que mudou zeraria a
   * posição dela.
   *
   * A contagem é a da filial, e não a do "banco" inteiro: a segunda loja tem o
   * cardápio dela, e comparar com o total somado exigiria da tela uma lista
   * que ela nunca deve mandar.
   */
  expect(chamada.categoryIds).toHaveLength(api.categories(FAKE_BRANCH.id).length);
  expect(chamada.categoryIds).toContain('cat-3');

  // A barra reflete a ordem que o backend devolveu.
  const nomes = await page.locator('.rail__name').allTextContents();
  expect(nomes).toEqual(['Acompanhamentos', 'Lanches', 'Sobremesas']);
});

/*
 * O DEFEITO QUE ABRIU ESTA RODADA, E O ÚNICO QUE NÃO SE VÊ NO CÓDIGO.
 *
 * As duas lojas do falso têm cada uma o cardápio inteiro, como a migração as
 * deixou. Sem `branch_id` na leitura, `GET /admin/categories` responde 200 com
 * as seis categorias e a barra escreve "Lanches 3 / Lanches 3" — nada falha,
 * nada loga, e o lojista lê o cardápio dobrado.
 *
 * O teste é uma CONTAGEM, e é a forma certa aqui: "Lanches aparece uma vez" só
 * pode passar se a tela mandou o recorte, e não passaria com o painel que esta
 * rodada consertou.
 */
test('mostra o cardápio de uma filial só, sem as categorias em dobro', async ({ page }) => {
  await abrirCardapio(page);

  // Uma linha por categoria da filial, não duas.
  await expect(page.locator('.rail__name')).toHaveText([
    'Lanches',
    'Acompanhamentos',
    'Sobremesas',
  ]);

  // E o mesmo na lista: três itens em Lanches, não seis.
  await expect(page.getByTestId('category-count-cat-1')).toHaveText('3 itens');
  await expect(page.getByText('X-Burger Clássico')).toHaveCount(1);
});

/*
 * TROCAR DE FILIAL TROCA O CARDÁPIO — não filtra o mesmo cardápio.
 *
 * Os ids são outros (`prod-1` na Aldeota, `prod-1-zn` na Zona Norte), e é isso
 * que prova que a tela releu em vez de reaproveitar o que tinha em mão. O
 * mesmo NOME nas duas é o esperado: são duas linhas independentes que a
 * migração criou com a mesma `catalog_key`.
 */
test('trocar de filial no topo troca o cardápio inteiro', async ({ page }) => {
  await abrirCardapio(page);
  await expect(page.getByTestId('product-row-prod-1')).toBeVisible();

  await escolher(page.getByTestId('branch-select'), branchName(FAKE_BRANCH_2));

  // O item da outra loja, com o id da outra loja.
  await expect(page.getByTestId('product-row-prod-1-zn')).toBeVisible();
  // E o da primeira sumiu: não é o mesmo produto visto de outro ângulo.
  await expect(page.getByTestId('product-row-prod-1')).toHaveCount(0);
});

/*
 * "TODAS AS FILIAIS" NÃO É OFERECIDA AQUI, e é a metade da decisão que se vê
 * na tela. Ali ela não seria um recorte mais largo: seria o cardápio das duas
 * lojas somado — o defeito de cima, oferecido como opção.
 */
test('o seletor do topo não oferece "todas as filiais" no cardápio', async ({ page }) => {
  await abrirCardapio(page);

  const seletor = page.getByTestId('branch-select');
  await seletor.click();
  await expect(page.getByRole('option', { name: 'Todas as filiais' })).toHaveCount(0);
  await expect(page.getByRole('option')).toHaveCount(2);
  await seletor.press('Escape');
});

/*
 * A RESSALVA DE ESCOPO DIZ DE QUAL LOJA É O CARDÁPIO, e ela é a frase que mais
 * importa nesta tela: enquanto dizia "o cardápio é do restaurante inteiro", ela
 * convidava o lojista a baixar um preço achando que baixava nas duas lojas.
 */
test('a tela diz de qual loja é o cardápio que está mostrando', async ({ page }) => {
  await abrirCardapio(page);

  const escopo = page.getByTestId('menu-sector-scope');
  await expect(escopo).toContainText(branchName(FAKE_BRANCH));
  await expect(escopo).toContainText('valem só nesta loja');
  await expect(escopo).not.toContainText('restaurante inteiro');
});

test('a primeira categoria não tem "mover para cima", nem a última "para baixo"', async ({
  page,
}) => {
  await abrirCardapio(page);

  await expect(page.getByRole('button', { name: 'Mover Lanches para cima' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Mover Sobremesas para baixo' })).toBeDisabled();
  expect(api.reorderCalls()).toHaveLength(0);
});

test('desativar é o caminho: não existe excluir em lugar nenhum', async ({ page }) => {
  await abrirCardapio(page);

  await expect(page.getByRole('button', { name: /excluir|apagar|remover/i })).toHaveCount(0);

  await page.getByRole('button', { name: 'Editar X-Burger Clássico' }).click();
  const dialogo = page.getByRole('dialog');
  await expect(dialogo.getByRole('button', { name: /excluir|apagar|remover/i })).toHaveCount(0);
  await expect(dialogo.getByText(/Não existe excluir item/)).toBeVisible();

  // Desativar o item é o que tira do cardápio.
  await dialogo.getByRole('switch', { name: 'Item ativo' }).click();
  await dialogo.getByRole('button', { name: 'Salvar' }).click();

  await expect.poll(() => api.product('prod-1')?.is_active).toBe(false);
  await expect(page.getByTestId('product-row-prod-1')).toHaveClass(/item--inactive/);
});

test('trocar de categoria troca a lista de itens', async ({ page }) => {
  await abrirCardapio(page);

  // Pelo testid: o rótulo do botão junta nome e contagem ("Acompanhamentos
  // 1 item"), e os botões de mover também levam o nome da categoria.
  await page.getByTestId('category-select-cat-2').click();

  await expect(page.getByRole('heading', { name: 'Acompanhamentos' })).toBeVisible();
  await expect(page.getByText('Batata frita M')).toBeVisible();
  await expect(page.getByText('X-Burger Clássico')).toHaveCount(0);
});

/*
 * CADASTRAR COM FOTO, DE PONTA A PONTA — e é o único teste que percorre isto.
 *
 * O caminho tem três juntas que o compilador não vê, porque nenhuma delas é
 * questão de tipo, e as três já falharam em silêncio:
 *
 *   1. o diálogo só continua aberto se o lojista PEDIU a foto; quem cadastra em
 *      série não pode ganhar um fechamento manual por item;
 *   2. `POST /admin/products/{id}/image` precisa do id do item recém-criado —
 *      quem lê `initial.id` em vez do rascunho manda a foto para lugar nenhum;
 *   3. a foto sobe por ROTA PRÓPRIA, sem passar por `saveProduct`, então a
 *      lista atrás do diálogo não sabe dela. Sem reler, a linha fica com a
 *      miniatura vazia e o lojista — que enviou a foto há dois segundos — lê
 *      isso como falha e envia de novo.
 *
 * O arquivo é um PNG de verdade (160×100, `e2e/fixtures/prato.png`): tem que
 * decodificar no Chromium para o `image.onload` disparar, e é retangular de
 * propósito, porque o recorte 1:1 só tem o que fazer quando a foto não é
 * quadrada.
 */
test('cadastrar um item com foto: o diálogo fica aberto e a lista mostra a miniatura', async ({
  page,
}) => {
  await abrirCardapio(page);

  await page.getByRole('button', { name: 'Novo item' }).click();
  await page.getByLabel('Nome do item').fill('X-Tudo');
  await page.getByLabel('Preço').fill('32,00');

  // Sem este clique, salvar fecharia — que é o comportamento do item sem foto.
  await page.getByTestId('product-image-intent').click();
  await page.getByRole('button', { name: 'Salvar e pôr foto' }).click();

  // Salvou e NÃO fechou. A frase é o que separa isso de "não salvou": sem ela,
  // a mesma janela aberta depois do clique lê como falha.
  const dialogo = page.getByRole('dialog');
  await expect(page.getByTestId('product-created-notice')).toContainText('foi criado');
  await expect(dialogo).toHaveAttribute('aria-label', 'Editar item');

  // O item existe, então o campo agora oferece o escolhedor no lugar do pedido.
  await page.getByTestId('product-image-input').setInputFiles('e2e/fixtures/prato.png');
  await expect(page.getByTestId('product-image-frame')).toBeVisible();
  await page.getByTestId('product-image-send').click();

  // Chegou multipart com bytes de verdade, no item que acabou de nascer.
  await expect.poll(() => api.imageUploads().length).toBe(1);
  const enviada = api.imageUploads()[0];
  if (!enviada) throw new Error('O upload não chegou ao backend falso.');
  expect(enviada.bytes).toBeGreaterThan(0);
  expect(api.product(enviada.productId)?.name).toBe('X-Tudo');

  /*
   * O PONTO DESTE TESTE. A linha da lista mostra a miniatura SEM fechar o
   * diálogo e sem trocar de categoria — só a releitura que o envio dispara põe
   * a foto ali. Este é o passo que o typecheck não pega e que já se perdeu.
   */
  const linha = page.getByTestId(`product-row-${enviada.productId}`);
  await expect(linha.locator('img.item__thumb')).toHaveAttribute(
    'src',
    new RegExp(enviada.productId),
  );

  // E o rodapé não oferece mais "Cancelar": o item já existe.
  await dialogo.getByRole('button', { name: 'Concluir' }).click();
  await expect(dialogo).toHaveCount(0);
});

/*
 * ============================================================================
 * A CHAVE DE CATÁLOGO — o que o painel não tinha, e o que faltava quebrava em
 * silêncio
 * ============================================================================
 *
 * A migração pareou o que já existia: cada item nasceu com a mesma
 * `catalog_key` nas duas lojas, e `/reports/products` soma os dois numa linha.
 * Tudo o que o lojista cadastra DEPOIS nasce sem chave — e um item sem chave
 * some do agrupamento, contado sozinho, sem nenhuma tela ficando errada.
 *
 * "Milkshake de morango" existe só na Zona Norte e SEM chave, que é o estado de
 * qualquer item cadastrado pelo painel. Parear com ele é o único caminho em que
 * a chave precisa ser carimbada nos dois lados, porque não há nenhuma para
 * reaproveitar — e é aí que "gravou só de um lado" pareceria ter funcionado.
 */
test('parear com o item de outra loja grava a mesma chave nos dois', async ({ page }) => {
  await abrirCardapio(page);

  // Acompanhamentos, que é onde o gêmeo está do outro lado.
  await page.getByTestId('category-select-cat-2').click();
  await page.getByRole('button', { name: 'Novo item' }).click();
  await page.getByLabel('Nome do item').fill('Milkshake de morango');
  await page.getByLabel('Preço').fill('18,00');

  // A busca já abre com o nome digitado: é o atalho que faz o campo valer a
  // pena, e sem ele o lojista redigita o que acabou de escrever.
  await page.getByTestId('catalog-pair-open').click();
  const resultado = page.getByTestId('catalog-pair-result-prod-zn-milkshake');
  await expect(resultado).toContainText('Zona Norte');
  await resultado.click();

  // A tela nomeia o par: "conta junto com X, da loja Y".
  const campo = page.getByTestId('product-catalog-pair');
  await expect(campo).toContainText('Milkshake de morango');
  await expect(campo).toContainText('Zona Norte');

  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  const novo = api
    .products()
    .find((item) => item.name === 'Milkshake de morango' && item.id !== 'prod-zn-milkshake');
  if (!novo) throw new Error('O item novo não chegou ao backend falso.');

  /*
   * OS DOIS LADOS, COM A MESMA CHAVE. Gravar só no item novo é o erro que
   * passa despercebido: o produto aparece na lista, o diálogo fecha, e o
   * relatório continua contando as duas lojas separadas.
   */
  const chaves = api.catalogKeys();
  expect(chaves[novo.id]).toBe('prod-zn-milkshake');
  expect(chaves['prod-zn-milkshake']).toBe('prod-zn-milkshake');

  // E a chave é a do GÊMEO, não a do item recém-criado: a convenção da
  // migração é o id do produto de origem, e usar o nosso parearia com nada.
  expect(chaves[novo.id]).not.toBe(novo.id);
});

/*
 * O DEFEITO MAIS SILENCIOSO DESTA TELA, e o motivo de o rascunho de edição sair
 * de uma função testada: o corpo do PATCH manda `catalog_key` sempre, então um
 * rascunho que esquecesse a chave mandaria `null` — e corrigir o preço de um
 * item pareado desfaria o par. Nada falharia; a linha do relatório é que
 * pararia de somar as duas lojas.
 */
test('corrigir o preço de um item pareado não desfaz o pareamento', async ({ page }) => {
  await abrirCardapio(page);
  expect(api.catalogKeys()['prod-1']).toBe('prod-1');

  await page.getByRole('button', { name: 'Editar X-Burger Clássico' }).click();
  await page.getByLabel('Preço').fill('27,50');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await expect.poll(() => api.product('prod-1')?.price).toBe(27.5);
  expect(api.catalogKeys()['prod-1']).toBe('prod-1');
});

/*
 * SEPARAR É UMA ESCOLHA, e ela manda `null` explícito. Sem isso o botão
 * existiria e não faria nada: omitir o campo significa "não mexi na chave", e o
 * item continuaria pareado com a tela dizendo que não está.
 */
test('separar um item pareado apaga a chave dele, e só a dele', async ({ page }) => {
  await abrirCardapio(page);

  await page.getByRole('button', { name: 'Editar X-Burger Clássico' }).click();
  await page.getByTestId('catalog-pair-clear').click();
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await expect.poll(() => api.catalogKeys()['prod-1']).toBeNull();
  // O gêmeo da outra loja não foi tocado: separar é do lado de cá.
  expect(api.catalogKeys()['prod-1-zn']).toBe('prod-1');
});

/*
 * O tema tem três camadas de decisão, e o teste cobre as três:
 *   1. sem escolha, vale a preferência do sistema (aqui, claro);
 *   2. o alternador escreve a escolha;
 *   3. a escolha sobrevive ao F5 — e chega ANTES do primeiro pixel, senão o
 *      painel pisca branco a cada recarregamento.
 */
test('o tema escolhido sobrevive ao recarregamento', async ({ page }) => {
  await abrirCardapio(page);

  const html = page.locator('html');
  // O Playwright roda com prefers-color-scheme: light por padrão.
  await expect(html).toHaveAttribute('data-theme', 'light');

  await page.getByTestId('theme-toggle').click();
  await expect(html).toHaveAttribute('data-theme', 'dark');

  await page.reload();
  // Sem flash: o atributo já está lá antes do app montar.
  await expect(html).toHaveAttribute('data-theme', 'dark');
});

/*
 * E, enquanto ninguém escolheu nada, o painel segue o sistema operacional —
 * é o que a WCAG e o bom senso pedem antes de impor a nossa preferência.
 */
test('sem escolha guardada, o tema segue o sistema', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await abrirCardapio(page);

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
