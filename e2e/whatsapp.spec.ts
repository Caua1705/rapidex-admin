/**
 * E2E DO WHATSAPP — as coisas que esta tela não pode errar.
 *
 * Nenhuma delas é de campo. Todas são estados que respondem 200, desenham
 * normalmente e custam o aviso de uma loja inteira — sem erro, sem tela
 * vermelha, com o pedido seguindo em silêncio:
 *
 *   1. FILIAL SEM NÚMERO HERDA o do restaurante, e a tela precisa DIZER isso.
 *      Uma coluna vazia lê como "esta loja está sem WhatsApp", e o dono
 *      cadastra um segundo número para uma loja que já avisava.
 *   2. "NUNCA CONECTOU" E "CONECTOU E CAIU" são a mesma ausência na tela e
 *      pedem consertos opostos.
 *   3. NÚMERO PRÓPRIO DESLIGADO NÃO CAI no do restaurante — é o contrário do
 *      que "herança" sugere em todo o resto do painel.
 *   4. A FRASE DO ESTADO É A DO BACKEND. A tela repassa `status_label` e
 *      `status_action`; não os deduz do enum.
 *   5. AS RECUSAS DE CADASTRO TÊM FRASE, e cada uma pede uma coisa diferente.
 *      Sem elas o lojista lê o número HTTP.
 *   6. RECONECTAR É A MESMA ROTA, e o token não volta — nem no formulário.
 *   7. A TELA É DE LEITURA PARA A GERÊNCIA e de escrita só para o dono.
 */
import { expect, test, type Page } from '@playwright/test';

import {
  installFakeApi,
  LOGIN_EMAIL,
  LOGIN_PASSWORD,
  type CanalDeWhatsApp,
  type FakeApi,
} from './fake-api';
import { escolher, FAKE_BRANCH, FAKE_BRANCH_2 } from './seletor';

let api: FakeApi;

test.beforeEach(async ({ page }) => {
  api = await installFakeApi(page);
});

test.afterEach(() => {
  api.stop();
});

async function entrar(page: Page, destino = '/whatsapp') {
  await page.goto(destino);
  await page.getByLabel('E-mail').fill(LOGIN_EMAIL);
  await page.getByLabel('Senha').fill(LOGIN_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: 'WhatsApp' })).toBeVisible();
}

/** A linha do restaurante — a queda que toda filial sem número próprio herda. */
function quedaDoRestaurante(over: Partial<CanalDeWhatsApp> = {}): CanalDeWhatsApp {
  return {
    id: 'wa-restaurante',
    restaurant_id: '11111111-1111-1111-1111-111111111111',
    branch_id: null,
    waba_id: '109876543210987',
    phone_number_id: 'pn-restaurante',
    display_phone_number: '+55 85 3333-0000',
    is_active: true,
    disconnected_at: null,
    disconnect_reason: null,
    connected_at: '2026-08-20T13:00:00Z',
    ...over,
  };
}

/*
 * AS DUAS TABELAS MOSTRAM O NOME DA MESMA LOJA, e por isso nenhum teste procura
 * "uma linha com o nome X": a de herança diz por qual número a loja fala, a de
 * canais diz onde aquele número vale. Buscar solto casaria as duas — e passaria
 * a afirmar coisas sobre a tabela errada no dia em que uma delas mudasse.
 */

/** A linha desta loja na tabela de HERANÇA. */
function linhaDaLoja(page: Page, nome: string) {
  return page
    .getByRole('table', { name: /Por qual número cada loja/ })
    .getByRole('row')
    .filter({ hasText: nome });
}

/** A linha deste canal na tabela de NÚMEROS, pelo id que só ela mostra. */
function linhaDoCanal(page: Page, phoneNumberId: string) {
  return page
    .getByRole('table', { name: /Os números de WhatsApp/ })
    .getByRole('row')
    .filter({ hasText: 'ID ' + phoneNumberId });
}

/* ==========================================================================
 * 1 e 3. A HERANÇA, E A HERANÇA QUE NÃO ACONTECE
 * ======================================================================= */

test('a filial sem número diz que HERDA o do restaurante, com o número na frente', async ({
  page,
}) => {
  await entrar(page);

  /*
   * A Zona Norte não tem linha própria na semente. Sem esta frase, a coluna
   * dela lê como "loja sem WhatsApp" — e ela está avisando o cliente pelo
   * número do restaurante neste minuto.
   */
  const linha = linhaDaLoja(page, FAKE_BRANCH_2.name);
  await expect(linha).toContainText('Herda o número do restaurante');
  await expect(linha).toContainText('+55 85 3333-0000');
  await expect(page.getByTestId(`whatsapp-avisa-${FAKE_BRANCH_2.id}`)).toBeVisible();
});

