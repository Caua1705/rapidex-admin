/**
 * A VARREDURA DE ESCOPO DE TENANT, com iscas.
 *
 * O backend passou as 82 rotas dele por uma varredura de isca. O painel nunca
 * passou por nenhuma, e a pergunta do lado de cá é outra — o backend recusa o
 * id de outra loja de qualquer jeito. Aqui o que se procura é:
 *
 *   1. alguma tela monta o restaurante ou a filial a partir de algo que a
 *      PESSOA controla (a barra de endereço, o `localStorage`) em vez da
 *      sessão?
 *   2. alguma tela alcança dado de outra filial sem o lojista ter pedido?
 *
 * O sintoma do primeiro, do lado do painel, não é vazamento: é um botão que
 * existe e não funciona. O backend responde 404, e a recusa chega na mão do
 * lojista no meio do turno como "o sistema não deixa".
 *
 * O segundo é o mais caro e não dá 4xx nenhum: a leitura de cardápio sem
 * `branch_id` responde 200, com JSON válido, somando as duas lojas.
 *
 * COMO A ISCA FUNCIONA. `fake-api.ts` olha TODA requisição interceptada e anota
 * quatro coisas (`api.fugasDeEscopo()`): a isca plantada saiu na rede; um
 * restaurante viajou; uma filial fora do token viajou; um cardápio foi lido sem
 * recorte. Os ids de isca não são devolvidos por resposta nenhuma — eles só
 * existem onde a pessoa consegue escrever. É essa a diferença entre esperar e
 * PLANTAR: um id que o falso nunca serve, o painel nunca teria como mandar por
 * acidente, e um teste que espera por ele não pode falhar.
 *
 * A metade estática desta varredura é `scripts/check-escopo.mjs`, e ela cobre o
 * que este arquivo não alcança: o caminho que nenhum teste percorre.
 */
import { expect, test, type Page } from '@playwright/test';

import {
  installFakeApi,
  ISCA_FILIAL,
  ISCA_RESTAURANTE,
  LOGIN_EMAIL,
  LOGIN_PASSWORD,
  type FakeApi,
} from './fake-api';
import { escolherFilial, FAKE_BRANCH_2 } from './seletor';

let api: FakeApi;

test.beforeEach(async ({ page }) => {
  api = await installFakeApi(page);
});

test.afterEach(() => {
  api.stop();
});

