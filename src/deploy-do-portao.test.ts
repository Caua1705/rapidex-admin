import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * ============================================================================
 * O DEPLOY NÃO PODE SAIR NA FRENTE DO PORTÃO
 * ============================================================================
 *
 * A integração Git da Vercel publica no INSTANTE do push. O `ci.yml` roda
 * `on: push: branches: [main]` — ele CONFERE, ele não publica, e a Vercel não
 * esperava por ele. Os dois corriam em paralelo, e nada impedia o painel do
 * lojista de subir com o portão vermelho.
 *
 * AQUI ISSO É PIOR QUE NO APP DO CLIENTE, e a razão está no CLAUDE.md: a regra
 * deste repositório é commitar e empurrar DIRETO NA MAIN, sem branch e sem PR.
 * "Não há branch intermediária para segurar nada" — o que também quer dizer que
 * não há proteção de branch para pendurar o check em cima.
 *
 * A TRAVA TEM DUAS METADES, e meia trava é pior que nenhuma porque parece uma:
 *
 *   1. `vercel.json` traz `git.deploymentEnabled.main = false`;
 *   2. `ci.yml` publica, num job que depende dos DOIS portões.
 *
 * Este teste existe para que religar a metade 1 no painel da Vercel, ou apagar
 * a metade 2 num refactor de CI, não passe em silêncio. Ele é a cópia do
 * `deploy-gate.test.js` do `pedeaqui_front`, que fechou o mesmo buraco em
 * 31/08/2026 — e a diferença que importa está no terceiro caso: lá o deploy
 * depende de um job, aqui de dois.
 */
const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const vercel = JSON.parse(readFileSync(resolve(raiz, 'vercel.json'), 'utf8')) as {
  git?: { deploymentEnabled?: Record<string, boolean> };
};
const ci = readFileSync(resolve(raiz, '.github', 'workflows', 'ci.yml'), 'utf8');

describe('o deploy espera o portão', () => {
  it('a main não publica sozinha', () => {
    expect(vercel.git?.deploymentEnabled?.main).toBe(false);
  });

  /*
   * `deploymentEnabled` desliga SÓ as branches nomeadas. Um `false` de outra
   * branch escrito aqui mataria o preview junto — e preview é o único jeito de
   * olhar uma tela deste painel sem publicá-la para o lojista.
   */
  it('o preview das outras branches continua ligado', () => {
    expect(Object.keys(vercel.git?.deploymentEnabled ?? {})).toEqual(['main']);
  });

  /*
   * OS DOIS PORTÕES, e não um. `verificar` roda format, lint, tipos, testes e
   * build; `e2e` roda o Playwright contra o falso. Eles são jobs IRMÃOS e
   * correm em paralelo — um deploy que dependesse só do primeiro publicaria com
   * o e2e vermelho, que é metade do buraco de volta.
   */
  it('quem publica é o CI, e ele depende dos DOIS portões', () => {
    expect(ci, 'não há job de deploy').toMatch(/^ {2}deploy:/m);
    expect(ci, 'o deploy não depende de `verificar`').toMatch(/needs:[^\n]*verificar/);
    expect(ci, 'o deploy não depende de `e2e`').toMatch(/needs:[^\n]*e2e/);
    expect(ci, 'o deploy não está preso à main').toMatch(/refs\/heads\/main/);
    expect(ci, 'nada publica de fato').toMatch(/vercel[^\n]*deploy[^\n]*--prod/);
  });

  /*
   * SEM O SEGREDO O JOB FALHA, em vez de ficar verde sem ter publicado.
   *
   * Um `if:` que apenas pulasse o passo devolveria o buraco inteiro pelo outro
   * lado: o CI verde, ninguém olhando, e a produção parada no commit anterior
   * sem uma linha dizendo por quê.
   */
  it('sem os segredos o job FALHA, em vez de ficar verde sem ter publicado', () => {
    expect(ci).toMatch(/VERCEL_TOKEN/);
    expect(ci).toMatch(/VERCEL_ORG_ID/);
    expect(ci).toMatch(/VERCEL_PROJECT_ID/);
    expect(ci).toMatch(/::error::/);
  });

  /*
   * A VARIÁVEL QUE SOME EM SILÊNCIO.
   *
   * `VITE_COURIER_APP_URL` não tem padrão de propósito (`vite-env.d.ts`):
   * faltando ela, o painel simplesmente NÃO OFERECE o botão de gerar acesso do
   * entregador. O Vite inlina `import.meta.env` no bundle, então configurá-la
   * no painel da Vercel depois não muda nada — ela precisa existir na hora do
   * build.
   *
   * `VITE_API_BASE_URL` não entra nesta régua: `client.ts` tem o mesmo valor de
   * produção como padrão, e ausente ela não muda o bundle.
   */
  it('avisa quando o build vai subir sem o domínio do app do entregador', () => {
    expect(ci).toMatch(/VITE_COURIER_APP_URL/);
    expect(ci).toMatch(/::warning::/);
  });
});
