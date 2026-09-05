/**
 * E2E DOS PAPÉIS — o botão que a pessoa não pode apertar não está na tela.
 *
 * O backend passou a decidir autorização por papel em 62 rotas `/admin`, e a
 * restrição está em produção. O painel não sabia: o atendente via os botões,
 * clicava e levava 403 — o que, do lado dele, não lê como "acesso restrito" e
 * sim como sistema quebrado.
 *
 * O QUE ESTES TESTES GUARDAM é a regra de tela, e ela tem duas metades:
 *
 *   - o controle SOME, não fica desabilitado. Desabilitado sem explicação é
 *     pior que ausente: a pessoa fica tentando, e um `title` não sobrevive ao
 *     toque;
 *   - o que ela PODE continua lá. Um recorte que esconde demais é uma
 *     funcionalidade que ninguém acha — e é o erro mais fácil de cometer numa
 *     frente destas, porque ele não gera chamado, gera desuso.
 *
 * O papel é escolhido ANTES do login (`api.entrarComoPapel`), como acontece de
 * verdade: quem entra é quem é.
 */
import { expect, test, type Page } from '@playwright/test';

import { installFakeApi, FAKE_BRANCH, LOGIN_EMAIL, LOGIN_PASSWORD, type FakeApi } from './fake-api';
import { escolherFilial } from './seletor';

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
}

/* ==========================================================================
 * A CONTA DE MÁQUINA
 * ======================================================================= */

/*
 * `print_agent` é o usuário do programa de impressão, e a senha dele fica em
 * TEXTO PURO no `config.ini` do computador do balcão. Quem lesse o arquivo
 * entrava no painel — com o preço do cardápio, a lista de clientes com telefone
 * e o faturamento do restaurante inteiro.
 *
 * O BACKEND NÃO PODE RECUSAR ISSO NO LOGIN: é por essa mesma rota que o agente
 * se autentica, e barrar o papel lá pararia a impressão de todas as lojas. A
 * recusa é da tela, e é este o teste dela.
 */
test('a conta do programa de impressão não abre o painel', async ({ page }) => {
  api.entrarComoPapel('print_agent');
  await entrar(page);

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('alert')).toContainText('conta do programa de impressão');

  // E o token NÃO fica guardado: recarregar não entra no painel pela porta dos
  // fundos da sessão salva.
  await page.reload();
  await expect(page).toHaveURL(/\/login$/);
});

/*
 * A SESSÃO JÁ GRAVADA TAMBÉM É RECUSADA. Quem entrou como `print_agent` antes
 * desta frente continuaria dentro do painel por até 12 horas: a recusa no login
 * não alcança um `localStorage` que já tem a sessão.
 */
test('sessão de conta de máquina guardada antes é derrubada na abertura', async ({ page }) => {
  await page.goto('/login');
  await page.evaluate(() => {
    window.localStorage.setItem(
      'rapidex-admin.session',
      JSON.stringify({
        accessToken: 'jwt-de-mentira',
        user: { id: 'u-1', role: 'print_agent', name: 'Impressora', email: 'i@x.com' },
      }),
    );
  });

  await page.goto('/pedidos');
  await expect(page).toHaveURL(/\/login$/);
});

/* ==========================================================================
 * O BALCÃO (attendant)
 * ======================================================================= */

