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
        /*
         * O GRUPO NOVO ENTRA NO FIM. O produto já tem dois grupos ('Ponto da
         * carne' e 'Adicionais'), então o terceiro nasce na posição 2 — e não
         * em 0, que é a PRIMEIRA e faria todo grupo novo pular para a frente
         * do cardápio, com os criados em seguida empatados entre si.
         */
        sort_order: 2,
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

/*
 * ============================================================================
 * AS DUAS FALHAS SILENCIOSAS DESTA SEÇÃO — `ausencia.md` §6 e §7
 * ============================================================================
 *
 * As duas nasciam do mesmo lugar: **o painel só sabe o que a segunda leitura
 * contou.** Uma dava à falha o valor de "não há"; a outra deixava a falha da
 * releitura desmentir uma gravação que tinha acontecido.
 */

/*
 * §6 — LISTA VAZIA É UMA AFIRMAÇÃO, e não o desenho da falta de resposta.
 *
 * Esta é a tela em que o lojista decide se precisa CRIAR um grupo. Lendo
 * "nenhum grupo de complemento" numa queda de rede, ele cria o segundo
 * "Escolha o tamanho" — e o cliente passa a ver os dois no cardápio.
 */
test('leitura de complementos que falha não vira "este item não tem nenhum"', async ({ page }) => {
  await page.route('**/admin/products/*/option-groups', (route) => route.abort());

  await abrirItem(page, 'X-Burger Clássico');

  await expect(page.getByTestId('grupos-leitura-erro')).toBeVisible();
  await expect(page.getByTestId('grupos-vazio')).toHaveCount(0);

  /*
   * E CRIAR SAI DA TELA enquanto não se sabe o que existe: é às cegas que
   * nasce o grupo repetido. O nome e o preço do item continuam editáveis —
   * eles são o que trouxe o lojista até aqui.
   */
  await expect(page.getByTestId('grupo-novo')).toHaveCount(0);
  await expect(page.getByLabel('Nome do item')).toBeEditable();
});

/*
 * §7 — GRAVOU E A RELEITURA CAIU: a tela não pode dizer que falhou.
 *
 * Com os dois `await` dividindo um `catch` só, a mensagem de erro subia e o
 * formulário ficava aberto, com o texto digitado ainda na tela. Daqui do balcão
 * isso é indistinguível de "não salvou" — e a reação natural é apertar de novo,
 * criando o grupo DUAS VEZES.
 */
test('grupo que gravou não é reportado como falha quando a releitura cai', async ({ page }) => {
  let gravou = false;
  await page.route('**/admin/products/*/option-groups', async (route) => {
    const requisicao = route.request();
    if (requisicao.method() === 'POST') {
      gravou = true;
      await route.fallback();
      return;
    }
    // A releitura de DEPOIS da gravação é a que cai. A primeira leitura, não:
    // sem ela a tela nem chega ao formulário.
    if (gravou) {
      await route.abort();
      return;
    }
    await route.fallback();
  });

  await abrirItem(page, 'X-Burger Clássico');

  await page.getByTestId('grupo-novo').click();
  await page.getByTestId('grupo-nome').fill('Escolha o tamanho');
  await page.getByTestId('grupo-salvar').click();

  // A gravação aconteceu, e uma vez só.
  await expect.poll(() => api.optionGroupBodies().length).toBe(1);

  // O FORMULÁRIO FECHOU: é ele, aberto, que convida ao segundo clique.
  await expect(page.getByTestId('grupo-nome')).toHaveCount(0);
  await expect(page.getByTestId('grupo-novo')).toBeVisible();

  /*
   * E a mensagem diz o que de fato houve. "Salvo" primeiro, porque é a
   * informação que muda o que o lojista faz em seguida; a lista velha é a
   * ressalva, não a manchete.
   */
  await expect(page.getByTestId('grupos-erro')).toContainText('Salvo.');
  await expect(page.getByTestId('grupos-erro')).toContainText('pode estar desatualizado');
});

