/**
 * O CRITÉRIO DE PRONTO, medido.
 *
 * As perguntas da revisão de acabamento que uma máquina consegue responder
 * melhor que o olho, varridas em TODAS as rotas do painel:
 *
 *   - sobrou controle nativo de formulário?
 *   - todo elemento interativo tem foco visível?
 *   - algum texto trunca com espaço de sobra ao lado?
 *   - o alvo de toque mínimo (WCAG 2.5.8) é respeitado no celular?
 *
 * O que ele NÃO responde continua sendo trabalho de olhar o print: hierarquia,
 * ritmo e se uma cor está lá por decoração. Isto aqui é a régua das coisas
 * objetivas, para que elas não voltem sem ninguém perceber.
 */
import { expect, test, type Page } from '@playwright/test';

import { installFakeApi, LOGIN_EMAIL, LOGIN_PASSWORD, type FakeApi } from '../../e2e/fake-api';
import { escolherFilial } from '../../e2e/seletor';

const ROTAS = ['/pedidos', '/cardapio', '/minha-loja', '/cozinha', '/clientes'];

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

test('nenhuma tela usa controle nativo de formulário', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await entrar(page);
  await escolherFilial(page);

  for (const rota of ROTAS) {
    await page.goto(rota);
    await page.waitForLoadState('networkidle').catch(() => undefined);

    // <select> abre o menu do sistema operacional: nenhum sobrevive no painel.
    await expect(page.locator('select'), `<select> nativo em ${rota}`).toHaveCount(0);

    /*
     * A caixa de marcar e o rádio continuam sendo <input> — é dele que vêm o
     * teclado e o leitor de tela. O que não pode é ele DESENHAR: com
     * `appearance: none`, quem desenha é o design system, e a cor do sistema
     * operacional (`accent-color`) some.
     */
    const nativos = await page
      .locator('input[type=checkbox], input[type=radio]')
      .evaluateAll((nodes) =>
        nodes.filter((node) => getComputedStyle(node).appearance !== 'none').length,
      );
    expect(nativos, `caixa de marcar do sistema em ${rota}`).toBe(0);
  }

  // O diálogo do item é uma tela inteira que não tem rota própria.
  await page.goto('/cardapio');
  await page.getByRole('button', { name: 'Editar X-Burger Clássico' }).click();
  await expect(page.locator('select')).toHaveCount(0);
});

test('todo elemento interativo tem anel de foco visível', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await entrar(page);
  await escolherFilial(page);

  for (const rota of ROTAS) {
    await page.goto(rota);
    await page.waitForLoadState('networkidle').catch(() => undefined);

    /*
     * O reset declara `:focus-visible { outline }` para todo mundo, mas uma
     * regra de componente pode zerá-lo sem querer. A varredura pega isso:
     * foca cada alvo por teclado e mede o outline que sobrou.
     */
    const semAnel = await page.evaluate(() => {
      const alvos = [...document.querySelectorAll<HTMLElement>('button, a[href], input, textarea')];
      const falhas: string[] = [];
      for (const alvo of alvos) {
        if (alvo.hasAttribute('disabled') || alvo.offsetParent === null) continue;
        alvo.focus();
        const estilo = getComputedStyle(alvo);
        const largura = Number.parseFloat(estilo.outlineWidth);
        const temAnelProprio = largura > 0 && estilo.outlineStyle !== 'none';
        // O campo pode delegar o anel à caixa em volta (`.ds-control`).
        const caixa = alvo.closest('.ds-control');
        const temAnelDaCaixa =
          caixa !== null && Number.parseFloat(getComputedStyle(caixa).outlineWidth) > 0;
        if (!temAnelProprio && !temAnelDaCaixa) {
          falhas.push(`${alvo.tagName.toLowerCase()}.${alvo.className || '(sem classe)'}`);
        }
      }
      return falhas;
    });

    expect(semAnel, `sem foco visível em ${rota}`).toEqual([]);
  }
});