test('o balcão não vê Clientes nem Desempenho, nem pelo endereço', async ({ page }) => {
  api.entrarComoPapel('attendant');
  await entrar(page);

  await expect(page.getByRole('link', { name: 'Clientes' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Desempenho' })).toHaveCount(0);

  // Esconder o item da lateral não fecha a porta: o endereço continua digitável.
  await page.goto('/clientes');
  await expect(page).toHaveURL(/\/pedidos$/);
  await page.goto('/desempenho');
  await expect(page).toHaveURL(/\/pedidos$/);
});

test('o balcão avança o pedido, e não cancela', async ({ page }) => {
  api.entrarComoPapel('attendant');
  await entrar(page);

  // O painel de detalhe abre no primeiro pedido sozinho, e ele está pendente.
  await expect(page.getByTestId('change-status-accepted')).toBeVisible();
  // Recusar é a saída do pendente: é `PATCH /status`, e é de quem opera.
  await expect(page.getByTestId('change-status-rejected')).toBeVisible();

  /*
   * E CANCELAR NÃO APARECE EM LUGAR NENHUM, nem no pedido que já está em
   * produção — ali a saída existe, e é justamente a que este papel não tem.
   * Sem abrir o #1003, o teste passaria por outro motivo: pendente não oferece
   * cancelar para ninguém.
   */
  await page.getByTestId('order-card-1003').click();
  await expect(page.getByTestId('change-status-ready')).toBeVisible();
  await expect(page.getByTestId('change-status-cancelled')).toHaveCount(0);
});

test('a gerência cancela', async ({ page }) => {
  api.entrarComoPapel('manager');
  await entrar(page);

  /*
   * NO PEDIDO QUE JÁ ESTÁ EM PRODUÇÃO. Em pendente a saída chama-se recusar, e
   * ela é de quem opera — cancelar é o que apaga trabalho já feito, e é essa a
   * que pede gerência.
   */
  await page.getByTestId('order-card-1003').click();
  await expect(page.getByTestId('change-status-cancelled')).toBeVisible();
});

test('o balcão marca esgotado, mas não cria nem edita item', async ({ page }) => {
  api.entrarComoPapel('attendant');
  await entrar(page, '/cardapio');
  await page.goto('/cardapio');

  await expect(page.getByTestId('product-row-prod-1')).toBeVisible();

  // "Acabou a costela" é a ação mais frequente do turno, e é dele.
  await expect(page.getByRole('switch').first()).toBeVisible();

  // Criar item é do dono; editar é da gerência.
  await expect(page.getByRole('button', { name: 'Novo item' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Editar / })).toHaveCount(0);
  // E o menu de ações da categoria não abre uma lista vazia: ele não existe.
  await expect(page.getByTestId('category-actions-open')).toHaveCount(0);
});

test('o balcão abre e fecha a loja, mas não muda como ela vende', async ({ page }) => {
  api.entrarComoPapel('attendant');
  await entrar(page, '/loja/operacao');
  await page.goto('/loja/operacao');

  await expect(page.getByTestId(`operation-is_open-${FAKE_BRANCH.id}`)).toBeVisible();
  // Entrega e retirada são `order-types`, da gerência: some o controle e fica
  // o estado, porque saber se a loja aceita entrega continua sendo útil.
  await expect(page.getByTestId(`operation-accepts_delivery-${FAKE_BRANCH.id}`)).toHaveCount(0);
  await expect(
    page.getByTestId(`operation-accepts_delivery-${FAKE_BRANCH.id}-leitura`),
  ).toBeVisible();
});

test('o balcão só enxerga as seções de Loja que ele opera', async ({ page }) => {
  api.entrarComoPapel('attendant');
  await entrar(page, '/loja/operacao');
  await page.goto('/loja/operacao');

  await expect(page.getByTestId('store-anchor-operacao')).toBeVisible();
  await expect(page.getByTestId('store-anchor-impressao')).toBeVisible();
  // Formulário que nunca grava é pior que seção ausente.
  await expect(page.getByTestId('store-anchor-geral')).toHaveCount(0);
  await expect(page.getByTestId('store-anchor-horarios')).toHaveCount(0);
  /*
   * MARCA SOME TAMBÉM, e a leitura dela é `PESSOAS` — o balcão PODE ler o nome
   * e os dois textos. Não é a leitura que decide: `PATCH /admin/restaurant` é
   * SOMENTE_DONO, e o que sobraria aqui é uma tela com duas caixas de texto que
   * aceitam digitação e nunca gravam.
   */
  await expect(page.getByTestId('store-anchor-marca')).toHaveCount(0);

  // E o endereço direto volta para Operação.
  await page.goto('/loja/geral');
  await expect(page).toHaveURL(/\/loja\/operacao$/);
});

/*
 * A TELA DE IMPRESSÃO É A QUE MAIS SEPARA PAPÉIS, e é onde esconder demais
 * custaria caro: quem está ao lado da impressora quando ela para é o balcão.
 */
test('o balcão vê o programa e manda teste, e não mexe nos setores', async ({ page }) => {
  api.entrarComoPapel('attendant');
  await entrar(page, '/loja/impressao');
  await page.goto('/loja/impressao');

  await expect(page.getByTestId('print-agent-status')).toBeVisible();
  await expect(page.getByTestId('print-test-destino')).toBeVisible();

  // A lista de impressoras da máquina e a edição dos setores são da gerência.
  await expect(page.getByTestId('printers-block')).toHaveCount(0);
  await expect(page.getByTestId('print-sector-rename-sec-chapa')).toHaveCount(0);
  await expect(page.getByTestId('print-sector-create')).toHaveCount(0);

  // O nome da impressora do setor CONTINUA escrito: some o controle, não o
  // dado — é metade do diagnóstico de "a comanda não saiu".
  await expect(page.getByTestId('print-sector-sec-chapa')).toContainText('EPSON TM-T20');
});

/* ==========================================================================
 * A GERÊNCIA (manager)
 * ======================================================================= */

/*
 * O CAMPO DE PREÇO É A ÚNICA REGRA DE CORPO DO BACKEND: `PATCH` de produto é da
 * gerência, e `price` é do dono. Não basta esconder o campo — o rascunho vem
 * preenchido com o preço atual, e reenviá-lo IGUAL é 403 do mesmo jeito. Por
 * isso o teste confere o CORPO que saiu.
 */
test('a gerência edita o item sem o campo de preço, e o preço não vai no corpo', async ({
  page,
}) => {
  api.entrarComoPapel('manager');
  await entrar(page, '/cardapio');
  await page.goto('/cardapio');

  await page.getByRole('button', { name: /^Editar X-Burger/ }).click();
  // Dentro do DIÁLOGO: "Preço" também é cabeçalho de coluna na lista atrás dele.
  const dialogo = page.getByLabel('Editar item');
  await expect(dialogo.getByLabel('Nome')).toBeVisible();
  await expect(dialogo.getByText('Preço', { exact: true })).toHaveCount(0);

  await dialogo.getByLabel('Nome').fill('X-Burger da casa');
  await page.getByRole('button', { name: 'Salvar' }).click();

  await expect
    .poll(() => api.products().find((item) => item.id === 'prod-1')?.name)
    .toBe('X-Burger da casa');
  const corpo = api.productPatches().at(-1);
  expect(corpo && 'price' in corpo.body).toBe(false);
});

test('o dono continua com o campo de preço', async ({ page }) => {
  api.entrarComoPapel('owner');
  await entrar(page, '/cardapio');
  await page.goto('/cardapio');

  await page.getByRole('button', { name: /^Editar X-Burger/ }).click();
  await expect(page.getByLabel('Editar item').getByText('Preço', { exact: true })).toBeVisible();
});

/*
 * FATURAMENTO: o dono sempre; a gerência só com UMA filial escolhida.
 *
 * `ensure_pode_ler_dinheiro` recusa o gerente sem recorte, porque sem
 * `branch_id` a consulta soma as lojas todas — e o resultado da Aldeota não é
 * do gerente do Centro. A tela pede a escolha em vez de disparar cinco
 * requisições que voltam 403.
 */
test('a gerência precisa escolher a filial para ver Desempenho', async ({ page }) => {
  api.entrarComoPapel('manager');
  await entrar(page, '/desempenho');
  await page.goto('/desempenho');

  await expect(page.getByTestId('perf-escolha-filial')).toBeVisible();
  await expect(page.getByTestId('perf-frase-faturamento')).toHaveCount(0);

  await escolherFilial(page, FAKE_BRANCH);
  await expect(page.getByTestId('perf-escolha-filial')).toHaveCount(0);
  await expect(page.getByTestId('perf-escopo')).toContainText('da filial');
});

/*
 * ESTE TESTE MUDOU DE FORMA, E O REQUISITO É O MESMO: a comissão é SOMENTE_DONO
 * e o gerente não a lê em lugar nenhum.
 *
 * Ela morava numa seção própria ("O que sai do faturamento", com a linha
 * "Comissão sobre R$ X de base"); hoje é uma LINHA da composição do
 * faturamento, ao lado do desconto e do cashback resgatado. O que a asserção
 * protege continua sendo o mesmo: o cartão inteiro aparece para o gerente — ele
 * lê o faturamento da filial dele —, e a linha da comissão não.
 *
 * Ela não é zero nem travessão: ela NÃO É DESENHADA. Um "Comissão R$ 0,00" na
 * tela de quem não pode lê-la seria uma afirmação falsa sobre o contrato da
 * loja com a plataforma.
 */
test('a comissão é só do dono', async ({ page }) => {
  api.entrarComoPapel('manager');
  await entrar(page, '/desempenho');
  await page.goto('/desempenho');
  await escolherFilial(page, FAKE_BRANCH);

  const composicao = page.getByTestId('perf-composicao');
  await expect(composicao).toBeVisible();
  await expect(composicao).toContainText('Produtos');
  await expect(composicao).not.toContainText('Comissão da plataforma');
  // O cashback resgatado sai do MESMO extrato, então ele cai junto.
  await expect(composicao).not.toContainText('Cashback resgatado');
});

test('o dono lê o faturamento da rede inteira, sem escolher filial', async ({ page }) => {
  api.entrarComoPapel('owner');
  await entrar(page, '/desempenho');
  await page.goto('/desempenho');

  await expect(page.getByTestId('perf-escolha-filial')).toHaveCount(0);
  await expect(page.getByTestId('perf-escopo')).toContainText('todas as filiais');
  await expect(page.getByTestId('perf-composicao')).toContainText('Comissão da plataforma');
});

/* ==========================================================================
 * O DONO — o recorte não pode esconder nada dele
 * ======================================================================= */

/*
 * O TESTE QUE PROTEGE CONTRA O ERRO OPOSTO. Esconder demais não gera chamado —
 * gera desuso, e ninguém descobre. Este é o teste que fica vermelho se um
 * `pode(...)` for escrito com a ação errada.
 */
test('o dono continua vendo tudo', async ({ page }) => {
  api.entrarComoPapel('owner');
  await entrar(page);

  await expect(page.getByRole('link', { name: 'Clientes' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Desempenho' })).toBeVisible();
  await page.getByTestId('order-card-1003').click();
  await expect(page.getByTestId('change-status-cancelled')).toBeVisible();

  await page.goto('/cardapio');
  await expect(page.getByRole('button', { name: 'Novo item' })).toBeVisible();
  await expect(page.getByTestId('category-actions-open')).toBeVisible();

  await page.goto('/loja/operacao');
  await expect(page.getByTestId('store-anchor-geral')).toBeVisible();
  await expect(page.getByTestId('store-anchor-valores')).toBeVisible();
  await expect(page.getByTestId('store-anchor-marca')).toBeVisible();
});

/* ==========================================================================
 * A NAVEGAÇÃO ENCOLHE SEM SE DESMANCHAR
 * ======================================================================= */

test('o atendente vê dois blocos inteiros, e nenhum grupo com um item só', async ({ page }) => {
  api.entrarComoPapel('attendant');
  await entrar(page);

  /*
   * "Vender mais" e "Acompanhar" somem INTEIROS — as cinco telas deles são
   * GERENCIA. O que sobra é o turno e a loja, e é a forma que a lateral tem de
   * ser para quem está no balcão.
   */
  await expect(page.getByRole('list', { name: 'Hoje' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Configuração e conta' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Vender mais' })).toHaveCount(0);
  await expect(page.getByRole('list', { name: 'Acompanhar' })).toHaveCount(0);

  /*
   * A INVARIANTE, medida na tela e não só em `nav.test.ts`: nenhum grupo COM
   * RÓTULO PINTADO encolhe para um item. O que um grupo de um custa é a linha
   * de texto acima dele, dizendo o que o próprio item já diz.
   */
  /*
   * QUATRO, E NÃO MAIS TRÊS: Entregadores entrou em "Hoje" com `acao` de
   * LEITURA (`GET /admin/couriers`, PESSOAS), e o atendente é justamente quem
   * mais precisa dela — é ele que está no balcão quando o motoboy chega. As
   * escritas do cadastro são da gerência e somem DENTRO da tela, não daqui.
   */
  await expect(page.getByRole('list', { name: 'Hoje' }).getByRole('listitem')).toHaveCount(4);
  /*
   * O PÉ DELE FICOU COM UM ITEM SÓ em 05/09/2026, por duas mudanças que se
   * somaram: o WhatsApp ganhou tela e com ela a `acao` de leitura (GERENCIA —
   * enquanto era "em breve" ele não tinha `acao`, e item sem ação é item de
   * todo mundo), e Integrações saiu do menu inteiro.
   *
   * NÃO É O DEFEITO QUE A INVARIANTE PERSEGUE, e é por isso que ele é medido
   * aqui em vez de consertado: o pé NÃO pinta rótulo (`AppShell`), então o que
   * o atendente vê é "Loja" solta abaixo de um fio — um link, não uma seção de
   * um item. Inventar um item para lhe fazer companhia seria pôr na lateral
   * uma tela que não existe.
   */
  await expect(
    page.getByRole('list', { name: 'Configuração e conta' }).getByRole('listitem'),
  ).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'Loja' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Usuários' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'WhatsApp' })).toHaveCount(0);
});

test('no telefone, "Todas as seções" mostra TODAS — e nenhuma que dê 403', async ({ page }) => {
  api.entrarComoPapel('attendant');
  await entrar(page);
  await page.setViewportSize({ width: 390, height: 844 });

  await page.getByTestId('bottom-mais').click();
  const folha = page.getByTestId('sheet-mais');
  await expect(folha).toBeVisible();

  /*
   * AS TRÊS DA BARRA SE REPETEM AQUI, de propósito: a folha se chama "Todas as
   * seções" e é o MESMO mapa da lateral. Tirando-as, "Hoje" ficaria com um item
   * só — o defeito que esta rodada desmanchou do outro lado.
   */
  await expect(folha.getByRole('link', { name: 'Pedidos' })).toBeVisible();
  await expect(folha.getByRole('link', { name: 'Cardápio' })).toBeVisible();
  await expect(folha.getByRole('link', { name: 'Loja' })).toBeVisible();

  // E o recorte por papel vale aqui igual: nada que responda 403.
  await expect(folha.getByRole('link', { name: 'Clientes' })).toHaveCount(0);
  await expect(folha.getByRole('link', { name: 'Cupons' })).toHaveCount(0);
  await expect(folha.getByRole('link', { name: 'Usuários' })).toHaveCount(0);
  await expect(folha.getByRole('link', { name: 'WhatsApp' })).toHaveCount(0);
});
