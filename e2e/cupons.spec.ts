/**
 * E2E DOS CUPONS — as cinco coisas que a tela não pode errar.
 *
 * Não é varredura de campo: cada teste aqui guarda uma armadilha que compila,
 * responde 200 e custa dinheiro ou trava o lojista.
 *
 *   1. O DESCONTO SAI DA ARTE. O backend confere o tipo e NÃO confere o valor —
 *      um corpo com a arte de 10% e `discount_value: 7` grava, anuncia 10% na
 *      vitrine e desconta 7% no checkout. Só o CORPO prova isso.
 *   2. A arte já usada não aparece: `UNIQUE (restaurant_id, coupon_template_id)`
 *      dá 409, e o 409 manda mexer na arte, não no código.
 *   3. Os dois 409 apontam campos DIFERENTES.
 *   4. A campanha de arte desativada não oferece "Desligar" — o backend
 *      responderia 400 até para isso.
 *   5. Ler é da gerência, escrever é só do dono.
 *   6. QUEM VÊ NÃO É A SITUAÇÃO. Um cupom privado e ativo está no ar; ele só
 *      não aparece na lista do app. Enquanto existia `is_public`, a tela
 *      chamava isso de "Desligado" — e chamava com razão, porque o backend de
 *      então recusava o cupom por caminho nenhum.
 *   7. CÓDIGO VAZIO É UMA ESCOLHA, e a mais silenciosa da tela: o cupom passa a
 *      aplicar sozinho em todo pedido que couber. Só o CORPO prova que o vazio
 *      subiu como nulo, e não como string em branco.
 */
import { expect, test, type Page } from '@playwright/test';

import { installFakeApi, LOGIN_EMAIL, LOGIN_PASSWORD, type FakeApi } from './fake-api';
import { escolher } from './seletor';

let api: FakeApi;

test.beforeEach(async ({ page }) => {
  api = await installFakeApi(page);
});

test.afterEach(() => {
  api.stop();
});

async function entrar(page: Page) {
  await page.goto('/cupons');
  await page.getByLabel('E-mail').fill(LOGIN_EMAIL);
  await page.getByLabel('Senha').fill(LOGIN_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: 'Cupons' })).toBeVisible();
}

/* ==========================================================================
 * 1. A TRAVA DA ARTE — a razão de a tela existir
 * ======================================================================= */

test('o valor do desconto sai da arte escolhida, e não de campo nenhum', async ({ page }) => {
  await entrar(page);
  await page.getByTestId('cupons-nova').click();

  /* Não existe campo de desconto: se existisse, existiria o caminho de
     escolher a arte de 15% e digitar outro número. */
  await expect(page.getByLabel(/valor do desconto/i)).toHaveCount(0);

  await page.getByRole('radio', { name: /15% OFF/ }).check();
  await page.getByLabel('Nome', { exact: false }).first().fill('Quinze');
  await page.getByLabel('Código', { exact: true }).fill('quinze');
  await page.getByRole('button', { name: 'Criar campanha' }).click();

  await expect(page.getByTestId('cupom-editar-QUINZE')).toBeVisible();

  const corpo = api.couponBodies().at(-1);
  expect(corpo?.metodo).toBe('POST');
  expect(corpo?.body).toMatchObject({
    coupon_template_id: 'tpl-percent-15',
    discount_type: 'percent',
    discount_value: '15.00',
    /* Maiúsculas: PROMO10 e promo10 colidem no mesmo índice do banco. */
    code: 'QUINZE',
  });
});

test('a validade sobe como instante do fuso da operação, com o último dia inteiro', async ({
  page,
}) => {
  await entrar(page);
  await page.getByTestId('cupons-nova').click();

  await page.getByRole('radio', { name: /15% OFF/ }).check();
  await page.getByLabel('Nome', { exact: false }).first().fill('Setembro');
  await page.getByLabel('Código', { exact: true }).fill('SET');
  await page.getByLabel('Começa em').fill('2026-09-01');
  await page.getByLabel('Termina em').fill('2026-09-30');
  await page.getByRole('button', { name: 'Criar campanha' }).click();

  const corpo = api.couponBodies().at(-1);
  /*
   * 23:59:59, e não 00:00:00. `valid_until` é comparado com `>` no backend:
   * meia-noite mataria o cupom "até 30/09" no instante em que o dia 30 abre —
   * o lojista anuncia o mês e perde o último dia.
   */
  expect(corpo?.body).toMatchObject({
    valid_from: '2026-09-01T00:00:00-03:00',
    valid_until: '2026-09-30T23:59:59-03:00',
  });
});