test('o número PRÓPRIO desligado não cai no do restaurante, e a tela diz isso', async ({
  page,
}) => {
  await entrar(page);

  /*
   * A Matriz Aldeota tem linha própria DESLIGADA na semente, e o restaurante
   * tem uma no ar. A suposição natural — "então ela usa a do restaurante" — é
   * falsa, e é a que faz o dono não procurar defeito nenhum.
   */
  const linha = linhaDaLoja(page, FAKE_BRANCH.name);
  await expect(linha).toContainText('Número próprio, fora do ar');
  await expect(linha).toContainText('NÃO passa a usar o número do restaurante');
  await expect(page.getByTestId(`whatsapp-nao-avisa-${FAKE_BRANCH.id}`)).toBeVisible();

  /* E o aviso de cima conta quantas são e as nomeia: a etiqueta na quarta
     linha de uma tabela não é achável sozinha. */
  await expect(page.getByTestId('whatsapp-mudas')).toContainText('1 loja não avisa o cliente');
  await expect(page.getByTestId('whatsapp-mudas')).toContainText(FAKE_BRANCH.name);
});

/* ==========================================================================
 * 2. NUNCA CONECTOU × CONECTOU E CAIU
 *
 * As duas somem da tela do mesmo jeito, e são consertos opostos: uma pede
 * cadastro, a outra tem um cliente de ontem que foi avisado e um de hoje que
 * não foi.
 * ======================================================================= */

test('sem canal nenhum, a tela diz NUNCA CONECTOU — e não fala em número caído', async ({
  page,
}) => {
  api.setWhatsAppChannels([]);
  await entrar(page);

  await expect(page.getByTestId('whatsapp-sem-numero')).toContainText('Nenhum número conectado');

  const linha = linhaDaLoja(page, FAKE_BRANCH_2.name);
  await expect(linha).toContainText('Nunca conectou');
  await expect(linha).toContainText('não tem um para ela herdar');
  /* A palavra que separa os dois casos não pode aparecer aqui. */
  await expect(linha).not.toContainText('fora do ar');
});

test('com a queda do restaurante caída, a loja sem número diz que HERDARIA — não que nunca conectou', async ({
  page,
}) => {
  api.setWhatsAppChannels([
    quedaDoRestaurante({
      disconnected_at: '2026-09-03T10:00:00Z',
      disconnect_reason: 'PARTNER_REMOVED',
    }),
  ]);
  await entrar(page);

  const linha = linhaDaLoja(page, FAKE_BRANCH_2.name);
  await expect(linha).toContainText('Herdaria o número do restaurante');
  await expect(linha).toContainText('está fora do ar');
  await expect(linha).not.toContainText('Nunca conectou');
  /* O número aparece mesmo caído: é por ele que o dono acha a linha para
     religar, e sem ele a frase mandaria procurar um número que não se mostra. */
  await expect(linha).toContainText('+55 85 3333-0000');
});

/* ==========================================================================
 * 4. A FRASE DO ESTADO É A DO BACKEND
 * ======================================================================= */

test('a tela mostra o rótulo e a ação que vieram na resposta, e o motivo cru da Meta', async ({
  page,
}) => {
  api.setWhatsAppChannels([
    quedaDoRestaurante({
      disconnected_at: '2026-09-03T10:00:00Z',
      disconnect_reason: 'PARTNER_REMOVED',
    }),
  ]);
  await entrar(page);

  const linha = linhaDoCanal(page, 'pn-restaurante');
  await expect(page.getByTestId('whatsapp-status-wa-restaurante')).toHaveText(
    'Desconectado pela Meta',
  );
  await expect(linha).toContainText('Reconecte por lá primeiro');
  /* O `disconnect_reason` vem CRU de propósito: é o que se cita num chamado
     com o suporte da Meta, e traduzi-lo tiraria da mão do lojista a única
     string que o outro lado reconhece. */
  await expect(linha).toContainText('PARTNER_REMOVED');
});

test('desligado no painel e desconectado pela Meta não desenham a mesma coisa', async ({
  page,
}) => {
  await entrar(page);

  /* Desligado no painel é escolha de alguém: etiqueta neutra e a ação de
     religar. Não pode vestir o alerta, que é do estado que ninguém escolheu. */
  const desligado = page.getByTestId('whatsapp-status-wa-aldeota');
  await expect(desligado).toHaveText('Desligado no painel');
  await expect(desligado).not.toHaveClass(/tag--alerta/);

  api.setWhatsAppChannels([
    quedaDoRestaurante({ disconnected_at: '2026-09-03T10:00:00Z', disconnect_reason: 'X' }),
  ]);
  await page.reload();
  await expect(page.getByTestId('whatsapp-status-wa-restaurante')).toHaveClass(/tag--alerta/);
});

/* ==========================================================================
 * 5. AS RECUSAS DE CADASTRO — cada uma com a frase que diz o que fazer
 * ======================================================================= */

