/**
 * ============================================================================
 * O ACESSO DO ENTREGADOR — o par que sai uma vez só
 * ============================================================================
 *
 * `POST /admin/couriers/{id}/access` devolve `link_token` e `access_code` em
 * claro, e essa é a ÚNICA vez que os dois existem fora do hash. Não há rota que
 * os mostre de novo, e a segunda via é gerar OUTRO par — o que mata o primeiro.
 *
 * A CONSEQUÊNCIA MANDA NO DESENHO INTEIRO, como no diálogo da senha temporária:
 * fechar sem entregar não perde um formulário que dá para reabrir, perde a
 * credencial. Se o motoboy já tiver recebido a primeira, ele fica com um link
 * morto e uma conversa a repetir.
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

async function abrirEntregadores(page: Page) {
  await page.goto('/pedidos');
  await page.getByLabel('E-mail').fill(LOGIN_EMAIL);
  await page.getByLabel('Senha').fill(LOGIN_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/pedidos$/);

  await page.goto('/entregadores');
  await expect(page.getByRole('heading', { name: 'Entregadores' })).toBeVisible();
}

/*
 * O JORGE NÃO TEM ACESSO na semente — é o caminho de quem acabou de ser
 * cadastrado, que é o caso normal.
 */
test('gerar acesso mostra o par inteiro, com o aviso antes dele', async ({ page }) => {
  await abrirEntregadores(page);

  await page.getByTestId('courier-access-ent-jorge').click();

  const dialogo = page.getByTestId('acesso-dialogo');
  await expect(dialogo).toBeVisible();

  // O AVISO VEM ANTES DO PAR: depois dele, é lido por quem já decidiu o que fazer.
  await expect(page.getByTestId('acesso-aviso')).toContainText('uma vez só');
  await expect(page.getByTestId('acesso-aviso')).toContainText('Não dá para ver de novo');

  // O PAR INTEIRO, porque um sem o outro não abre nada.
  await expect(page.getByTestId('acesso-link')).toContainText('pederapidex.com/entregador/');
  await expect(page.getByTestId('acesso-codigo')).toContainText('COD');
  await expect(page.getByTestId('acesso-qr')).toBeVisible();
});

/*
 * O QR É DE VERDADE, e não uma imagem buscada fora: um serviço externo mandaria
 * o token do motoboy para um terceiro. Ele é SVG desenhado aqui — e o teste
 * confere que há traços, não só uma moldura vazia.
 */
test('o QR é desenhado no painel, e não buscado num serviço', async ({ page }) => {
  const externas: string[] = [];
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (!url.includes('127.0.0.1') && !url.startsWith('data:')) externas.push(url);
    return route.fallback();
  });

  await abrirEntregadores(page);
  await page.getByTestId('courier-access-ent-jorge').click();

  const qr = page.getByTestId('acesso-qr');
  await expect(qr).toBeVisible();
  // Um `path` com dados é o desenho; sem ele, a moldura estaria vazia.
  expect(await qr.locator('path').getAttribute('d')).toContain('h1v1h-1z');

  expect(externas, `o painel foi buscar algo fora: ${externas.join(', ')}`).toHaveLength(0);
});

/*
 * O DIÁLOGO NÃO FECHA SOZINHO. Esc, clique no fundo e o "x" somem juntos — são
 * os três jeitos de fechar sem querer, e trancar dois deixaria o terceiro
 * fazendo o estrago que os outros dois pararam.
 */
test('não fecha sem a confirmação de que entregou', async ({ page }) => {
  await abrirEntregadores(page);
  await page.getByTestId('courier-access-ent-jorge').click();

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('acesso-dialogo')).toBeVisible();

  await expect(page.getByTestId('acesso-fechar')).toBeDisabled();

  await page.getByTestId('acesso-confirmou').click();
  await expect(page.getByTestId('acesso-fechar')).toBeEnabled();
  await page.getByTestId('acesso-fechar').click();

  await expect(page.getByTestId('acesso-dialogo')).toHaveCount(0);
});

/*
 * O WHATSAPP É SÓ UM LINK `wa.me` — sem API e sem Business Manager. Ele leva o
 * par INTEIRO numa mensagem só: mandar link e código em duas é o que produz a
 * ligação de volta ("chegou só o endereço"), e a essa altura o par já não
 * existe para reenviar a metade que faltou.
 */