test('o teto de desconto só existe em percentual, e sai do corpo ao trocar de arte', async ({
  page,
}) => {
  await entrar(page);
  await page.getByTestId('cupons-nova').click();

  await page.getByRole('radio', { name: /15% OFF/ }).check();
  await page.getByLabel('Desconto máximo').fill('15,00');

  /* Trocar para uma arte de valor fixo esconde o campo E limpa o valor: mandar
     `max_discount_amount` fora de percentual é 422 sobre um campo invisível. */
  await page.getByRole('radio', { name: /R\$ 3 OFF/ }).check();
  await expect(page.getByLabel('Desconto máximo')).toHaveCount(0);

  await page.getByLabel('Nome', { exact: false }).first().fill('Cinco reais bis');
  await page.getByLabel('Código', { exact: true }).fill('CINCOBIS');
  await page.getByRole('button', { name: 'Criar campanha' }).click();

  expect(api.couponBodies().at(-1)?.body).toMatchObject({
    discount_type: 'fixed',
    max_discount_amount: null,
  });
});

/* ==========================================================================
 * 2. A FRASE-RESUMO
 * ======================================================================= */

test('a frase-resumo diz as três coisas que o lojista descobriria depois', async ({ page }) => {
  await entrar(page);
  await page.getByTestId('cupom-editar-SETEMBRO').click();

  const resumo = page.getByText('O que este cupom faz').locator('..');

  /* min_order_value compara com o SUBTOTAL: a taxa de entrega não ajuda. */
  await expect(resumo).toContainText('em produtos');
  /* free_delivery na retirada desconta R$ 0,00 — é aceito e não vale nada. */
  await expect(resumo).toContainText('só em entrega');
  await expect(resumo).toContainText('retirada');
  /* first_order_only é por LOJA, não pela plataforma. */
  await expect(resumo).toContainText('nunca pediu aqui');
  await expect(resumo).not.toContainText('novos clientes');
});

/* ==========================================================================
 * 3. AS RECUSAS, CADA UMA NO SEU CAMPO
 * ======================================================================= */

test('a arte já usada por outra campanha não aparece no seletor', async ({ page }) => {
  await entrar(page);
  await page.getByTestId('cupons-nova').click();

  /* `tpl-free` é da campanha SETEMBRO. Oferecê-la seria oferecer um 409. */
  await expect(page.getByRole('radio', { name: /Frete grátis/ })).toHaveCount(0);
  await expect(page.getByRole('radio', { name: /15% OFF/ })).toBeVisible();
});

test('na edição a arte da própria campanha continua visível', async ({ page }) => {
  await entrar(page);
  await page.getByTestId('cupom-editar-SETEMBRO').click();

  /* Sem a exceção, o campo abriria vazio e corrigir uma data exigiria
     reescolher a arte. */
  await expect(page.getByRole('radio', { name: /Frete grátis/ })).toBeChecked();
});

test('o 409 de código repetido destaca o código, mesmo em outra caixa', async ({ page }) => {
  await entrar(page);
  await page.getByTestId('cupons-nova').click();

  await page.getByRole('radio', { name: /15% OFF/ }).check();
  await page.getByLabel('Nome', { exact: false }).first().fill('Repetido');
  /* SETEMBRO já existe. Em minúsculas ele colide igual: `lower(trim(code))`. */
  await page.getByLabel('Código', { exact: true }).fill('setembro');
  await page.getByRole('button', { name: 'Criar campanha' }).click();

  await expect(page.getByText(/já existe um cupom com este código/i)).toBeVisible();
  await expect(page.getByText(/PROMO10 e promo10 contam como o mesmo/i)).toBeVisible();
});

/* ==========================================================================
 * 4. A ARTE QUE SAIU DO CATÁLOGO
 * ======================================================================= */

test('a campanha de arte desativada avisa e não oferece "Desligar"', async ({ page }) => {
  await entrar(page);

  await expect(page.getByTestId('cupons-fora-do-ar')).toBeVisible();
  await expect(page.getByText('Arte fora do ar')).toBeVisible();

  /*
   * O botão sumiu porque o backend responderia 400 até a um
   * `{ is_active: false }`: `update_admin` valida a arte sobre o RESULTADO da
   * mescla, e ela continua sendo a que saiu do catálogo. Um botão ali
   * prometeria uma ação que não acontece.
   */
  await expect(page.getByTestId('cupom-alternar-ANTIGA')).toHaveCount(0);
  await expect(page.getByTestId('cupom-alternar-SETEMBRO')).toBeVisible();

  /* O caminho é o diálogo, onde a arte nova viaja na mesma chamada. */
  await page.getByTestId('cupom-editar-ANTIGA').click();
  await expect(page.getByText(/inclusive para desligar o cupom/i)).toBeVisible();
});

