/**
 * AS CAPTURAS DE TELA — a prova visual da direção.
 *
 * Não é teste: não afirma nada e não falha por regressão. É o arnês que
 * fotografa as telas do painel nos dois tamanhos e nos dois temas, sempre com
 * o MESMO backend falso dos testes de ponta a ponta — que é o que faz as fotos
 * mostrarem dado de verdade em vez de esqueleto vazio.
 *
 * Ele fica DESLIGADO por padrão, e não roda no CI:
 *
 *   CAPTURAS=1 npx playwright test e2e/capturas.spec.ts --workers=1
 *
 * As imagens saem em `capturas/<tela>-<largura>-<tema>.png`, ignoradas pelo
 * git: elas são para olhar numa revisão, não para versionar.
 */
import { test, expect, type Page } from '@playwright/test';

import { installFakeApi, LOGIN_EMAIL, LOGIN_PASSWORD, type FakeApi } from './fake-api';
import { escolherFilial } from './seletor';

const LIGADO = process.env.CAPTURAS === '1';

const TAMANHOS = [
  { nome: '1440', width: 1440, height: 900 },
  { nome: '390', width: 390, height: 844 },
] as const;

const TEMAS = ['light', 'dark'] as const;

let api: FakeApi;

test.beforeEach(async ({ page }) => {
  test.skip(!LIGADO, 'Arnês de captura: rode com CAPTURAS=1.');
  api = await installFakeApi(page);
});

test.afterEach(() => {
  api?.stop();
});

async function entrar(page: Page, tema: (typeof TEMAS)[number]) {
  // O tema é decidido antes do primeiro pixel (ver o script em index.html), e
  // é a mesma chave que o painel usa.
  await page.addInitScript((valor) => {
    window.localStorage.setItem('rapidex-admin.theme', valor);
  }, tema);

  await page.goto('/pedidos');
  await page.getByLabel('E-mail').fill(LOGIN_EMAIL);
  await page.getByLabel('Senha').fill(LOGIN_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/pedidos$/);
}

async function fotografar(page: Page, nome: string, tamanho: string, tema: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(350);
  await page.screenshot({ path: `capturas/${nome}-${tamanho}-${tema}.png` });
}

for (const tamanho of TAMANHOS) {
  for (const tema of TEMAS) {
    test(`capturas ${tamanho.nome} ${tema}`, async ({ page }) => {
      test.setTimeout(180_000);
      await page.setViewportSize({ width: tamanho.width, height: tamanho.height });
      await entrar(page, tema);

      // Pedidos, sem o painel de detalhe: a lista inteira, sete colunas.
      await expect(page.getByTestId('board-lanes')).toBeVisible();
      await fotografar(page, 'pedidos', tamanho.nome, tema);

      // Pedidos com o detalhe aberto — no desktop é o caso em que a lista
      // encolhe e a linha troca para o layout compacto.
      await page.getByTestId('order-card-1002').click();
      await expect(page.getByTestId('order-panel')).toBeVisible();
      await fotografar(page, 'pedidos-detalhe', tamanho.nome, tema);
      await page.getByRole('button', { name: 'Fechar detalhe' }).click();

      // A filial resolvida: várias telas pedem uma escolhida.
      await escolherFilial(page);

      await page.goto('/cardapio');
      await expect(page.getByRole('heading', { name: 'Cardápio' })).toBeVisible();
      await fotografar(page, 'cardapio', tamanho.nome, tema);

      await page.goto('/clientes');
      await expect(page.getByRole('heading', { name: 'Clientes' })).toBeVisible();
      await fotografar(page, 'clientes', tamanho.nome, tema);

      /*
       * A AJUDA ABERTA — o estado que tirou dois parágrafos da frente da
       * tabela. No desktop é um balão ancorado no ícone; no celular ele deixa
       * de flutuar e vira uma fileira da faixa, na largura inteira.
       */
      await page.getByTestId('customers-ajuda').click();
      await expect(page.getByTestId('customers-nota-rfv')).toBeVisible();
      await fotografar(page, 'clientes-ajuda', tamanho.nome, tema);

      await page.goto('/desempenho');
      await expect(page.getByRole('heading', { name: 'Desempenho' })).toBeVisible();
      await fotografar(page, 'desempenho', tamanho.nome, tema);

      await page.goto('/minha-loja/operacao');
      await expect(page.getByRole('heading', { name: 'Minha loja' })).toBeVisible();
      await fotografar(page, 'minha-loja', tamanho.nome, tema);

      await page.goto('/minha-loja/geral');
      await expect(page.getByRole('heading', { name: 'Minha loja' })).toBeVisible();
      await fotografar(page, 'minha-loja-geral', tamanho.nome, tema);

      /*
       * IMPRESSÃO ENTROU NO ARNÊS nesta rodada, e não por ser mais uma seção: é
       * a tela com mais peças de estado por centímetro do painel — o ponto do
       * programa, a lista da máquina, o seletor de impressora em cada linha de
       * setor e a resposta do teste. Ela é usada EM PÉ, no balcão, e é onde o
       * aperto do celular aparece primeiro.
       */
      await page.goto('/minha-loja/impressao');
      await expect(page.getByTestId('print-agent-status')).toBeVisible();
      await fotografar(page, 'minha-loja-impressao', tamanho.nome, tema);

      // A Cozinha tem PALETA própria (saturada, para leitura a dois metros) mas
      // segue o tema como todas as outras: acesa sobre carvão no escuro, funda
      // sobre papel no claro. As duas fotos dela são diferentes, e é isso que a
      // captura documenta.
      await page.goto('/cozinha');
      await expect(page.getByRole('heading', { name: 'Cozinha' })).toBeVisible();
      await fotografar(page, 'cozinha', tamanho.nome, tema);

      // "Em breve": o estado honesto, que também precisa pertencer ao sistema.
      await page.goto('/cupons');
      await expect(page.getByRole('heading', { name: 'Cupons' })).toBeVisible();
      await fotografar(page, 'em-breve', tamanho.nome, tema);
    });
  }
}