/*
 * ============================================================================
 * AS TRÊS ESCRITAS DE COMPLEMENTO QUE SÓ TINHAM CAMINHO FELIZ
 * ============================================================================
 *
 * Fecham o item 2 de `scratchpad/escritas-sem-teste.md`. O par que cada uma
 * prova é o de sempre — a frase do backend chega inteira, e a tela não afirma o
 * que não aconteceu. O que muda é o desfecho da primeira, que é o oposto das
 * outras duas, e é onde estava o defeito.
 */

/*
 * O INTERRUPTOR QUE SE DESFAZIA SOZINHO — a irmã que o §7 de `ausencia.md`
 * não pegou, e ela é pior que a dele.
 *
 * Ligar ou desligar uma opção são DUAS chamadas: `PATCH /admin/options/{id}` e
 * a releitura dos grupos. Enquanto dividiam um `catch`, a releitura que caía
 * escrevia erro com o interruptor ainda no estado ANTIGO — porque quem o
 * desenha é a lista, e a lista não tinha mudado.
 *
 * Do balcão isso é "não deu certo", e a reação natural é clicar de novo. Só que
 * o segundo clique manda o valor OPOSTO: ele DESFAZ a gravação que funcionou.
 * Não é duplicata — é reversão silenciosa. E o que este interruptor decide é se
 * a opção sai de venda, que num grupo obrigatório tira o item inteiro do
 * cardápio do cliente.
 */
test('opção alternada com a releitura caída: a tela não nega, e o interruptor acompanha', async ({
  page,
}) => {
  await abrirItem(page, 'X-Burger Clássico');

  // Bacon está no grupo OPCIONAL: desligá-lo não passa pela confirmação, que é
  // outra tela e outro teste.
  const bacon = page.getByRole('switch', { name: 'Bacon ativa' });
  await expect(bacon).toBeChecked();

  /*
   * Só a releitura cai, e só uma vez — uma piscada de wi-fi. A gravação passa,
   * que é a premissa inteira deste teste.
   */
  let caiu = false;
  await page.route('**/admin/products/*/option-groups', async (route) => {
    if (!caiu && route.request().method() === 'GET') {
      caiu = true;
      await route.abort();
      return;
    }
    await route.fallback();
  });

  await bacon.click();

  /*
   * "Salvo" PRIMEIRO — a palavra que muda o que a pessoa faz em seguida, na
   * mesma ordem que o §7 fixou em `gravar`. A ressalva nomeia o que a releitura
   * traria e não trouxe: o efeito indireto no grupo obrigatório.
   */
  await expect(page.getByTestId('grupos-erro')).toContainText('Salvo');

  /*
   * E O INTERRUPTOR ACOMPANHA A GRAVAÇÃO. É a asserção que fecha o buraco: sem
   * ela a tela diria "salvo" com a chave no lugar antigo, e o clique seguinte
   * mandaria o oposto.
   */
  await expect(bacon).not.toBeChecked();

  // No "banco", uma gravação só — e ela é a que o lojista pediu.
  const grupos = api.optionGroupsOf('prod-1') as {
    options?: { id: string; is_active: boolean }[];
  }[];
  const opcao = grupos.flatMap((g) => g.options ?? []).find((o) => o.id === 'opt-bacon');
  expect(opcao?.is_active).toBe(false);
});

/*
 * O 422 DA MESCLA, e o FORMATO dele é a metade que importa.
 *
 * `AdminMenuService.update_option_group` valida sobre a mescla com o banco, e
 * quando recusa monta o `detail` como TEXTO (`"; ".join(...)`) — porque essa
 * validação acontece depois do corpo, e o 422 automático do Pydantic não a
 * alcança. O `POST` de opção, logo abaixo, recusa com `detail` de LISTA.
 *
 * São dois formatos de erro na mesma seção da mesma tela, e a frase precisa
 * chegar nos dois. É a família do `detail` que não é string da skill `revisao`:
 * quando `messageFromUnknownError` não sabe ler o formato, o lojista lê o
 * número HTTP no lugar da frase que o backend mandou pronta.
 */