test('desligar manda um corpo de um campo só', async ({ page }) => {
  await entrar(page);
  await page.getByTestId('cupom-alternar-SETEMBRO').click();

  await expect(page.getByTestId('cupom-alternar-SETEMBRO')).toHaveText('Religar');

  const corpo = api.couponBodies().at(-1);
  expect(corpo?.metodo).toBe('PATCH');
  /*
   * UM CAMPO, e não a campanha inteira. O backend revalida a mescla de
   * qualquer jeito, então o corpo completo não compraria validação nenhuma — o
   * que ele compraria era reenviar onze campos velhos por cima do que outra
   * aba acabou de gravar.
   */
  expect(corpo?.body).toEqual({ is_active: false });
});

/* ==========================================================================
 * 4bis. QUEM VÊ O CUPOM, E COMO O CLIENTE CHEGA
 * ======================================================================= */

test('o cupom público sem código sobe com code null — é o que aplica sozinho', async ({ page }) => {
  await entrar(page);
  await page.getByTestId('cupons-nova').click();

  await page.getByRole('radio', { name: /15% OFF/ }).check();
  await page.getByLabel('Nome', { exact: false }).first().fill('Automático');

  /* O campo de código fica VAZIO de propósito, e a ajuda embaixo dele diz o que
     isso faz — antes de o lojista salvar, não depois do primeiro extrato. */
  await expect(page.getByText(/APLICA SOZINHO no fechamento do pedido/i)).toBeVisible();

  /* A frase-resumo repete a decisão por extenso: um campo em branco não parece
     uma escolha. */
  const resumo = page.getByText('O que este cupom faz').locator('..');
  await expect(resumo).toContainText('aplicado sozinho no fechamento do pedido');
  await expect(resumo).toContainText('maior desconto');

  await page.getByRole('button', { name: 'Criar campanha' }).click();

  const corpo = api.couponBodies().at(-1);
  expect(corpo?.metodo).toBe('POST');
  /*
   * `null`, e nunca uma string em branco. `auto_apply_for_order` procura
   * `code IS NULL`; o branco não é nem código nem automático, e o backend o
   * recusa de propósito ("code não pode ser só espaços; omita o campo").
   */
  expect(corpo?.body).toMatchObject({ code: null, visibility: 'public', target_segment: null });

  /* E a lista DIZ o que o nulo significa, em vez de deixar a célula vazia. */
  await expect(page.getByRole('row').filter({ hasText: 'Automático' })).toContainText(
    'aplica sozinho',
  );
});

test('o cupom por segmento só pede a classe quando é por segmento', async ({ page }) => {
  await entrar(page);
  await page.getByTestId('cupons-nova').click();

  /* Em "Público" o seletor de classe não existe: alvo preenchido fora de
     segmento é 422, e o CHECK do banco vale nos dois sentidos. */
  await expect(page.getByTestId('cupom-segmento')).toHaveCount(0);

  await page.getByRole('radio', { name: 'Por segmento' }).check();
  await expect(page.getByTestId('cupom-segmento')).toBeVisible();

  await page.getByRole('radio', { name: /15% OFF/ }).check();
  await page.getByLabel('Nome', { exact: false }).first().fill('Volta para os sumidos');
  await page.getByLabel('Código', { exact: true }).fill('VOLTEI');
  await escolher(page.getByTestId('cupom-segmento'), 'Perdido');

  /* A frase nomeia a CLASSE, e avisa que ela se recalcula sozinha. */
  const resumo = page.getByText('O que este cupom faz').locator('..');
  await expect(resumo).toContainText('só para clientes na classe Perdido');

  await page.getByRole('button', { name: 'Criar campanha' }).click();

  expect(api.couponBodies().at(-1)?.body).toMatchObject({
    visibility: 'segment',
    target_segment: 'perdido',
    code: 'VOLTEI',
  });
});

