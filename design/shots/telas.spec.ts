/**
 * Fotografa cada tela do painel em 1440px e em 390px.
 *
 * É a régua da rodada de design: depois de cada bloco de mudança, roda-se isto
 * e compara-se o antes/depois lado a lado. Não afirma nada — quem julga é quem
 * olha —, por isso não tem `expect` de aparência.
 *
 * Saída: `design/shots/out/<SHOT_TAG>/<tela>-<largura>.png`.
 */
import { test, type Page } from '@playwright/test';

import { installFakeApi, LOGIN_EMAIL, LOGIN_PASSWORD, type FakeApi } from '../../e2e/fake-api';
import { escolherFilial } from '../../e2e/seletor';

const TAG = process.env.SHOT_TAG ?? 'atual';

/**
 * As duas larguras do critério de pronto, e o tema de cada uma.
 *
 * O 1440 sai nos dois temas: o escuro é o padrão do design system, o claro é o
 * que o lojista da loja com janela usa — e é onde um contraste frouxo aparece
 * primeiro. O 390 sai só no claro para o lote não dobrar de tamanho à toa.
 */
const VIEWPORTS = [
  { name: '1440', width: 1440, height: 900, theme: 'dark' },
  { name: '1440-claro', width: 1440, height: 900, theme: 'light' },
  { name: '390', width: 390, height: 844, theme: 'light' },
];

/** As telas com rota própria. A cozinha é tela cheia, sem a moldura. */
const TELAS = [
  { slug: 'pedidos', path: '/pedidos' },
  { slug: 'cardapio', path: '/cardapio' },
  { slug: 'minha-loja', path: '/minha-loja' },
  { slug: 'cozinha', path: '/cozinha' },
  { slug: 'clientes', path: '/clientes' },
];

let api: FakeApi;

test.beforeEach(async ({ page }) => {
  api = await installFakeApi(page);
});

test.afterEach(() => {
  api.stop();
});

async function entrar(page: Page) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(LOGIN_EMAIL);
  await page.getByLabel('Senha').fill(LOGIN_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/\/pedidos$/);
}

for (const viewport of VIEWPORTS) {
  test(`prints em ${viewport.name}px`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    // O tema é lido do localStorage antes do primeiro pixel (script do
    // index.html), então basta gravá-lo antes de a página carregar.
    await page.addInitScript(
      (theme) => window.localStorage.setItem('rapidex-admin.theme', theme),
      viewport.theme,
    );
    await entrar(page);

    for (const tela of TELAS) {
      await page.goto(tela.path);
      // Sem rede pendente e com um quadro já pintado: o print sai da tela
      // pronta, não do esqueleto de carregamento.
      await page.waitForLoadState('networkidle').catch(() => undefined);
      await page.waitForTimeout(600);
      await page.screenshot({
        // Relativo ao diretório de onde o playwright é chamado (a raiz do repo).
        path: `design/shots/out/${TAG}/${tela.slug}-${viewport.name}.png`,
        fullPage: false,
      });
    }

    /*
     * Os dois estados que não têm rota própria e mesmo assim são tela: o painel
     * de detalhe do pedido e um diálogo. Sem eles, metade do que se redesenha
     * numa rodada de design nunca aparece no lote de prints.
     */
    await page.goto('/pedidos');
    await page.getByTestId('order-card-1002').click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `design/shots/out/${TAG}/pedido-detalhe-${viewport.name}.png` });

    await page.goto('/cardapio');
    await page.getByRole('button', { name: 'Editar X-Burger Clássico' }).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `design/shots/out/${TAG}/item-dialogo-${viewport.name}.png` });

    /*
     * Minha loja é uma COLUNA ÚNICA: as seis seções são formulários inteiros,
     * cada um com a sua grade, e agora todos estão na mesma página. O print de
     * cada âncora continua existindo porque a conferência de alinhamento é por
     * seção — o que mudou é que chegar nelas é rolar, não trocar de aba.
     */
    await page.goto('/minha-loja');
    await escolherFilial(page);
    for (const secao of ['filial', 'horarios', 'entrega', 'pagamento', 'impressao']) {
      await page.getByTestId(`store-anchor-${secao}`).click();
      await page.waitForTimeout(400);
      await page.screenshot({
        path: `design/shots/out/${TAG}/loja-${secao}-${viewport.name}.png`,
      });
    }
  });
}