test('grupo recusado na mescla: a frase do backend aparece e o formulário não fecha', async ({
  page,
}) => {
  await abrirItem(page, 'X-Burger Clássico');

  await page.getByTestId('grupo-editar-grp-adicionais').click();
  await page.getByTestId('grupo-nome').fill('Adicionais do lanche');

  await page.route('**/admin/option-groups/grp-adicionais', (route) =>
    route.fulfill({
      status: 422,
      contentType: 'application/json',
      // TEXTO, e não lista: é o formato que `update_option_group` monta.
      body: JSON.stringify({ detail: 'max_select não pode ser menor que min_select' }),
    }),
  );

  await page.getByTestId('grupo-salvar').click();

  await expect(page.getByTestId('grupos-erro')).toContainText('max_select não pode ser menor');

  // O formulário fica, com o que foi digitado: o lojista corrige um número.
  await expect(page.getByTestId('grupo-nome')).toHaveValue('Adicionais do lanche');
});

/*
 * A OPÇÃO NOVA RECUSADA — 404 do grupo, que é a recusa alcançável daqui: o
 * grupo sai do alcance do token entre abrir o formulário e salvar.
 */
test('opção nova recusada: a frase aparece, nada entra na lista e o texto fica', async ({
  page,
}) => {
  await abrirItem(page, 'X-Burger Clássico');

  const quantas = () =>
    (api.optionGroupsOf('prod-1') as { options?: unknown[] }[]).flatMap((g) => g.options ?? [])
      .length;
  const antes = quantas();

  await page.getByTestId('opcao-nova-grp-adicionais').click();
  await page.getByTestId('opcao-nome').fill('Bacon extra');
  await page.getByTestId('opcao-preco').fill('4,00');

  await page.route('**/admin/option-groups/grp-adicionais/options', (route) =>
    route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'Grupo de opções não encontrado' }),
    }),
  );

  await page.getByTestId('opcao-salvar').click();

  await expect(page.getByTestId('grupos-erro')).toContainText('Grupo de opções não encontrado');
  await expect(page.getByTestId('opcao-nome')).toHaveValue('Bacon extra');
  expect(quantas()).toBe(antes);
});

/* ==========================================================================
 * EDITAR A OPÇÃO, E ORDENAR AS OPÇÕES
 *
 * O GRUPO já era editável e a OPÇÃO não: o lojista renomeava a pergunta
 * ("Ponto da carne") e não a resposta ("Mal passado") — e a resposta é a que
 * tem preço. `PATCH /admin/options/{option_id}` aceitava os cinco campos desde
 * sempre; o painel mandava um só, `is_active`.
 * ======================================================================= */

test('editar a opção manda TRÊS campos — sem religar e sem reordenar', async ({ page }) => {
  await abrirItem(page, 'X-Burger Clássico');

  await page.getByRole('button', { name: 'Editar Bacon' }).click();

  /* O formulário abre com o que está gravado: 5 reais viram "5,00". */
  await expect(page.getByTestId('opcao-preco')).toHaveValue('5,00');

  await page.getByTestId('opcao-preco').fill('6,50');
  await page.getByTestId('opcao-descricao').fill('Duas fatias');
  await page.getByRole('button', { name: 'Salvar opção' }).click();

  await expect(page.getByTestId('grupo-grp-adicionais')).toContainText('+R$ 6,50');

  /*
   * O CORPO É A PROVA, e não a lista. Olhando só a opção gravada, "não mandou
   * `is_active`" e "mandou `true`" dão o mesmo resultado — porque ela JÁ estava
   * ativa. A diferença aparece na opção desligada, e é ela que tira o item do
   * cardápio quando o grupo é obrigatório.
   */
  const patch = api.optionPatches().at(-1);
  expect(patch?.optionId).toBe('opt-bacon');
  expect(patch?.body).toEqual({
    name: 'Bacon',
    description: 'Duas fatias',
    additional_price: 6.5,
  });
});