test('voltar para público zera a classe, em vez de mandá-la e tomar 422', async ({ page }) => {
  await entrar(page);
  await page.getByTestId('cupons-nova').click();

  await page.getByRole('radio', { name: 'Por segmento' }).check();
  await escolher(page.getByTestId('cupom-segmento'), 'Fiel');
  await page.getByRole('radio', { name: 'Público' }).check();

  await expect(page.getByTestId('cupom-segmento')).toHaveCount(0);

  await page.getByRole('radio', { name: /15% OFF/ }).check();
  await page.getByLabel('Nome', { exact: false }).first().fill('Público de novo');
  await page.getByLabel('Código', { exact: true }).fill('PUB15');
  await page.getByRole('button', { name: 'Criar campanha' }).click();

  expect(api.couponBodies().at(-1)?.body).toMatchObject({
    visibility: 'public',
    target_segment: null,
  });
});

/*
 * A ÚNICA REGRA DA TELA SEM PAR NO BACKEND, e é por isso que ela precisa
 * existir aqui: privado sem código GRAVA, responde 201 e some. O resgate
 * procura a campanha pelo CÓDIGO, e `_can_see` só libera um cupom privado que
 * tenha resgate gravado — sem código não há como resgatar, e o automático não
 * salva porque passa pelo mesmo `evaluate`.
 */
test('privado sem código é barrado antes de virar uma campanha invisível', async ({ page }) => {
  await entrar(page);
  await page.getByTestId('cupons-nova').click();

  await page.getByRole('radio', { name: /15% OFF/ }).check();
  await page.getByRole('radio', { name: 'Privado' }).check();
  await page.getByLabel('Nome', { exact: false }).first().fill('Invisível');
  await page.getByRole('button', { name: 'Criar campanha' }).click();

  await expect(page.getByText(/Cupom privado precisa de código/i)).toBeVisible();
  /* Nada foi mandado: a recusa é da tela, antes da rede. */
  expect(api.couponBodies()).toHaveLength(0);

  await page.getByLabel('Código', { exact: true }).fill('SECRETO');
  await page.getByRole('button', { name: 'Criar campanha' }).click();

  expect(api.couponBodies().at(-1)?.body).toMatchObject({
    visibility: 'private',
    code: 'SECRETO',
  });
});

test('editar uma campanha troca a visibilidade sem mexer no resto', async ({ page }) => {
  await entrar(page);
  await page.getByTestId('cupom-editar-SETEMBRO').click();

  /* A edição abre com a visibilidade GRAVADA marcada — não com o default. */
  await expect(page.getByRole('radio', { name: 'Público' })).toBeChecked();

  await page.getByRole('radio', { name: 'Privado' }).check();
  await page.getByRole('button', { name: 'Salvar' }).click();

  const corpo = api.couponBodies().at(-1);
  expect(corpo?.metodo).toBe('PATCH');
  expect(corpo?.body).toMatchObject({
    visibility: 'private',
    target_segment: null,
    /* O corpo vai COMPLETO no PATCH: `update_admin` revalida a mescla inteira. */
    code: 'SETEMBRO',
    title: 'Setembro sem frete',
  });

  await expect(page.getByRole('row').filter({ hasText: 'SETEMBRO' })).toContainText('Privado');
});

test('a coluna "Quem vê" separa as três, e a situação continua sendo outra coisa', async ({
  page,
}) => {
  await entrar(page);

  const linha = (codigo: string) => page.getByRole('row').filter({ hasText: codigo });

  await expect(linha('SETEMBRO')).toContainText('Público');
  /* A campanha por segmento mostra a CLASSE, e não "Por segmento": duas
     segmentadas lado a lado precisam se distinguir de relance. */
  await expect(linha('VOLTA20')).toContainText('Em risco');

  /*
   * NATAL10 É PRIVADO E PROGRAMADO — os dois eixos na mesma linha, e é aqui que
   * a virada de `is_public` se prova: privado não é uma forma de estar
   * desligado. Com o booleano de antes, esta linha leria "Desligado".
   */
  await expect(linha('NATAL10')).toContainText('Privado');
  await expect(linha('NATAL10')).toContainText('Programado');
  await expect(linha('NATAL10')).not.toContainText('Desligado');
});

/* ==========================================================================
 * 5. AS CINCO SITUAÇÕES E O FILTRO DE TELA
 * ======================================================================= */

