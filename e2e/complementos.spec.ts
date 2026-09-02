/**
 * ============================================================================
 * E2E DOS COMPLEMENTOS — as quatro rotas que estavam paradas
 * ============================================================================
 *
 * O painel LIA os grupos e só sabia ligar e desligar uma opção que já existia.
 * Não criava grupo, não criava opção, não mudava `is_required`, `min_select`
 * nem `max_select`. As quatro rotas estavam prontas no backend, e o próprio
 * diálogo do item terminava com a frase "não são editados aqui".
 *
 * O QUE ISSO CUSTAVA: montar uma pizza com "Escolha o tamanho" (obrigatório,
 * 1 de 1) e "Adicionais" (opcional, até 3) era um chamado para o suporte. É o
 * cardápio de qualquer pizzaria, hamburgueria ou açaí — e o cardápio muda toda
 * semana, enquanto a filial abre uma vez por ano.
 *
 * E O FALSO NÃO SERVIA NENHUMA DELAS, nem a de ligar/desligar opção: o produto
 * vinha com `option_groups: []` sempre. Um pedaço de tela coberto por zero
 * teste porque o dublê nunca o alimentou.
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

async function abrirItem(page: Page, nome: string) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(LOGIN_EMAIL);
  await page.getByLabel('Senha').fill(LOGIN_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/pedidos$/);

  await page.getByRole('link', { name: 'Cardápio' }).click();
  await expect(page).toHaveURL(/\/cardapio$/);

  await page.getByRole('button', { name: `Editar ${nome}` }).click();
  await expect(page.getByRole('dialog')).toHaveAttribute('aria-label', 'Editar item');
}

test('os grupos aparecem com a regra escrita em português', async ({ page }) => {
  await abrirItem(page, 'X-Burger Clássico');

  /*
   * "obrigatório · escolhe de 1 a 1" é verdade e não se entende. O lojista
   * precisa reconhecer de relance o que configurou, e as formas que importam
   * são "escolha 1" e "até N".
   */
  await expect(page.getByTestId('grupo-grp-ponto')).toContainText('Obrigatório · escolha 1');
  await expect(page.getByTestId('grupo-grp-adicionais')).toContainText('Opcional · até 3');
  await expect(page.getByTestId('grupo-grp-adicionais')).toContainText('Bacon');
});

test('cria "Escolha o tamanho" — e ligar obrigatório sobe o mínimo sozinho', async ({ page }) => {
  await abrirItem(page, 'X-Burger Clássico');

  await page.getByTestId('grupo-novo').click();
  await page.getByTestId('grupo-nome').fill('Escolha o tamanho');
  await page.getByRole('switch', { name: 'O cliente é obrigado a escolher' }).click();

  /*
   * O MÍNIMO SOBE PARA 1 NO MESMO CLIQUE. O backend recusa grupo obrigatório
   * com mínimo zero, e quem preenche não pensa em `min_select` — pensa em "o
   * cliente TEM de escolher um tamanho". Sem isto, o lojista preencheria seis
   * campos e levaria 422 no clique de salvar.
   */
  await expect(page.getByTestId('grupo-min')).toHaveValue('1');

  await page.getByTestId('grupo-salvar').click();

  await expect
    .poll(() => api.optionGroupBodies().at(-1))
    .toEqual({
      productId: 'prod-1',
      body: {
        name: 'Escolha o tamanho',
        description: null,
        is_required: true,
        is_active: true,
        min_select: 1,
        max_select: 1,
        sort_order: 0,
      },
    });

  // E ele aparece na lista, sem ninguém recarregar a tela. A busca é DENTRO da
  // lista: o mesmo nome está no campo do formulário, e um seletor de texto solto
  // casaria os dois.
  await expect(page.getByTestId('grupos-lista')).toContainText('Escolha o tamanho');
});

/*
 * A REGRA CRUZADA QUE NÃO SAI NO /openapi.json. O falso a cobra como o backend
 * (422), então este teste prova que o painel nem chega a mandar — que é a
 * diferença entre uma mensagem em português e um erro de validação em inglês
 * depois do formulário inteiro preenchido.
 */
test('máximo menor que o mínimo trava na tela, e nada é chamado', async ({ page }) => {
  await abrirItem(page, 'X-Burger Clássico');

  await page.getByTestId('grupo-novo').click();
  await page.getByTestId('grupo-nome').fill('Sabores');
  await page.getByTestId('grupo-min').fill('3');

  await expect(page.getByTestId('grupo-erro-form')).toContainText('máximo não pode ser menor');
  await expect(page.getByTestId('grupo-salvar')).toBeDisabled();
  expect(api.optionGroupBodies()).toHaveLength(0);
});

