/**
 * E2E de Loja.
 *
 * Os testes daqui cobrem as quatro formas de esta tela dar prejuízo em
 * silêncio: fechar a semana sem querer no PUT de horários, deixar a entrega
 * sem estimativa e não avisar, expor um campo que não afeta cobrança nenhuma, e
 * editar "todas as filiais" como se fosse uma.
 */
import { expect, test, type Page } from '@playwright/test';

import { branchName } from '../src/layout/branch-heading';
import {
  installFakeApi,
  FAKE_BRANCH,
  FAKE_BRANCH_2,
  LOGIN_EMAIL,
  LOGIN_PASSWORD,
  type FakeApi,
} from './fake-api';
import { escolher, escolherFilial as escolherFilialNoTopo } from './seletor';

let api: FakeApi;

test.beforeEach(async ({ page }) => {
  api = await installFakeApi(page);
});

test.afterEach(() => {
  api.stop();
});

async function abrirLoja(page: Page) {
  await page.goto('/loja');
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel('E-mail').fill(LOGIN_EMAIL);
  await page.getByLabel('Senha').fill(LOGIN_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();

  await page.getByRole('link', { name: 'Loja' }).click();
  // /loja é o nome do GRUPO de rotas, não uma tela: ela redireciona para
  // a primeira seção, que é o estado do dia.
  await expect(page).toHaveURL(/\/loja\/operacao$/);
}

/** As outras seções saem da navegação da esquerda, como o lojista faz. */
async function abrirSecao(page: Page, id: string) {
  await page.getByTestId(`store-anchor-${id}`).click();
  await expect(page).toHaveURL(new RegExp(`/loja/${id}$`));
}

/**
 * A tela abre com "todas as filiais"; as seções de filial precisam de uma.
 *
 * A escolha passou a sair do seletor do CABEÇALHO, e não do botão dentro da
 * página: com uma seção por rota, o botão só existe na página de filial que
 * estiver aberta — e o cabeçalho funciona de qualquer uma delas, que é como o
 * lojista faz.
 */
async function escolherFilial(page: Page) {
  await escolherFilialNoTopo(page);
}

test('Operação mostra uma linha por filial e fecha só a que foi clicada', async ({ page }) => {
  await abrirLoja(page);

  /*
   * AS DUAS LOJAS NA MESMA TELA. É a conferência que não existia enquanto o
   * `is_open` era do restaurante: com um valor só, não havia o que comparar.
   */
  const aldeota = page.getByTestId(`operation-row-${FAKE_BRANCH.id}`);
  const zonaNorte = page.getByTestId(`operation-row-${FAKE_BRANCH_2.id}`);
  await expect(aldeota).toHaveAttribute('data-open', 'true');
  await expect(zonaNorte).toHaveAttribute('data-open', 'true');

  await aldeota.getByRole('switch', { name: `Aberta: ${FAKE_BRANCH.display_name}` }).click();

  await expect(aldeota).toHaveAttribute('data-open', 'false');
  // A OUTRA NÃO SE MEXE — na tela e no "banco". Enquanto o campo era do
  // restaurante, fechar a Aldeota fechava a Zona Norte junto.
  await expect(zonaNorte).toHaveAttribute('data-open', 'true');
  expect(api.operation(FAKE_BRANCH.id)?.is_open).toBe(false);
  expect(api.operation(FAKE_BRANCH_2.id)?.is_open).toBe(true);
});

/*
 * A chave e a agenda são duas coisas, e é o chamado mais comum do suporte:
 * "não está entrando pedido" com a loja marcada como aberta. A linha só fala
 * nesse caso — escrever "aberta" em toda linha aberta seria a palavra que se
 * repete sem distinguir nada.
 */
test('aberta fora do horário de hoje, a linha diz isso em vez de prometer pedido', async ({
  page,
}) => {
  api.putOutsideHours(FAKE_BRANCH.id);
  await abrirLoja(page);

  const aldeota = page.getByTestId(`operation-row-${FAKE_BRANCH.id}`);
  await expect(aldeota).toHaveAttribute('data-open', 'true');
  await expect(aldeota).toHaveAttribute('data-open-now', 'false');
  await expect(aldeota).toContainText('Fora do horário de hoje');

  // A loja que está mesmo no ar não escreve nada: o ponto e a chave já dizem.
  await expect(page.getByTestId(`operation-row-${FAKE_BRANCH_2.id}`)).not.toContainText(
    'Fora do horário',
  );
});

/*
 * O ESTADO SEM SAÍDA VISUAL.
 *
 * Desligar entrega e retirada equivale a fechar a loja — mas não FICA igual a
 * fechar: a chave continua ligada, e sem isto a linha diria "aberta", com o
 * ponto aceso, enquanto ninguém consegue comprar. O segundo desligamento não é
 * bloqueado: tirar a liberdade do lojista não é o conserto. O conserto é o
 * ponto apagar e a linha ler o estado de verdade.
 */
test('sem entrega e sem retirada, a linha para de dizer que está no ar', async ({ page }) => {
  await abrirLoja(page);

  const aldeota = page.getByTestId(`operation-row-${FAKE_BRANCH.id}`);
  await expect(aldeota).toHaveAttribute('data-no-ar', 'true');

  await page.getByTestId(`operation-accepts_delivery-${FAKE_BRANCH.id}`).click();
  // Uma forma de comprar basta: só com a retirada de pé, a loja continua no ar.
  await expect(aldeota).toHaveAttribute('data-no-ar', 'true');
  await expect(aldeota).not.toContainText('Ninguém consegue comprar');

  await page.getByTestId(`operation-accepts_pickup-${FAKE_BRANCH.id}`).click();

  await expect(aldeota).toHaveAttribute('data-no-ar', 'false');
  await expect(aldeota).toContainText('Ninguém consegue comprar');
  // A CHAVE CONTINUA LIGADA: o backend permite, e a tela não mente sobre isso.
  await expect(aldeota).toHaveAttribute('data-open', 'true');
  expect(api.operation(FAKE_BRANCH.id)?.is_open).toBe(true);

  // E a outra filial não se mexeu.
  await expect(page.getByTestId(`operation-row-${FAKE_BRANCH_2.id}`)).toHaveAttribute(
    'data-no-ar',
    'true',
  );
});

/*
 * Corpo vazio é 422 no backend, e mandar os dois campos reenviaria por cima do
 * que outra aba acabou de gravar. Cada clique manda UM campo.
 */
test('cada clique em entrega ou retirada manda só o campo que mudou', async ({ page }) => {
  await abrirLoja(page);

  await page.getByTestId(`operation-accepts_pickup-${FAKE_BRANCH.id}`).click();

  // Só a retirada mudou no "banco"; a entrega ficou como estava.
  await expect
    .poll(() => api.orderTypeCalls())
    .toEqual([{ branchId: FAKE_BRANCH.id, body: { accepts_pickup: false } }]);
  expect(api.operation(FAKE_BRANCH.id)?.accepts_delivery).toBe(true);
});

/*
 * O interruptor do cabeçalho continua sendo o gesto rápido de dentro das outras
 * seções — mas ele não aparece em Operação, onde a mesma filial já tem a
 * própria chave na lista. Dois interruptores para uma loja na mesma tela é a
 * informação repetida que a §8 do design proíbe.
 */
test('o interruptor do cabeçalho vale nas outras seções, e some em Operação', async ({ page }) => {
  await abrirLoja(page);
  await expect(page.getByTestId('store-status')).toHaveCount(0);

  await abrirSecao(page, 'horarios');
  const status = page.getByTestId('store-status');
  await expect(status).toHaveAttribute('data-open', 'true');

  await page.getByRole('switch', { name: 'Fechar a loja' }).click();
  await expect(status).toHaveAttribute('data-open', 'false');
  await expect(status).toContainText('Ninguém consegue fazer pedido');

  // Ele opera a filial que o cabeçalho está exibindo, e só ela.
  expect(api.operation(FAKE_BRANCH.id)?.is_open).toBe(false);
  expect(api.operation(FAKE_BRANCH_2.id)?.is_open).toBe(true);
});

/*
 * O DEFEITO QUE ESTE TESTE GUARDA, e é o que faz a taxa mudar sozinha.
 *
 * Toda filial nasce herdando, então a tela abre com os quatro campos VAZIOS. Um
 * formulário que serializa vazio como `null` devolveria a filial ao padrão do
 * restaurante a cada salvamento — o lojista corrige o prazo, salva, e a taxa de
 * serviço da loja volta para a da rede sem ninguém ter pedido. O sintoma
 * aparece semanas depois, com o cliente pagando outro número.
 */
test('salvar um campo não devolve os outros ao padrão do restaurante', async ({ page }) => {
  await abrirLoja(page);
  await abrirSecao(page, 'valores');

  // Herdando: campo vazio, e a ajuda diz o padrão por extenso — nunca zero.
  const minimo = page.getByTestId('branch-min-order');
  await expect(minimo).toHaveValue('');
  await expect(page.getByText('Herdando o padrão do restaurante: R$ 20,00')).toBeVisible();

  await minimo.fill('45,00');
  await page.getByTestId('store-save').click();
  await expect(page.getByTestId('store-saved')).toBeVisible();

  // SÓ o campo mexido foi no corpo. Nenhum `null` — os outros continuam herdando.
  expect(api.branchSettingsCalls()).toEqual([
    { branchId: FAKE_BRANCH.id, body: { min_order_value: 45 } },
  ]);
  expect(api.overridesOf(FAKE_BRANCH.id)).toEqual({ min_order_value: 45 });
});

/*
 * O `null` explícito é o único jeito de desfazer uma divergência. Ele sai
 * quando o lojista APAGA um campo que tinha valor — e só então.
 */
test('apagar uma sobrescrita devolve a filial ao padrão, e a tela diz de novo qual é', async ({
  page,
}) => {
  await abrirLoja(page);
  await abrirSecao(page, 'valores');

  await page.getByTestId('branch-min-order').fill('45,00');
  await page.getByTestId('store-save').click();
  await expect(page.getByTestId('store-saved')).toBeVisible();

  // Com valor próprio, a etiqueta aparece e a ajuda passa a dizer o que volta.
  await expect(page.getByTestId('tag-proprio').first()).toBeVisible();
  await expect(page.getByText('Padrão do restaurante: R$ 20,00')).toBeVisible();

  await page.getByTestId('branch-min-order').fill('');
  await page.getByTestId('store-save').click();

  await expect
    .poll(() => api.branchSettingsCalls().at(-1))
    .toEqual({ branchId: FAKE_BRANCH.id, body: { min_order_value: null } });
  expect(api.overridesOf(FAKE_BRANCH.id)).toEqual({});
  await expect(page.getByText('Herdando o padrão do restaurante: R$ 20,00')).toBeVisible();
});

/*
 * "Não cobrar" é uma escolha desta loja; "herdar" segue o que a rede decidir
 * depois. Com uma caixa de marcar as duas ficariam indistinguíveis, e não
 * haveria como voltar atrás.
 */
test('a taxa de serviço da filial tem três estados, e desligar não é herdar', async ({ page }) => {
  await abrirLoja(page);
  await abrirSecao(page, 'valores');

  await expect(page.getByTestId('branch-service-fee-herda')).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  await page.getByTestId('branch-service-fee-nao-cobra').click();
  await page.getByTestId('store-save').click();
  await expect(page.getByTestId('store-saved')).toBeVisible();

  expect(api.overridesOf(FAKE_BRANCH.id)).toEqual({ service_fee_enabled: false });

  await page.getByTestId('branch-service-fee-herda').click();
  await page.getByTestId('store-save').click();

  await expect
    .poll(() => api.branchSettingsCalls().at(-1))
    .toEqual({ branchId: FAKE_BRANCH.id, body: { service_fee_enabled: null } });
});

test('Geral salva as configurações do restaurante e não expõe a taxa padrão', async ({ page }) => {
  await abrirLoja(page);
  await abrirSecao(page, 'geral');

  await expect(page.getByTestId('settings-min-order')).toHaveValue('20,00');

  /*
   * `default_delivery_fee` existe na API e vale 7,50 no falso. Ele NÃO pode
   * aparecer: é editável e não afeta a cobrança — quem mexesse nele acharia que
   * mudou o frete, e o app continuaria cobrando pelas regras por km da filial.
   */
  await expect(page.getByText('7,50')).toHaveCount(0);
  await expect(page.getByText(/taxa de entrega padrão/i)).toHaveCount(0);

  await page.getByTestId('settings-min-order').fill('35,00');
  await page.getByTestId('settings-eta-max').fill('45');
  await page.getByTestId('store-save').click();

  await expect(page.getByTestId('store-saved')).toBeVisible();

  const patch = api.settingsPatches().at(-1);
  expect(patch).toMatchObject({ min_order_value: 35, estimated_delivery_time_max: 45 });
  // O que a tela não mostra, ela também não manda.
  expect(patch).not.toHaveProperty('default_delivery_fee');
});

/*
 * O botão de salvar ficava no fim de um formulário que rola: quem editava um
 * campo do meio e trocava de aba perdia a alteração sem nunca ter visto que
 * havia algo pendente. A barra agora gruda no rodapé e aparece com a primeira
 * mudança — mas some quando não há o que salvar, senão vira faixa permanente
 * que o olho aprende a pular.
 */
test('a barra de salvar só existe quando há alteração pendente', async ({ page }) => {
  await abrirLoja(page);
  await abrirSecao(page, 'geral');

  const barra = page.getByTestId('store-save-bar');
  await expect(barra).toHaveCount(0);

  await page.getByTestId('settings-min-order').fill('35,00');
  await expect(barra).toBeVisible();
  await expect(page.getByTestId('store-save')).toBeVisible();

  // Descartar devolve a tela ao estado salvo e leva a barra junto.
  await page.getByRole('button', { name: 'Descartar alterações' }).click();
  await expect(page.getByTestId('settings-min-order')).toHaveValue('20,00');
  await expect(barra).toHaveCount(0);
  expect(api.settingsPatches()).toHaveLength(0);
});

test('faixa de tempo estimado pela metade é recusada antes de sair da tela', async ({ page }) => {
  await abrirLoja(page);
  await abrirSecao(page, 'geral');

  await page.getByTestId('settings-eta-max').fill('');
  await page.getByTestId('store-save').click();

  await expect(page.getByTestId('store-error')).toContainText('os dois lados da faixa');
  expect(api.settingsPatches()).toHaveLength(0);
});

/*
 * O DEFEITO QUE ESTE TESTE GUARDA.
 *
 * As quatro seções de filial respondiam com a MESMA parede — "Horários de
 * funcionamento é de uma filial só. Escolha uma: [Matriz] [Varjota]" —, texto
 * idêntico em quatro rotas. A skill de design proíbe a mesma caixa de aviso
 * repetida em seções de uma página (§8); repetida em rotas inteiras, ela deixa
 * de ler como regra do sistema e passa a ler como bug.
 *
 * Hoje a filial é RESOLVIDA na entrada (a principal, na falta de escolha) e o
 * que sobra é uma linha auxiliar dizendo de qual filial é o formulário.
 */
test('as seções de filial resolvem a filial em vez de pedir uma', async ({ page }) => {
  await abrirLoja(page);

  // Geral é do restaurante inteiro: a linha auxiliar dela diz outra coisa.
  await abrirSecao(page, 'geral');
  await expect(page.getByTestId('settings-min-order')).toBeVisible();
  await expect(page.getByTestId('store-branch-note')).toHaveText('vale para o restaurante inteiro');

  // Filial abre no FORMULÁRIO, já preenchido com a filial principal — sem
  // parede, sem botão de escolha, sem bloqueio.
  await page.getByTestId('store-anchor-filial').click();
  await expect(page.getByTestId('store-branch-required')).toHaveCount(0);
  await expect(page.getByTestId('branch-name')).toHaveValue(FAKE_BRANCH.name);

  // E o cabeçalho passa a exibir a filial resolvida, em vez de "Todas as
  // filiais (2)" em cima de um formulário que grava numa só.
  await expect(page.getByTestId('branch-selector')).toContainText(branchName(FAKE_BRANCH));

  // O mesmo em horários, entrega e pagamento: uma linha auxiliar, não um cartão.
  for (const secao of ['horarios', 'entrega', 'pagamento']) {
    await page.getByTestId(`store-anchor-${secao}`).click();
    await expect(page.getByTestId('store-branch-required')).toHaveCount(0);
    await expect(page.getByTestId('store-branch-note')).toHaveText(
      `vale só para a filial ${branchName(FAKE_BRANCH)}`,
    );
  }
});

test('Filial salva cadastro e avisa quando falta a coordenada', async ({ page }) => {
  await abrirLoja(page);
  await page.getByTestId('store-anchor-filial').click();
  await escolherFilial(page);

  // A filial do falso não tem lat/long: sem elas o frete sai do lugar errado.
  await expect(page.getByTestId('branch-missing-coords')).toBeVisible();

  await page.getByTestId('branch-phone').fill('8533334444');
  await page.getByTestId('branch-latitude').fill('-3.731862');
  await page.getByTestId('branch-longitude').fill('-38.526669');
  await page.getByTestId('store-save').click();

  await expect(page.getByTestId('branch-missing-coords')).toHaveCount(0);
  expect(api.branchPatches().at(-1)?.body).toMatchObject({
    phone: '8533334444',
    latitude: -3.731862,
    longitude: -38.526669,
  });
});

test('latitude fora da faixa do planeta não chega ao backend', async ({ page }) => {
  await abrirLoja(page);
  await page.getByTestId('store-anchor-filial').click();
  await escolherFilial(page);

  await page.getByTestId('branch-latitude').fill('100');
  await page.getByTestId('store-save').click();

  await expect(page.getByTestId('store-error')).toContainText('Latitude');
  expect(api.branchPatches()).toHaveLength(0);
});

test('Horários manda os sete dias, e não só os que foram mexidos', async ({ page }) => {
  await abrirLoja(page);
  await escolherFilial(page);
  await page.getByTestId('store-anchor-horarios').click();

  // Segunda a sexta abertas no falso; sábado e domingo nunca vieram.
  await expect(page.getByTestId('hours-opens-0')).toHaveValue('18:00');

  await page.getByTestId('hours-opens-0').fill('11:00');
  await page.getByTestId('store-save').click();
  await expect(page.getByTestId('store-saved')).toBeVisible();

  /*
   * A regra mais cara desta tela: o PUT substitui a semana inteira e dia
   * ausente vira dia fechado. Mandar só a segunda-feira que mudou fecharia os
   * outros seis dias sem nenhum aviso.
   */
  const enviado = api.hoursPuts().at(-1);
  expect(enviado?.periods).toHaveLength(7);
  expect(enviado?.periods.map((dia) => dia.weekday)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  expect(enviado?.periods[0]).toMatchObject({ is_closed: false, opens_at: '11:00:00' });
  // Sábado e domingo continuam fechados, mas vão EXPLÍCITOS no corpo.
  expect(enviado?.periods[5]).toMatchObject({ weekday: 5, is_closed: true });
  expect(enviado?.periods[6]).toMatchObject({ weekday: 6, is_closed: true });
});

test('dia aberto sem horário completo trava o salvamento', async ({ page }) => {
  await abrirLoja(page);
  await escolherFilial(page);
  await page.getByTestId('store-anchor-horarios').click();

  // Abre o sábado e não informa a hora.
  await page.getByRole('switch', { name: 'Sábado: abrir' }).click();
  await page.getByTestId('store-save').click();

  await expect(page.getByTestId('store-error')).toContainText('Sábado');
  expect(api.hoursPuts()).toHaveLength(0);
});

test('Entrega mostra base e por-km faltando como erro de configuração', async ({ page }) => {
  await abrirLoja(page);
  await page.getByTestId('store-anchor-entrega').click();
  await escolherFilial(page);

  /*
   * A filial do falso não tem taxa base nem valor por km. Isso não é campo
   * opcional vazio: sem eles a estimativa não roda, todo endereço volta como
   * não atendível e a loja fica aberta sem receber pedido de entrega nenhum.
   */
  const erro = page.getByTestId('delivery-config-error');
  await expect(erro).toContainText('Entrega mal configurada');
  await expect(erro).toContainText('não atendível');

  // E a prévia diz a mesma coisa em número.
  await expect(page.getByTestId('delivery-preview')).toContainText('Não atendido');

  await page.getByTestId('delivery-base-fee').fill('5,00');
  await page.getByTestId('delivery-per-km').fill('2,00');

  // Com os dois preenchidos o erro sai e a prévia passa a mostrar o frete.
  await expect(page.getByTestId('delivery-config-error')).toHaveCount(0);
  await expect(page.getByTestId('delivery-preview')).toContainText('R$ 11,00');

  await page.getByTestId('delivery-max-distance').fill('8');
  await page.getByTestId('store-save').click();

  expect(api.branchPatches().at(-1)?.body).toMatchObject({
    delivery_base_fee: 5,
    delivery_fee_per_km: 2,
    delivery_max_distance_km: 8,
  });
});

test('formas de pagamento: cria, desativa e exclui — sem trocar fluxo nem tipo', async ({
  page,
}) => {
  await abrirLoja(page);
  await escolherFilial(page);
  await page.getByTestId('store-anchor-pagamento').click();

  await expect(page.getByTestId('payment-method-pay-pix')).toContainText('Pix');
  await expect(page.getByTestId('payment-method-pay-dinheiro')).toContainText('Dinheiro');

  /*
   * Fluxo e tipo aparecem como TEXTO na linha existente, nunca como campo: o
   * contrato não aceita mudá-los, e trocar o fluxo mudaria no meio do
   * expediente como os próximos pedidos são cobrados.
   */
  const linhaPix = page.getByTestId('payment-method-pay-pix');
  await expect(linhaPix.locator('select')).toHaveCount(0);

  // Desativar mantém a linha na tela: o que some ninguém reativa.
  await page.getByRole('switch', { name: 'Pix: desativar' }).click();
  await expect(page.getByTestId('payment-method-pay-pix')).toBeVisible();
  await expect
    .poll(() => api.paymentMethods().find((entry) => entry.id === 'pay-pix')?.enabled)
    .toBe(false);

  // Criar é o único lugar onde fluxo e tipo são escolhíveis.
  await page.getByTestId('payment-add').click();
  await escolher(page.getByTestId('payment-new-flow'), 'Na entrega');
  await escolher(page.getByTestId('payment-new-type'), 'Débito');
  await page.getByTestId('payment-new-label').fill('Débito na maquininha');
  await page.getByTestId('payment-new-save').click();

  await expect(page.getByText('Débito na maquininha')).toBeVisible();
  expect(api.paymentMethods().at(-1)).toMatchObject({
    payment_flow: 'delivery',
    method_type: 'debit_card',
    label: 'Débito na maquininha',
  });

  await page.getByTestId('payment-remove-pay-dinheiro').click();
  await expect(page.getByTestId('payment-method-pay-dinheiro')).toHaveCount(0);
  expect(api.paymentMethods().some((entry) => entry.id === 'pay-dinheiro')).toBe(false);
});

/* ==========================================================================
 * LOTE 2 — ENTREGA: frete grátis, pausa e faixas de prazo
 * ======================================================================= */

/*
 * FRETE GRÁTIS: DOIS CAMPOS, E NÃO SÓ O VALOR. Não existe número que signifique
 * "desligado" — `null` é "herda" e `0` seria "grátis sempre", o oposto. É o
 * booleano que dá à filial longe de tudo o jeito de recusar a campanha da rede.
 */
test('frete grátis: recusar é diferente de herdar, e o corpo prova a diferença', async ({
  page,
}) => {
  await abrirLoja(page);
  await escolherFilial(page);
  await abrirSecao(page, 'valores');

  await expect(page.getByTestId('branch-free-delivery-herda')).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  // Esta loja recusa a campanha da marca.
  await page.getByTestId('branch-free-delivery-nao-da').click();
  await page.getByTestId('store-save').click();
  await expect(page.getByTestId('store-saved')).toBeVisible();
  expect(api.overridesOf(FAKE_BRANCH.id)).toEqual({ free_delivery_enabled: false });

  // Voltar atrás é `null`, e não um campo apagado.
  await page.getByTestId('branch-free-delivery-herda').click();
  await page.getByTestId('store-save').click();
  await expect
    .poll(() => api.branchSettingsCalls().at(-1)?.body)
    .toEqual({ free_delivery_enabled: null });
});

test('dar frete grátis sem dizer acima de quanto é recusado antes de sair da tela', async ({
  page,
}) => {
  await abrirLoja(page);
  await escolherFilial(page);
  await abrirSecao(page, 'valores');

  await page.getByTestId('branch-free-delivery-da').click();
  await page.getByTestId('store-save').click();

  await expect(page.getByTestId('store-error')).toContainText('de graça em todo pedido');
  expect(api.branchSettingsCalls()).toHaveLength(0);
});

/*
 * A PAUSA É UM PRAZO, E NÃO UMA CHAVE. `accepts_delivery` é estrutural e espera
 * alguém religar; esta volta sozinha — e o dia em que ela é usada (chuva às
 * 19h) é exatamente o dia em que ninguém lembra de desligá-la.
 */
test('pausar a entrega manda minutos e motivo, e a linha diz até quando', async ({ page }) => {
  await abrirLoja(page);

  const linha = page.getByTestId(`operation-row-${FAKE_BRANCH.id}`);
  await expect(linha).toHaveAttribute('data-no-ar', 'true');

  await page.getByTestId(`operation-pause-${FAKE_BRANCH.id}`).click();

  const dialogo = page.getByRole('dialog');
  await expect(dialogo).toContainText('volta sozinha');
  await dialogo.getByTestId('pause-preset-60').click();
  await dialogo.getByTestId('pause-reason').fill('chuva forte');
  await dialogo.getByTestId('confirm-pause').click();

  await expect
    .poll(() => api.pauseCalls().at(-1)?.body)
    .toEqual({ minutes: 60, reason: 'chuva forte' });

  // A linha passa a dizer até quando, e por quê.
  const nota = page.getByTestId(`operation-note-${FAKE_BRANCH.id}`);
  await expect(nota).toContainText('Pausada até');
  await expect(nota).toContainText('chuva forte');

  // A CHAVE DE ENTREGA NÃO FOI MEXIDA: a pausa é outra coisa, e ela convive.
  await expect(page.getByTestId(`operation-accepts_delivery-${FAKE_BRANCH.id}`)).toBeChecked();

  // E retomar é um clique só: quem parou por 60 e resolveu em 20 não preenche
  // formulário de novo.
  await page.getByTestId(`operation-resume-${FAKE_BRANCH.id}`).click();
  await expect.poll(() => api.pauseCalls().at(-1)?.body).toEqual({ minutes: 0 });
  await expect(nota).not.toContainText('Pausada até');
});

test('com a entrega pausada e sem retirada, a loja para de dizer que está no ar', async ({
  page,
}) => {
  await abrirLoja(page);

  // Só entrega: a retirada desligada deixa a pausa sozinha respondendo.
  await page.getByTestId(`operation-accepts_pickup-${FAKE_BRANCH.id}`).click();

  await page.getByTestId(`operation-pause-${FAKE_BRANCH.id}`).click();
  await page.getByRole('dialog').getByTestId('confirm-pause').click();

  const linha = page.getByTestId(`operation-row-${FAKE_BRANCH.id}`);
  // O ponto lê `accepts_delivery_now`, e não `accepts_delivery`: com a chave
  // ligada e a entrega pausada, ninguém consegue comprar agora.
  await expect(linha).toHaveAttribute('data-no-ar', 'false');
});

test('a pausa que passa de 24 horas trava antes de chegar ao backend', async ({ page }) => {
  await abrirLoja(page);
  await page.getByTestId(`operation-pause-${FAKE_BRANCH.id}`).click();

  const dialogo = page.getByRole('dialog');
  await dialogo.getByTestId('pause-minutes').fill('3000');
  // O teto é do backend e está escrito aqui: a tela não oferece o que vai falhar.
  await expect(dialogo.getByTestId('confirm-pause')).toBeDisabled();
  await expect(dialogo).toContainText('24 horas');
  expect(api.pauseCalls()).toHaveLength(0);
});

/*
 * AS FAIXAS SÃO TETOS. Vale a primeira, em ordem crescente, cujo teto alcança a
 * distância — e é por isso que não há campo de piso: com piso daria para deixar
 * o endereço de 5,4 km sem faixa nenhuma.
 */
test('cadastrar faixas de prazo, e elas saem ordenadas por teto', async ({ page }) => {
  await abrirLoja(page);
  await escolherFilial(page);
  await abrirSecao(page, 'entrega');

  const bloco = page.getByTestId('delivery-bands');
  await expect(bloco.getByTestId('delivery-bands-vazio')).toContainText('tempo de rota do Google');
  // A ressalva que separa esta tabela do "tempo estimado" de Geral.
  await expect(bloco).toContainText('rótulo do cardápio');

  await bloco.getByTestId('band-add').click();
  await bloco.getByTestId('band-add').click();

  const campos = bloco.locator('input');
  // A faixa maior é digitada PRIMEIRO, para provar que a ordem que sai é a da
  // regra ("a primeira cujo teto alcança") e não a de digitação.
  await campos.nth(0).fill('10');
  await campos.nth(1).fill('40');
  await campos.nth(2).fill('55');
  await campos.nth(3).fill('5');
  await campos.nth(4).fill('20');
  await campos.nth(5).fill('30');

  await bloco.getByTestId('delivery-bands-save').click();

  await expect
    .poll(() => api.bandCalls().at(-1)?.body)
    .toEqual({
      bands: [
        { max_distance_km: 5, delivery_time_min: 20, delivery_time_max: 30 },
        { max_distance_km: 10, delivery_time_min: 40, delivery_time_max: 55 },
      ],
    });
});

test('duas faixas com o mesmo teto são recusadas antes de virar duas respostas', async ({
  page,
}) => {
  await abrirLoja(page);
  await escolherFilial(page);
  await abrirSecao(page, 'entrega');

  const bloco = page.getByTestId('delivery-bands');
  await bloco.getByTestId('band-add').click();
  await bloco.getByTestId('band-add').click();

  const campos = bloco.locator('input');
  await campos.nth(0).fill('5');
  await campos.nth(1).fill('20');
  await campos.nth(2).fill('30');
  await campos.nth(3).fill('5');
  await campos.nth(4).fill('25');
  await campos.nth(5).fill('35');

  await bloco.getByTestId('delivery-bands-save').click();

  await expect(bloco.getByTestId('delivery-bands-error')).toContainText('duas faixas até 5 km');
  expect(api.bandCalls()).toHaveLength(0);
});

/* Lista vazia NÃO é "sem entrega": é o prazo voltando a sair do Google. */
test('apagar as faixas é uma ação nomeada, e diz o que passa a valer', async ({ page }) => {
  await abrirLoja(page);
  await escolherFilial(page);
  await abrirSecao(page, 'entrega');

  const bloco = page.getByTestId('delivery-bands');
  await bloco.getByTestId('band-add').click();
  const campos = bloco.locator('input');
  await campos.nth(0).fill('5');
  await campos.nth(1).fill('20');
  await campos.nth(2).fill('30');
  await bloco.getByTestId('delivery-bands-save').click();
  await expect(bloco.getByTestId('delivery-bands-vazio')).toHaveCount(0);

  await bloco.getByRole('button', { name: 'Voltar a usar o tempo do Google' }).click();
  await bloco.getByTestId('delivery-bands-save').click();

  await expect.poll(() => api.bandCalls().at(-1)?.body).toEqual({ bands: [] });
  await expect(bloco.getByTestId('delivery-bands-vazio')).toBeVisible();
});

/* ==========================================================================
 * MARCA — os dois textos sobre a casa, e o outro destino de gravação
 *
 * Esta seção existe separada de Geral justamente por causa do que se testa
 * aqui: ela grava em `PATCH /admin/restaurant` (a tabela `restaurants`) e não
 * em `PATCH /admin/settings` (a `restaurant_settings`). Com os dois na mesma
 * barra de salvar, um campo iria no corpo do outro.
 * ======================================================================= */

test('Marca grava no perfil do restaurante, e só o campo mexido vai no corpo', async ({ page }) => {
  await abrirLoja(page);
  await abrirSecao(page, 'marca');

  await expect(page.getByTestId('store-branch-note')).toHaveText('vale para o restaurante inteiro');

  // A identificação é LEITURA: nome, endereço público e código, sem campo.
  await expect(page.getByTestId('marca-nome')).toHaveText(api.profile().name);
  await expect(page.getByTestId('marca-slug')).toHaveText(`/${api.profile().slug}`);
  await expect(page.getByTestId('marca-id')).toHaveText(api.profile().id);
  await expect(page.getByTestId('marca-identidade').locator('input')).toHaveCount(0);

  await page.getByTestId('marca-descricao').fill('Forno a lenha desde 2011, no Centro.');
  await page.getByTestId('store-save').click();
  await expect(page.getByTestId('store-saved')).toBeVisible();

  // O OUTRO DESTINO: nada disto pode ter passado por /admin/settings.
  expect(api.settingsPatches()).toHaveLength(0);
  expect(api.profilePatches()).toEqual([{ description: 'Forno a lenha desde 2011, no Centro.' }]);
  // O campo que o lojista não tocou não vai no corpo.
  expect(api.profilePatches().at(-1)).not.toHaveProperty('assistant_notes');
});

/*
 * O CORTE ERA SILENCIOSO: o lojista digitava 500 e 200 sumiam sem aviso. Sem
 * `maxLength`, o texto passa do teto na tela — e é a tela que recusa, com o
 * número que falta cortar, antes de o backend recusar com 422.
 */
test('passar do teto acende o contador e a gravação para antes do 422', async ({ page }) => {
  await abrirLoja(page);
  await abrirSecao(page, 'marca');

  await page.getByTestId('marca-notas').fill('a'.repeat(312));

  await expect(page.getByTestId('marca-notas-contador')).toHaveText('312/300');
  await expect(page.getByTestId('marca-notas-contador')).toHaveClass(/marca__acima/);

  await page.getByTestId('store-save').click();

  await expect(page.getByTestId('store-error')).toContainText('corte 12 caracteres');
  expect(api.profilePatches()).toHaveLength(0);
});

/*
 * O TEXTO LEGADO — os tetos só existem no corpo do PATCH, e a resposta não os
 * declara: um texto gravado antes de os dois campos se separarem chega aqui
 * acima do teto sem ninguém ter digitado nada.
 *
 * Ele não pode invalidar a tela na abertura (o lojista não fez nada), e não
 * pode passar em silêncio.
 */
test('texto legado acima do teto é dito na tela e não trava o outro campo', async ({ page }) => {
  api.setProfileTexts({ assistant_notes: 'b'.repeat(400) });

  await abrirLoja(page);
  await abrirSecao(page, 'marca');

  // Aberto assim, ele é DITO — e o formulário não abre sujo nem inválido.
  await expect(page.getByTestId('marca-legado')).toContainText('corte 100 caracteres');
  await expect(page.getByTestId('marca-notas-contador')).toHaveText('400/300');
  await expect(page.getByTestId('store-save-bar')).toHaveCount(0);

  // E salvar a DESCRIÇÃO continua funcionando: o campo legado fica fora do
  // corpo, então não há 422 para levar junto o campo que o lojista arrumou.
  await page.getByTestId('marca-descricao').fill('Vitrine nova.');
  await page.getByTestId('store-save').click();

  await expect(page.getByTestId('store-saved')).toBeVisible();
  expect(api.profilePatches()).toEqual([{ description: 'Vitrine nova.' }]);
  expect(api.profile().assistant_notes).toHaveLength(400);
});

/* ==========================================================================
 * O ENDEREÇO ANTIGO, E O TELEFONE
 * ======================================================================= */

test('o endereço antigo /minha-loja continua abrindo a seção certa', async ({ page }) => {
  await abrirLoja(page);

  /*
   * É o link que o suporte manda por WhatsApp e que o lojista deixou nos
   * favoritos. Uma renomeação que o quebra troca um rótulo melhor por um beco.
   */
  await page.goto('/minha-loja/horarios');
  await expect(page).toHaveURL(/\/loja\/horarios$/);
  await expect(page.getByRole('heading', { name: 'Loja' })).toBeVisible();

  // A raiz antiga também: sem seção, ela cai onde /loja cai.
  await page.goto('/minha-loja');
  await expect(page).toHaveURL(/\/loja\/operacao$/);
});

test('no telefone, /loja é a LISTA das nove seções — e Operação está na barra de baixo', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto('/loja');
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('E-mail').fill(LOGIN_EMAIL);
  await page.getByLabel('Senha').fill(LOGIN_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();

  /*
   * A ABA DA BARRA DE BAIXO APONTA PARA DENTRO DE LOJA, e é a decisão que faz o
   * resto caber: abrir e fechar a loja é a ação de sábado à noite, e ela não
   * pode custar dois toques dentro de uma tela de configuração.
   */
  await page.getByTestId('bottom-operacao').click();
  await expect(page).toHaveURL(/\/loja\/operacao$/);
  await expect(page.getByTestId(`operation-row-${FAKE_BRANCH.id}`)).toBeVisible();

  /*
   * A FITA DE NOVE PASTILHAS NÃO EXISTE NO TELEFONE. No lugar dela, `/loja` é a
   * lista — e a volta para ela é uma afirmação na tela, não o gesto do
   * aparelho.
   */
  await expect(page.getByTestId('store-anchor-horarios')).toBeHidden();
  await page.getByTestId('store-voltar').click();
  await expect(page).toHaveURL(/\/loja$/);

  const lista = page.getByRole('navigation', { name: 'Todas as seções da loja' });
  await expect(lista.getByRole('link')).toHaveCount(9);
  await expect(page.getByTestId('store-lista-geral')).toContainText(
    'vale para o restaurante inteiro',
  );

  // E a lista navega: cada linha é a rota da seção.
  await page.getByTestId('store-lista-impressao').click();
  await expect(page).toHaveURL(/\/loja\/impressao$/);
});