test('nenhum texto é cortado com espaço de sobra ao lado', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await entrar(page);
  await escolherFilial(page);

  for (const rota of ROTAS) {
    await page.goto(rota);
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await page.waitForTimeout(400);

    /*
     * Truncar é legítimo quando falta espaço; o defeito é truncar quando SOBRA.
     * A medida: um elemento com reticências cujo PAI ainda tem folga horizontal
     * de mais de 24px estava apertado à toa.
     */
    const cortados = await page.evaluate(() => {
      const falhas: string[] = [];
      for (const alvo of document.querySelectorAll<HTMLElement>('*')) {
        const estilo = getComputedStyle(alvo);
        if (estilo.textOverflow !== 'ellipsis' || estilo.overflow === 'visible') continue;
        if (alvo.scrollWidth <= alvo.clientWidth + 1) continue;

        const pai = alvo.parentElement;
        if (!pai) continue;
        const folga = pai.clientWidth - pai.scrollWidth;
        if (folga > 24) {
          falhas.push(`${alvo.className || alvo.tagName} (folga de ${Math.round(folga)}px)`);
        }
      }
      return falhas;
    });

    expect(cortados, `texto cortado com espaço de sobra em ${rota}`).toEqual([]);
  }
});

test('no celular, todo alvo tem 24px de lado (WCAG 2.5.8)', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await entrar(page);

  for (const rota of ROTAS) {
    await page.goto(rota);
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await page.waitForTimeout(400);

    const pequenos = await page.evaluate(() => {
      const falhas: string[] = [];
      for (const alvo of document.querySelectorAll<HTMLElement>('button, a[href], [role=switch]')) {
        if (alvo.hasAttribute('disabled') || alvo.offsetParent === null) continue;
        const caixa = alvo.getBoundingClientRect();
        if (caixa.width === 0 || caixa.height === 0) continue;
        if (caixa.width < 24 || caixa.height < 24) {
          falhas.push(
            `${alvo.tagName.toLowerCase()}.${alvo.className} ` +
              `(${Math.round(caixa.width)}×${Math.round(caixa.height)})`,
          );
        }
      }
      return falhas;
    });

    expect(pequenos, `alvo pequeno demais em ${rota}`).toEqual([]);
  }
});

for (const tema of ['light', 'dark'] as const) {
  test(`checkbox e rádio marcados não usam a brasa (tema ${tema})`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    // O tema é lido do localStorage antes do primeiro pixel (script do
    // index.html) — precisa estar gravado antes da primeira navegação.
    await page.addInitScript(
      (t) => window.localStorage.setItem('rapidex-admin.theme', t),
      tema,
    );
    await entrar(page);
    await escolherFilial(page);
    await page.goto('/minha-loja');
    await page.waitForLoadState('networkidle').catch(() => undefined);

    /*
     * A brasa é avara (§4 do SKILL): botão primário, item ativo de navegação
     * e anel de foco — nada mais. Um checkbox/rádio marcado é o quarto uso que
     * já vazou uma vez (ds/Choice.css). A régua compara a cor computada do
     * controle marcado contra `--ember` resolvido no tema, via uma sonda no
     * DOM — comparar strings de `var()` direto não funciona pós-computação.
     */
    const vazamentos = await page.evaluate(() => {
      const emberValor = getComputedStyle(document.documentElement)
        .getPropertyValue('--ember')
        .trim();
      const sonda = document.createElement('div');
      sonda.style.color = emberValor;
      document.body.appendChild(sonda);
      const emberComputado = getComputedStyle(sonda).color;
      sonda.remove();

      const falhas: string[] = [];
      for (const caixa of document.querySelectorAll<HTMLElement>(
        '.ds-choice__box:checked, .ds-choice__box--check:indeterminate',
      )) {
        const estilo = getComputedStyle(caixa);
        if (estilo.backgroundColor === emberComputado || estilo.borderColor === emberComputado) {
          falhas.push(caixa.className);
        }
      }
      return falhas;
    });

    expect(vazamentos, `checkbox/rádio em brasa no tema ${tema}`).toEqual([]);

    // Confere que a régua não está testando um conjunto vazio por acidente.
    const marcados = await page.locator('.ds-choice__box:checked').count();
    expect(marcados, `nenhum checkbox marcado encontrado para testar (tema ${tema})`).toBeGreaterThan(
      0,
    );
  });
}