async function entrar(page: Page, destino = '/pedidos') {
  await page.goto(destino);
  await page.getByLabel('E-mail').fill(LOGIN_EMAIL);
  await page.getByLabel('Senha').fill(LOGIN_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(new RegExp(destino.split('?')[0] ?? destino));
}

/** Toda tela do painel que o dono alcança, e as onze seções de Loja. */
const TELAS = [
  '/pedidos',
  '/cozinha',
  '/cardapio',
  '/clientes',
  '/avaliacoes',
  '/desempenho',
  '/cashback',
  '/cupons',
  '/entregadores',
  '/usuarios',
  /*
   * WHATSAPP LÊ A REDE INTEIRA de propósito — a rota aceita `branch_id` e o
   * painel não o manda. É justamente por isso que ela entra na varredura: uma
   * tela que passasse a recortar pelo seletor teria de tirar o id de algum
   * lugar, e é esse "algum lugar" que a isca mede.
   */
  '/whatsapp',
  '/loja',
  '/loja/operacao',
  '/loja/marca',
  '/loja/geral',
  '/loja/valores',
  '/loja/filial',
  '/loja/horarios',
  '/loja/entrega',
  '/loja/pagamento',
  '/loja/impressao',
];

/** Espera a tela assentar: sem isso a varredura mede menos do que a tela pediu. */
async function assentar(page: Page) {
  await page.waitForLoadState('networkidle');
}

/**
 * AS QUATRO VARREDURAS SÃO LENTAS DE PROPÓSITO, e por isso são declaradas.
 *
 * Cada uma abre as {@link TELAS} inteiras e espera cada uma ASSENTAR — é isso
 * que faz a medida valer alguma coisa: uma tela que ainda está carregando não
 * mandou as requisições que a isca precisa ver. Com 22 telas, o orçamento
 * padrão de 30s ficava a segundos do teto, e a varredura passava a falhar por
 * relógio na máquina carregada — que é o §11 da skill `revisao`: portão que
 * muda de resposta conforme quem o roda.
 *
 * `test.slow()` triplica o prazo e é a forma honesta de dizer isso, em vez de
 * encurtar a lista de telas (que é o que a varredura mede) ou trocar o
 * `networkidle` por uma espera fixa.
 */
function varreduraDemorada() {
  test.slow();
}

function relatorio(fugas: ReturnType<FakeApi['fugasDeEscopo']>): string {
  return fugas.map((f) => `${f.tipo}: ${f.metodo} ${f.caminho} — ${f.detalhe}`).join('\n');
}

/* ==========================================================================
 * A PROVA DA RÉGUA — antes de qualquer varredura verde
 *
 * Uma varredura que nunca acusou nada é indistinguível de uma que não olha. As
 * quatro perguntas do gravador são exercitadas aqui com requisições feitas À
 * MÃO, de dentro da página, sem passar por tela nenhuma: é a mutação que prova
 * que o zero dos testes abaixo é um zero medido.
 * ======================================================================= */

test('a régua acusa as quatro fugas quando elas de fato acontecem', async ({ page }) => {
  await entrar(page);

  await page.evaluate(
    async ([filial, restaurante]) => {
      const pegar = (url: string) => fetch(url).catch(() => null);
      // 1. a isca plantada saindo na rede
      await pegar(`/admin/branches/${filial}/business-hours`);
      // 2. restaurante viajando em requisição
      await pegar(`/admin/orders?restaurant_id=${restaurante}`);
      // 3. filial que não é isca e também não está no token
      await pegar('/admin/branches/00000000-0000-0000-0000-000000000000/payment-methods');
      // 4. cardápio lido sem recorte de filial
      await pegar('/admin/products');
    },
    [ISCA_FILIAL, ISCA_RESTAURANTE],
  );

  const tipos = api.fugasDeEscopo().map((f) => f.tipo);
  expect(tipos).toContain('isca');
  expect(tipos).toContain('restaurante');
  expect(tipos).toContain('filial-fora-do-token');
  expect(tipos).toContain('cardapio-sem-recorte');
});

/* ==========================================================================
 * A VARREDURA — o painel inteiro, nos dois escopos que ele oferece
 * ======================================================================= */

test('nenhuma tela do painel sai do escopo, com "todas as filiais" aberta', async ({ page }) => {
  varreduraDemorada();
  await entrar(page);

  for (const tela of TELAS) {
    await page.goto(tela);
    await assentar(page);
  }

  expect(relatorio(api.fugasDeEscopo())).toBe('');
});

test('nenhuma tela do painel sai do escopo com a segunda filial escolhida', async ({ page }) => {
  varreduraDemorada();
  await entrar(page);
  // A SEGUNDA, e não a principal: com a Matriz escolhida, um id esquecido cairia
  // no mesmo valor que a resolução automática usa, e o teste passaria por sorte.
  await escolherFilial(page, FAKE_BRANCH_2);

  for (const tela of TELAS) {
    await page.goto(tela);
    await assentar(page);
  }

  expect(relatorio(api.fugasDeEscopo())).toBe('');
});

/* ==========================================================================
 * AS ISCAS PLANTADAS — onde a pessoa consegue escrever
 * ======================================================================= */

test('a filial na barra de endereço não vira o recorte de nenhuma tela', async ({ page }) => {
  varreduraDemorada();
  await entrar(page);

  /*
   * QUERY, HASH E OS DOIS NOMES. O painel não lê nenhum deles hoje — não há um
   * `useSearchParams` no `src/` inteiro —, e é justamente por isso que a isca
   * precisa existir: a primeira tela que passar a ler a barra de endereço para
   * "abrir já na filial certa" faz esta varredura ficar vermelha.
   */
  for (const tela of TELAS) {
    await page.goto(
      `${tela}?branch_id=${ISCA_FILIAL}&restaurant_id=${ISCA_RESTAURANTE}` +
        `&branchId=${ISCA_FILIAL}#branch=${ISCA_FILIAL}`,
    );
    await assentar(page);
  }

  expect(relatorio(api.fugasDeEscopo())).toBe('');
});

test('a sessão adulterada no localStorage não muda o escopo de nenhuma chamada', async ({
  page,
}) => {
  varreduraDemorada();
  await entrar(page);

  /*
   * A SESSÃO GRAVADA É DA PESSOA, e é o único lugar onde ela escreve um objeto
   * inteiro. Aqui ele recebe a filial e o restaurante da isca, mais o papel de
   * dono — o pacote que alguém montaria de propósito com o DevTools aberto.
   *
   * O que se prende: o painel volta a desenhar com o que o SERVIDOR responde
   * (`GET /admin/auth/me` e `GET /admin/branches`), e nenhuma das iscas sai
   * pela rede. O backend recusaria de qualquer forma; o que este teste guarda é
   * que o painel não chega a PEDIR — porque uma chamada que o servidor recusa
   * chega ao lojista como sistema quebrado, e não como acesso negado.
   */
  await page.evaluate(
    ([filial, restaurante]) => {
      const chave = 'rapidex-admin.session';
      const bruto = localStorage.getItem(chave);
      if (!bruto) throw new Error('sessão não gravada');
      const sessao = JSON.parse(bruto) as { user: Record<string, unknown> };
      sessao.user.branch_id = filial;
      sessao.user.restaurant_id = restaurante;
      sessao.user.role = 'owner';
      localStorage.setItem(chave, JSON.stringify(sessao));
    },
    [ISCA_FILIAL, ISCA_RESTAURANTE],
  );

  for (const tela of TELAS) {
    await page.goto(tela);
    await assentar(page);
  }

  expect(relatorio(api.fugasDeEscopo())).toBe('');

  // E o seletor continua oferecendo as duas filiais do servidor, não a isca.
  await page.goto('/pedidos');
  await page.getByTestId('branch-select').click();
  const opcoes = await page.getByRole('option').allInnerTexts();
  expect(opcoes.join(' ')).not.toContain(ISCA_FILIAL);
});

/* ==========================================================================
 * A OUTRA FILIAL — o que o painel alcança DE PROPÓSITO, e o que ele não alcança
 * ======================================================================= */

test('o cardápio de uma filial não mostra o item da outra', async ({ page }) => {
  await entrar(page, '/cardapio');
  await assentar(page);

  /*
   * O DEFEITO QUE ESTA ASSERÇÃO GUARDA já esteve em produção: a leitura sem
   * recorte responde 200 com as duas lojas somadas, e a barra de categorias
   * aparece em dobro. Nada acende — é a resposta certa para a pergunta errada.
   */
  const daOutraLoja = api
    .categories()
    .filter((categoria) => categoria.branch_id === FAKE_BRANCH_2.id);
  expect(daOutraLoja.length).toBeGreaterThan(0);

  for (const categoria of daOutraLoja) {
    await expect(page.getByRole('tab', { name: categoria.name, exact: true })).toHaveCount(0);
  }
  expect(relatorio(api.fugasDeEscopo())).toBe('');
});

test('a busca do gêmeo lê a outra loja de propósito, e só as do token', async ({ page }) => {
  await entrar(page, '/cardapio');
  await assentar(page);

  /*
   * A ÚNICA TELA QUE ALCANÇA OUTRA FILIAL DE PROPÓSITO, e ela precisa: parear a
   * chave de catálogo é procurar o mesmo item na outra loja. O que a varredura
   * prova aqui não é que ela não busca — é que a lista de onde buscar sai de
   * `useSession().branches`, então ela nunca alcança uma loja que o token não
   * enxerga. Sem esta asserção, "não achei fuga" poderia ser só "a busca do
   * gêmeo nunca rodou nesta varredura".
   */
  await page.getByTestId('category-select-cat-2').click();
  await page.getByRole('button', { name: 'Novo item' }).click();
  await page.getByLabel('Nome do item').fill('Milkshake de morango');
  await page.getByTestId('catalog-pair-open').click();

  // A busca de fato correu: o gêmeo da outra loja está na lista.
  await expect(page.getByTestId('catalog-pair-result-prod-zn-milkshake')).toContainText(
    'Zona Norte',
  );

  await expect
    .poll(() => api.fugasDeEscopo().length, {
      timeout: 5000,
      message: relatorio(api.fugasDeEscopo()),
    })
    .toBe(0);
});

test('a comanda segue a filial DO PEDIDO, e não a escolhida no topo', async ({ page }) => {
  /*
   * O ÚNICO ID DE FILIAL DO PAINEL QUE NÃO SAI DO SELETOR.
   *
   * `OrderDetailPanel` entrega `detail.branch_id` à comanda, e é o certo: a
   * impressora é a da loja que recebeu o pedido, não a da loja que está
   * escolhida no cabeçalho. Com "todas as filiais" aberta — o estado normal de
   * quem opera duas lojas —, o pedido da Zona Norte tem de perguntar pelo
   * programa DELA.
   *
   * A varredura precisa deste caso escrito porque um "nenhuma fuga" que nunca
   * abriu um pedido de outra loja não teria olhado justamente o ponto onde a
   * filial vem de uma RESPOSTA, e não da sessão.
   */
  api.orders.push(
    api.makeOrder({ id: 'ord-zn-escopo', order_number: 2001, branch_id: FAKE_BRANCH_2.id }),
  );

  await entrar(page);
  await assentar(page);
  await page.getByTestId('order-card-2001').click();

  const pedidoDoAgente = page.waitForRequest((req) =>
    req.url().includes(`/admin/branches/${FAKE_BRANCH_2.id}/print-agent`),
  );
  await page.getByTestId('comanda-abrir').click();
  await pedidoDoAgente;

  expect(relatorio(api.fugasDeEscopo())).toBe('');
});
