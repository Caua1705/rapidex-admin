/**
 * E2E de Minha loja.
 *
 * Os testes daqui cobrem as quatro formas de esta tela dar prejuízo em
 * silêncio: fechar a semana sem querer no PUT de horários, deixar a entrega
 * sem estimativa e não avisar, expor um campo que não afeta cobrança nenhuma, e
 * editar "todas as filiais" como se fosse uma.
 */
import { expect, test, type Page } from '@playwright/test';

import { installFakeApi, FAKE_BRANCH, LOGIN_EMAIL, LOGIN_PASSWORD, type FakeApi } from './fake-api';
import { escolher } from './seletor';

let api: FakeApi;

test.beforeEach(async ({ page }) => {
  api = await installFakeApi(page);
});

test.afterEach(() => {
  api.stop();
});

async function abrirMinhaLoja(page: Page) {
  await page.goto('/minha-loja');
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel('E-mail').fill(LOGIN_EMAIL);
  await page.getByLabel('Senha').fill(LOGIN_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();

  await page.getByRole('link', { name: 'Minha loja' }).click();
  await expect(page).toHaveURL(/\/minha-loja$/);
}

/** A tela abre com "todas as filiais"; as abas de filial precisam de uma. */
async function escolherFilial(page: Page) {
  await page.getByTestId(`store-pick-branch-${FAKE_BRANCH.id}`).click();
}

test('a sidebar leva a Minha loja e a loja abre e fecha pelo topo', async ({ page }) => {
  await abrirMinhaLoja(page);

  const status = page.getByTestId('store-status');
  await expect(status).toHaveAttribute('data-open', 'true');
  await expect(status).toContainText('Loja aberta');

  // O interruptor está no topo, fora das abas: fechar a loja não pode custar
  // dois cliques e uma aba.
  await page.getByRole('switch', { name: 'Fechar a loja' }).click();

  await expect(status).toHaveAttribute('data-open', 'false');
  await expect(status).toContainText('Ninguém consegue fazer pedido');
  expect(api.settings().is_open).toBe(false);
});

test('Geral salva as configurações do restaurante e não expõe a taxa padrão', async ({ page }) => {
  await abrirMinhaLoja(page);

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
  await abrirMinhaLoja(page);

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
  await abrirMinhaLoja(page);

  await page.getByTestId('settings-eta-max').fill('');
  await page.getByTestId('store-save').click();

  await expect(page.getByTestId('store-error')).toContainText('os dois lados da faixa');
  expect(api.settingsPatches()).toHaveLength(0);
});

test('as abas de filial pedem uma filial em vez de editar "todas"', async ({ page }) => {
  await abrirMinhaLoja(page);

  // Geral é do restaurante inteiro: funciona sem escolher filial.
  await expect(page.getByTestId('settings-min-order')).toBeVisible();

  await page.getByTestId('store-anchor-filial').click();
  await expect(page.getByTestId('store-branch-required')).toBeVisible();
  await expect(page.getByTestId('branch-name')).toHaveCount(0);

  // O mesmo vale para horários, entrega e pagamento.
  for (const aba of ['horarios', 'entrega', 'pagamento']) {
    await page.getByTestId(`store-anchor-${aba}`).click();
    await expect(page.getByTestId('store-branch-required')).toBeVisible();
  }

  // E o estado resolve o problema em vez de só reclamar dele.
  await page.getByTestId('store-anchor-filial').click();
  await escolherFilial(page);
  await expect(page.getByTestId('branch-name')).toHaveValue(FAKE_BRANCH.name);
});

test('Filial salva cadastro e avisa quando falta a coordenada', async ({ page }) => {
  await abrirMinhaLoja(page);
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
  await abrirMinhaLoja(page);
  await page.getByTestId('store-anchor-filial').click();
  await escolherFilial(page);

  await page.getByTestId('branch-latitude').fill('100');
  await page.getByTestId('store-save').click();

  await expect(page.getByTestId('store-error')).toContainText('Latitude');
  expect(api.branchPatches()).toHaveLength(0);
});

test('Horários manda os sete dias, e não só os que foram mexidos', async ({ page }) => {
  await abrirMinhaLoja(page);
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
  await abrirMinhaLoja(page);
  await escolherFilial(page);
  await page.getByTestId('store-anchor-horarios').click();

  // Abre o sábado e não informa a hora.
  await page.getByRole('switch', { name: 'Sábado: abrir' }).click();
  await page.getByTestId('store-save').click();

  await expect(page.getByTestId('store-error')).toContainText('Sábado');
  expect(api.hoursPuts()).toHaveLength(0);
});

test('Entrega mostra base e por-km faltando como erro de configuração', async ({ page }) => {
  await abrirMinhaLoja(page);
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
  await abrirMinhaLoja(page);
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