test('as cinco situações aparecem, cada uma na campanha certa', async ({ page }) => {
  await entrar(page);

  const linha = (codigo: string) => page.getByRole('row').filter({ hasText: codigo });

  await expect(linha('SETEMBRO')).toContainText('Ativo');
  await expect(linha('NATAL10')).toContainText('Programado');
  await expect(linha('VOLTA20')).toContainText('Expirado');
  await expect(linha('CINCO')).toContainText('Esgotado');
  await expect(linha('PRIMEIRA')).toContainText('Desligado');
});

test('o par de uso pareia contagem e limite', async ({ page }) => {
  await entrar(page);
  await expect(page.getByRole('row').filter({ hasText: 'SETEMBRO' })).toContainText('37 de 100');
});

test('o filtro é de tela: ele esconde, e a contagem diz de quantos', async ({ page }) => {
  await entrar(page);
  await expect(page.getByTestId('cupons-contagem')).toHaveText('6 campanhas');

  await escolher(page.getByTestId('cupons-filtro-situacao'), 'Expirado');

  await expect(page.getByTestId('cupons-contagem')).toHaveText('1 de 6');
  await expect(page.getByTestId('cupom-editar-VOLTA20')).toBeVisible();
  await expect(page.getByTestId('cupom-editar-SETEMBRO')).toHaveCount(0);
});

test('o vazio do filtro não manda criar campanha que já existe', async ({ page }) => {
  await entrar(page);
  await escolher(page.getByTestId('cupons-filtro-tipo'), 'Frete grátis');
  await escolher(page.getByTestId('cupons-filtro-situacao'), 'Expirado');

  await expect(page.getByTestId('cupons-vazio-filtro')).toBeVisible();
  await expect(page.getByTestId('cupons-vazio')).toHaveCount(0);
});

/* ==========================================================================
 * 6. O ESCOPO E O QUE A TELA NÃO PROMETE
 * ======================================================================= */

test('a tela diz que o cupom vale em todas as lojas', async ({ page }) => {
  await entrar(page);
  await expect(page.getByTestId('cupons-escopo')).toHaveText('vale em todas as lojas');

  await page.getByTestId('cupons-ajuda').click();
  await expect(page.getByText(/não tem filial/i)).toBeVisible();
  await expect(page.getByText(/Os dois filtros acima são desta tela/i)).toBeVisible();
  await expect(page.getByText(/Cupom não se apaga, se desliga/i)).toBeVisible();
});

test('não há como segmentar por horário, dia ou produto — nem campo, nem promessa', async ({
  page,
}) => {
  await entrar(page);
  await page.getByTestId('cupons-nova').click();

  /*
   * A busca é DENTRO do diálogo. Na página inteira, `/filial/i` acha o seletor
   * de filial do cabeçalho do shell — que existe, e não tem nada a ver com o
   * cupom: é justamente por ele não recortar esta tela que a ressalva "vale em
   * todas as lojas" está lá em cima.
   */
  const dialogo = page.getByRole('dialog');
  for (const rotulo of [/dia da semana/i, /horário/i, /forma de pagamento/i, /filial/i]) {
    await expect(dialogo.getByLabel(rotulo)).toHaveCount(0);
  }

  /* O ÚNICO recorte de público que existe é a classe RFV do cliente, e ele fica
     atrás de "Por segmento" — não é um campo solto no formulário. */
  await expect(dialogo.getByRole('radio', { name: 'Por segmento' })).toBeVisible();
});

/* ==========================================================================
 * 7. O PAPEL
 * ======================================================================= */

test('o gerente lê a lista e não vê nenhum botão de escrita', async ({ page }) => {
  api.entrarComoPapel('manager');
  await entrar(page);

  /* `GET /admin/coupons` é GERENCIA: ele precisa saber qual campanha está no ar
     para responder ao cliente que ligou. */
  await expect(page.getByRole('row').filter({ hasText: 'SETEMBRO' })).toBeVisible();

  /* Escrever é SOMENTE_DONO. Some, não desabilita. */
  await expect(page.getByTestId('cupons-nova')).toHaveCount(0);
  await expect(page.getByTestId('cupom-editar-SETEMBRO')).toHaveCount(0);
  await expect(page.getByTestId('cupom-alternar-SETEMBRO')).toHaveCount(0);
});

test('o atendente não chega à tela nem pelo endereço', async ({ page }) => {
  api.entrarComoPapel('attendant');
  await page.goto('/cupons');
  await page.getByLabel('E-mail').fill(LOGIN_EMAIL);
  await page.getByLabel('Senha').fill(LOGIN_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page.getByRole('heading', { name: 'Cupons' })).toHaveCount(0);
});