test('o número que já é de outra filial recusa NOMEANDO a filial', async ({ page }) => {
  await entrar(page);

  await page.getByTestId('whatsapp-novo').click();
  await escolher(page.getByTestId('whatsapp-loja'), FAKE_BRANCH_2.name);
  await page.getByTestId('whatsapp-numero').fill('+55 85 98888-1111');
  /* O ID É O MESMO da linha da Aldeota — é ele, e não o número escrito, que
     decide a colisão. */
  await page.getByTestId('whatsapp-phone-number-id').fill('pn-aldeota');
  await page.getByTestId('whatsapp-waba-id').fill('109876543210987');
  await page.getByTestId('whatsapp-token').fill('token-novo');
  await page.getByTestId('whatsapp-salvar').click();

  await expect(page.getByRole('alert')).toContainText(
    `Este número já é o da filial ${FAKE_BRANCH.name}`,
  );
  /* O diálogo NÃO fecha com a recusa: a frase diz o que fazer, e fechá-lo
     deixaria o lojista com a lista de antes e nenhuma explicação. */
  await expect(page.getByTestId('whatsapp-salvar')).toBeVisible();
});

test('o lugar já ocupado recusa dizendo por qual número aquele lugar fala hoje', async ({
  page,
}) => {
  await entrar(page);

  await page.getByTestId('whatsapp-novo').click();
  /* A linha do restaurante já existe na semente. */
  await page.getByTestId('whatsapp-numero').fill('+55 85 3333-9999');
  await page.getByTestId('whatsapp-phone-number-id').fill('pn-outro');
  await page.getByTestId('whatsapp-waba-id').fill('109876543210987');
  await page.getByTestId('whatsapp-token').fill('token-novo');
  await page.getByTestId('whatsapp-salvar').click();

  await expect(page.getByRole('alert')).toContainText(
    'O restaurante já tem o número +55 85 3333-0000',
  );
});

test('o número de outro restaurante recusa sem dizer de quem ele é', async ({ page }) => {
  api.setWhatsAppChannels([
    quedaDoRestaurante(),
    {
      ...quedaDoRestaurante(),
      id: 'wa-de-outro',
      restaurant_id: 'outro-restaurante',
      phone_number_id: 'pn-alheio',
      display_phone_number: '+55 11 4444-0000',
    },
  ]);
  await entrar(page);

  await page.getByTestId('whatsapp-novo').click();
  await escolher(page.getByTestId('whatsapp-loja'), FAKE_BRANCH.name);
  await page.getByTestId('whatsapp-numero').fill('+55 11 4444-0000');
  await page.getByTestId('whatsapp-phone-number-id').fill('pn-alheio');
  await page.getByTestId('whatsapp-waba-id').fill('109876543210987');
  await page.getByTestId('whatsapp-token').fill('token-novo');
  await page.getByTestId('whatsapp-salvar').click();

  const alerta = page.getByRole('alert');
  await expect(alerta).toContainText('Este número já está conectado');
  /* A frase NÃO nomeia o dono da outra linha — quem chegou aqui já tinha o id
     em mãos, então a existência não é novidade; de quem ela é, seria. */
  await expect(alerta).not.toContainText('outro-restaurante');
});

/* ==========================================================================
 * 6. CONECTAR, RECONECTAR E DESCONECTAR
 * ======================================================================= */

test('conectar a linha do restaurante manda `branch_id: null` EXPLÍCITO, e o token no CORPO', async ({
  page,
}) => {
  api.setWhatsAppChannels([]);
  await entrar(page);

  await page.getByTestId('whatsapp-novo').click();
  await page.getByTestId('whatsapp-numero').fill('+55 85 3333-0000');
  await page.getByTestId('whatsapp-phone-number-id').fill('pn-1');
  await page.getByTestId('whatsapp-waba-id').fill('109876543210987');
  await page.getByTestId('whatsapp-token').fill('EAAG-token-secreto');
  await page.getByTestId('whatsapp-salvar').click();

  /*
   * SÓ O CORPO PROVA. Na tela, "conectou no restaurante" e "conectou numa
   * filial" desenham parecido — e a diferença entre elas é toda a herança.
   */
  const corpo = api.whatsappBodies().at(-1)!;
  expect(corpo.branch_id).toBeNull();
  expect(corpo.access_token).toBe('EAAG-token-secreto');

  /* E a tela relê: as duas lojas passam a avisar pela queda do restaurante, e
     isso NÃO está na resposta do POST — só na releitura. */
  await expect(page.getByTestId(`whatsapp-avisa-${FAKE_BRANCH.id}`)).toBeVisible();
  await expect(page.getByTestId(`whatsapp-avisa-${FAKE_BRANCH_2.id}`)).toBeVisible();
  await expect(page.getByTestId('whatsapp-mudas')).toHaveCount(0);
});