test('editar as regras manda o formulário INTEIRO, e não só o que mudou', async ({ page }) => {
  await abrirItem(page, 'X-Burger Clássico');

  await page.getByTestId('grupo-editar-grp-ponto').click();
  await page.getByTestId('grupo-max').fill('2');
  await page.getByTestId('grupo-salvar').click();

  /*
   * OS SETE CAMPOS. O backend valida o RESULTADO DA MESCLA com o banco: um
   * corpo que mandasse só `max_select` poderia ser recusado por um campo que a
   * tela nem mostrou. Olhando só o grupo resultante, "mandou tudo" e "mandou só
   * o que mudou" seriam indistinguíveis — por isso o falso guarda o corpo.
   */
  await expect
    .poll(() => api.optionGroupBodies().at(-1)?.body)
    .toEqual({
      name: 'Ponto da carne',
      description: null,
      is_required: true,
      is_active: true,
      min_select: 1,
      max_select: 2,
      sort_order: 0,
    });

  await expect(page.getByTestId('grupo-grp-ponto')).toContainText('escolha de 1 a 2');
});

test('acrescenta uma opção, com preço em vírgula e no fim do grupo', async ({ page }) => {
  await abrirItem(page, 'X-Burger Clássico');

  await page.getByTestId('opcao-nova-grp-ponto').click();
  await page.getByTestId('opcao-nome').fill('Bem passado');
  await page.getByTestId('opcao-preco').fill('3,50');
  await page.getByTestId('opcao-salvar').click();

  await expect
    .poll(() => api.optionBodies().at(-1))
    .toEqual({
      groupId: 'grp-ponto',
      body: {
        name: 'Bem passado',
        description: null,
        // Número, como o `price` do produto atravessa no mesmo módulo. Dois
        // formatos de dinheiro no mesmo cardápio é como um deles chega errado.
        additional_price: 3.5,
        is_active: true,
        // Duas opções já existiam: a nova entra DEPOIS delas.
        sort_order: 2,
      },
    });

  await expect(page.getByTestId('grupo-grp-ponto')).toContainText('Bem passado');
  await expect(page.getByTestId('grupo-grp-ponto')).toContainText('R$ 3,50');
});

/*
 * O AVISO QUE IMPEDE O LOJISTA DE PERDER VENDA EM SILÊNCIO, agora exercitado de
 * ponta a ponta pela primeira vez — antes o falso não tinha opção nenhuma para
 * desativar.
 */
test('desativar a última opção de um grupo obrigatório pergunta antes', async ({ page }) => {
  await abrirItem(page, 'X-Burger Clássico');

  // "Ao ponto" primeiro: ainda sobra "Mal passado", então vai direto.
  await page.getByRole('switch', { name: 'Ao ponto ativa' }).click();
  await expect(page.getByTestId('grupo-confirmar')).toHaveCount(0);

  // Agora a última: aqui ele pergunta, e nomeia o grupo.
  await page.getByRole('switch', { name: 'Mal passado ativa' }).click();
  const aviso = page.getByTestId('grupo-confirmar');
  await expect(aviso).toContainText('última opção ativa do grupo obrigatório');
  await expect(aviso).toContainText('Ponto da carne');

  await page.getByTestId('confirm-deactivate-option').click();
  await expect(page.getByTestId('product-blocked-warning')).toContainText('fora de venda');
});

/*
 * ============================================================================
 * O QUE ESTE ARQUIVO NÃO COBRE, E POR QUÊ
 * ============================================================================
 *
 * **O atendente lendo os grupos.** `GET /admin/products/{id}/option-groups` é
 * `PESSOAS` e as três escritas são `GERÊNCIA`, então a seção esconde os
 * controles quando `podeEditar` é falso — e há teste de componente para isso
 * (`OptionGroupsSection.test.tsx`).
 *
 * Só que HOJE ELE NÃO CHEGA ATÉ AQUI: abrir o diálogo do item exige
 * `cardapio.editarProduto`, que é `PATCH /admin/products/{id}` — `GERÊNCIA`
 * também. Os dois conjuntos são o mesmo, e não há caminho de tela pelo qual um
 * atendente veja esta seção.
 *
 * A guarda fica, e ela não é enfeite: ela está ligada ao mapa GERADO do backend
 * (`papeis.ts`), então no dia em que uma das quatro rotas mudar de papel — ou
 * em que o cardápio abrir uma leitura para o balcão — ela já responde certo. O
 * que não se pode é fingir que existe e2e disso: um teste que loga como
 * atendente e nunca acha o botão de editar passaria por 30 segundos de timeout,
 * provando o oposto do que diz o nome dele.
 */