test('editar uma opção DESLIGADA não a religa', async ({ page }) => {
  await abrirItem(page, 'X-Burger Clássico');

  /* Desliga pelo interruptor — "Adicionais" é opcional, então não pergunta. */
  await page.getByRole('switch', { name: 'Bacon ativa' }).click();
  await expect(page.getByRole('switch', { name: 'Bacon ativa' })).toHaveAttribute(
    'aria-checked',
    'false',
  );

  await page.getByRole('button', { name: 'Editar Bacon' }).click();
  await page.getByTestId('opcao-nome').fill('Bacon artesanal');
  await page.getByRole('button', { name: 'Salvar opção' }).click();

  await expect(page.getByTestId('grupo-grp-adicionais')).toContainText('Bacon artesanal');

  /* O interruptor continua desligado — e o corpo diz por quê. */
  await expect(page.getByRole('switch', { name: 'Bacon artesanal ativa' })).toHaveAttribute(
    'aria-checked',
    'false',
  );
  expect(api.optionPatches().at(-1)?.body).not.toHaveProperty('is_active');
});

test('a ordem das opções se muda pelas setas, com uma escrita por posição', async ({ page }) => {
  await abrirItem(page, 'X-Burger Clássico');

  const grupo = page.getByTestId('grupo-grp-ponto');
  await expect(grupo).toContainText('Mal passado');

  const antes = api.optionPatches().length;
  await page.getByRole('button', { name: 'Mover Mal passado para baixo' }).click();

  /*
   * DUAS ESCRITAS, e não a lista inteira: não há rota de lote, então cada
   * requisição custa. Quem decide o que precisa ser gravado é `ordemDasOpcoes`,
   * e reescrever quem não se moveu seria gastar rede à toa.
   */
  await expect.poll(() => api.optionPatches().slice(antes).length).toBe(2);
  expect(api.optionPatches().slice(antes)).toEqual([
    { optionId: 'opt-ponto', body: { sort_order: 0 } },
    { optionId: 'opt-mal', body: { sort_order: 1 } },
  ]);

  /* E a lista, relida do falso, sai na ordem nova. */
  const nomes = await page
    .getByTestId('grupo-grp-ponto')
    .getByTestId(/^opcao-nome-/)
    .allTextContents();
  expect(nomes).toEqual(['Ao ponto', 'Mal passado']);
});

test('as pontas não movem, e o corpo da ordem não leva mais nada junto', async ({ page }) => {
  await abrirItem(page, 'X-Burger Clássico');

  await expect(page.getByRole('button', { name: 'Mover Mal passado para cima' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Mover Ao ponto para baixo' })).toBeDisabled();

  await page.getByRole('button', { name: 'Mover Ao ponto para cima' }).click();
  await expect.poll(() => api.optionPatches().length).toBeGreaterThan(0);

  /* Só `sort_order`: um corpo que levasse o nome de carona reenviaria o valor
     que estava na tela por cima do que outra aba tivesse gravado. */
  for (const patch of api.optionPatches()) {
    expect(Object.keys(patch.body)).toEqual(['sort_order']);
  }
});

/* Um grupo de uma opção só não tem ordem que se mude. */
test('grupo com uma opção só não oferece setas', async ({ page }) => {
  await abrirItem(page, 'X-Burger Clássico');

  await expect(page.getByTestId('grupo-grp-adicionais')).toContainText('Bacon');
  await expect(page.getByRole('button', { name: 'Mover Bacon para baixo' })).toHaveCount(0);
});

/*
 * O ATENDENTE NÃO TEM TESTE AQUI, e a ausência é achado.
 *
 * Escrevi um, e ele ficou vermelho pelo motivo certo: o atendente não chega a
 * este diálogo. Quem abre "Editar item" é `cardapio.editarProduto`, que é
 * GERÊNCIA — `papeis.spec.ts:154` já prende isso ("nenhum botão Editar na
 * lista"). O `podeEditar={false}` de `OptionGroupsSection` é defesa em
 * profundidade para o dia em que a leitura do complemento ganhar outra porta,
 * e a cobertura dele mora onde ele é alcançável: no teste de unidade da seção,
 * que a monta direto.
 *
 * Um e2e que "provasse" isto aqui estaria afirmando algo sobre um caminho que
 * não existe — e passaria por qualquer motivo, inclusive pelo errado.
 */
