import { describe, expect, it } from 'vitest';

import { OPERATION_TIMEZONE } from './orders/format';

/**
 * ============================================================================
 * O PORTÃO RODA NO FUSO DA OPERAÇÃO — e este arquivo é quem garante isso
 * ============================================================================
 *
 * Até esta rodada, nenhum dos dois portões dizia nada sobre fuso. A máquina do
 * desenvolvedor é UTC-3 e o runner do CI (`ubuntu-latest`) é **UTC**: três horas
 * de desacordo entre as duas metades do portão, num painel cujo produto conta o
 * dia em `America/Fortaleza`.
 *
 * Nada estava vermelho por causa disso, e **é exatamente esse o problema**: um
 * teste que muda de resposta conforme QUEM o roda não é portão, é dado.
 *
 * ----------------------------------------------------------------------------
 * POR QUE ISTO É UM TESTE, E NÃO UM COMENTÁRIO NO CONFIG
 * ----------------------------------------------------------------------------
 *
 * O pino mora em `vite.config.ts` (`process.env.TZ`), e um pino que ninguém
 * verifica é um pino que some numa refatoração do config sem nada acender —
 * exatamente como o `format:check` ficou semanas vermelho sem ninguém reparar.
 *
 * Estes três casos falham ALTO se ele sumir, e a mensagem aponta para o
 * arquivo certo em vez de deixar a próxima pessoa procurar por que um teste de
 * horário quebrou só no CI.
 *
 * ----------------------------------------------------------------------------
 * E POR QUE `process.env.TZ` NO CONFIG, E NÃO `TZ=` NO SHELL
 * ----------------------------------------------------------------------------
 *
 * Porque o shell **não chega ao worker**. Foi medido nesta rodada: rodando
 * `TZ=Asia/Tokyo npx vitest run`, o worker respondia
 * `process.env.TZ === undefined` e continuava no fuso da máquina — e a suíte
 * passava, dando a impressão de que o experimento tinha provado alguma coisa.
 * O terceiro caso abaixo é o que prende essa lição: ele não olha a variável, ele
 * olha o RELÓGIO.
 */
describe('o fuso do portão', () => {
  it('é o fuso da operação, e não o da máquina de quem roda', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(OPERATION_TIMEZONE);
  });

  it('está declarado no ambiente do processo — ver `process.env.TZ` em vite.config.ts', () => {
    expect(process.env.TZ).toBe(OPERATION_TIMEZONE);
  });

  /*
   * O CASO QUE NÃO ACEITA CONVERSA. Os dois de cima leem o que o processo DIZ
   * de si; este lê o que ele FAZ. Um `TZ` presente no ambiente mas que não
   * chegou ao relógio — o caso do shell no Windows, e do config carregado tarde
   * demais — passa nos dois primeiros e falha aqui.
   *
   * 23h30 UTC de 22/08/2026 são 20h30 em Fortaleza. `getHours()` responde no
   * fuso do processo, então 20 é a única resposta certa.
   */
  it('o RELÓGIO do processo está no fuso, não só a variável de ambiente', () => {
    // fuso-ok: é justamente o fuso do processo que este caso mede.
    expect(new Date('2026-08-22T23:30:00Z').getHours()).toBe(20);
  });
});
