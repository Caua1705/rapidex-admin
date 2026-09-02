/**
 * ============================================================================
 * O NAVEGADOR DO E2E VIVE NO FUSO DA OPERAÇÃO
 * ============================================================================
 *
 * A metade de navegador do que `src/fuso-do-portao.test.ts` prende no processo.
 * Sem o `timezoneId` do `playwright.config.ts`, o navegador herda o fuso da
 * máquina: UTC-3 no desenvolvedor, UTC no runner do CI — e a suíte que afirma
 * "18h UTC vira 15:00 na tela" passaria a afirmar coisas diferentes nos dois.
 *
 * ATENÇÃO AO QUE ESTE ARQUIVO NÃO COBRE: os handlers de `page.route` rodam no
 * processo do **Node**, não no navegador, e o `timezoneId` não chega neles. É
 * por isso que `fake-api.ts` conta "hoje" pelo `OPERATION_DAY` explícito em vez
 * de por `new Date()` — as duas metades do e2e precisam concordar sobre que dia
 * é hoje, e elas rodam em processos com fusos diferentes.
 */
import { expect, test } from '@playwright/test';

import { OPERATION_TIMEZONE } from '../src/orders/format';

test('o navegador do e2e roda no fuso da operação, e não no da máquina', async ({ page }) => {
  await page.goto('/login');

  const fuso = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  expect(fuso).toBe(OPERATION_TIMEZONE);

  /*
   * O RELÓGIO, e não só o nome do fuso. Um `timezoneId` que o navegador
   * aceitasse sem aplicar passaria na linha de cima e falharia aqui: 23h30 UTC
   * de 22/08/2026 são 20h30 em Fortaleza, e `getHours()` responde no fuso do
   * navegador.
   */
  const hora = await page.evaluate(() => new Date('2026-08-22T23:30:00Z').getHours());
  expect(hora).toBe(20);
});