test('o WhatsApp leva o par inteiro, para o telefone do entregador', async ({ page }) => {
  await abrirEntregadores(page);
  await page.getByTestId('courier-access-ent-jorge').click();

  const href = await page.getByTestId('acesso-whatsapp').getAttribute('href');
  expect(href).toContain('https://wa.me/5585999990000');

  const texto = decodeURIComponent(new URL(href!).searchParams.get('text')!);
  expect(texto).toContain('pederapidex.com/entregador/');
  expect(texto).toContain('COD');
});

/*
 * ============================================================================
 * REGERAR MATA O PAR ANTERIOR — e por isso pergunta antes
 * ============================================================================
 *
 * A Ana já tem acesso na semente. Este é o botão de "o motoboy saiu ou perdeu o
 * celular", e apertá-lo por engano derruba quem está entregando agora, sem
 * aviso nenhum do lado dele.
 */
test('com acesso já valendo, gerar outro pergunta antes e diz o que quebra', async ({ page }) => {
  await abrirEntregadores(page);

  await page.getByTestId('courier-access-ent-ana').click();

  const dialogo = page.getByTestId('courier-regerar-dialogo');
  await expect(dialogo).toContainText('param de funcionar na hora');
  await expect(dialogo).toContainText('no meio da corrida');

  // Nada foi gerado enquanto a pergunta está aberta.
  await expect(page.getByTestId('acesso-dialogo')).toHaveCount(0);
});

test('confirmar a regeração troca o par, e a linha passa a dizer que há acesso', async ({
  page,
}) => {
  await abrirEntregadores(page);

  // O primeiro par, do Jorge.
  await page.getByTestId('courier-access-ent-jorge').click();
  const primeiro = await page.getByTestId('acesso-codigo').innerText();
  await page.getByTestId('acesso-confirmou').click();
  await page.getByTestId('acesso-fechar').click();

  const linhaJorge = page.locator('tbody tr').filter({ hasText: 'Jorge Lima' });
  await expect(linhaJorge).toContainText('Acesso gerado');

  // Agora ele TEM acesso, então o botão pergunta.
  await page.getByTestId('courier-access-ent-jorge').click();
  await page.getByTestId('courier-regerar-dialogo-confirmar').click();

  const segundo = await page.getByTestId('acesso-codigo').innerText();
  expect(segundo).not.toBe(primeiro);
});

/*
 * ============================================================================
 * AS RECUSAS
 * ============================================================================
 */

/*
 * 409 = ENTREGADOR INATIVO. A frase do backend já diz o que fazer ("Reative-o
 * antes"), e ela sobe inteira — reescrevê-la aqui seria duas fontes para a
 * mesma explicação.
 */
test('entregador inativo não ganha acesso, e a tela diz o que fazer', async ({ page }) => {
  await abrirEntregadores(page);

  // A Rita está desativada na semente.
  await page.getByTestId('courier-access-ent-rita').click();

  await expect(page.getByTestId('courier-acao-error')).toContainText('Reative');
  await expect(page.getByTestId('acesso-dialogo')).toHaveCount(0);
});

test('o backend recusando não abre diálogo nenhum', async ({ page }) => {
  await abrirEntregadores(page);

  await page.route('**/admin/couriers/*/access', (route) =>
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'Falha ao gerar o acesso.' }),
    }),
  );

  await page.getByTestId('courier-access-ent-jorge').click();

  await expect(page.getByTestId('courier-acao-error')).toBeVisible();
  await expect(page.getByTestId('acesso-dialogo')).toHaveCount(0);
});

/*
 * GERAR ACESSO É DA GERÊNCIA. O atendente lê a lista — é ele que está no balcão
 * quando o motoboy chega — e não distribui credencial.
 */
test('o atendente não vê o botão de gerar acesso', async ({ page }) => {
  api.entrarComoPapel('attendant');
  await abrirEntregadores(page);

  await expect(page.locator('tbody')).toContainText('Jorge Lima');
  await expect(page.getByTestId('courier-access-ent-jorge')).toHaveCount(0);
});