test('reconectar é a mesma rota, o token nasce vazio, e a identidade da linha fica travada', async ({
  page,
}) => {
  await entrar(page);

  await page.getByTestId('whatsapp-reconectar-wa-aldeota').click();

  /* O ID do número identifica a linha que está voltando: alterado, o que
     parecia troca de token viraria cadastro novo e o 409 chegaria depois. */
  await expect(page.getByTestId('whatsapp-phone-number-id')).toHaveValue('pn-aldeota');
  await expect(page.getByTestId('whatsapp-phone-number-id')).toBeDisabled();
  /* O token não volta em rota nenhuma — nem parcial, nem mascarado. */
  await expect(page.getByTestId('whatsapp-token')).toHaveValue('');
  /* E o WABA volta MASCARADO na leitura, então o campo também nasce vazio:
     mandar `••••7890` de volta cadastraria uma conta que não existe. */
  await expect(page.getByTestId('whatsapp-waba-id')).toHaveValue('');

  await page.getByTestId('whatsapp-waba-id').fill('109876543210987');
  await page.getByTestId('whatsapp-token').fill('token-rodado');
  await page.getByTestId('whatsapp-salvar').click();

  /* A MESMA LINHA voltou: nada de segunda linha para o mesmo número. */
  await expect(page.getByTestId('whatsapp-status-wa-aldeota')).toHaveText('Conectado');
  expect(
    api.whatsappChannels().filter((canal) => canal.phone_number_id === 'pn-aldeota'),
  ).toHaveLength(1);
  await expect(page.getByTestId(`whatsapp-avisa-${FAKE_BRANCH.id}`)).toBeVisible();
});

test('desconectar a queda do restaurante nomeia as lojas que ficam mudas, e não apaga a linha', async ({
  page,
}) => {
  await entrar(page);

  await page.getByTestId('whatsapp-desconectar-wa-restaurante').click();

  /*
   * A LISTA DE QUEM FICA MUDO É O MOTIVO DE O DIÁLOGO EXISTIR. Desligar a
   * linha do restaurante não cala uma loja: cala todas as que herdam dela, e
   * essa lista não está em nenhum outro lugar da tela.
   */
  await expect(page.getByTestId('whatsapp-dependentes')).toContainText(FAKE_BRANCH_2.name);
  await expect(page.getByRole('button', { name: 'Manter conectado' })).toBeVisible();

  await page.getByRole('button', { name: 'Desconectar o número' }).click();

  /* A LINHA NÃO É APAGADA — ela fica desligada, e é por isso que a rota devolve
     200 com o canal. Apagá-la levaria junto o registro de que o cliente foi
     avisado. */
  await expect(page.getByTestId('whatsapp-status-wa-restaurante')).toHaveText(
    'Desligado no painel',
  );
  expect(api.whatsappChannels().find((canal) => canal.id === 'wa-restaurante')?.is_active).toBe(
    false,
  );

  /* E a Zona Norte, que herdava, para de avisar no mesmo instante. */
  await expect(page.getByTestId(`whatsapp-nao-avisa-${FAKE_BRANCH_2.id}`)).toBeVisible();
  await expect(page.getByTestId('whatsapp-mudas')).toContainText('2 lojas não avisam');
});

/* ==========================================================================
 * 7. QUEM PODE O QUÊ
 * ======================================================================= */

test('o gerente lê a tela inteira e não vê nenhum controle de escrita', async ({ page }) => {
  api.entrarComoPapel('manager');
  await entrar(page);

  /* SOME O CONTROLE, FICA O DADO: é ele quem responde ao cliente que ligou
     dizendo não ter recebido o aviso, e para isso precisa da tela. */
  await expect(linhaDaLoja(page, FAKE_BRANCH_2.name)).toContainText(
    'Herda o número do restaurante',
  );
  await expect(page.getByTestId('whatsapp-novo')).toHaveCount(0);
  await expect(page.getByTestId('whatsapp-desconectar-wa-restaurante')).toHaveCount(0);
  await expect(page.getByTestId('whatsapp-reconectar-wa-aldeota')).toHaveCount(0);
  await expect(page.getByTestId('whatsapp-somente-leitura')).toBeVisible();
});

test('o atendente não chega à tela, e o item some da navegação dele', async ({ page }) => {
  api.entrarComoPapel('attendant');
  await page.goto('/whatsapp');
  await page.getByLabel('E-mail').fill(LOGIN_EMAIL);
  await page.getByLabel('Senha').fill(LOGIN_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();

  /* Sem a guarda ele cairia numa tela que responde 403, e leria isso como
     defeito do painel — não como acesso restrito. */
  await expect(page).not.toHaveURL(/whatsapp/);
  await expect(page.getByRole('link', { name: 'WhatsApp' })).toHaveCount(0);
});
