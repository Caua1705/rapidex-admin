import { describe, expect, it } from 'vitest';

import { faixaDe, razaoDeMaturacao } from './maturation';

/*
 * A única regra de negócio do design system: quando o fio do ticket muda de
 * cor. Ela decide o que a cozinha olha primeiro numa fila de trinta pedidos,
 * então os limites são testados nos dois lados de cada borda.
 */
describe('maturação', () => {
  it('a razão é o quanto da janela já passou', () => {
    expect(razaoDeMaturacao(50, 100)).toBe(0.5);
    expect(razaoDeMaturacao(45, 90)).toBe(0.5);
  });

  it('não passa de 100%: pedido atrasado não estica a barra', () => {
    expect(razaoDeMaturacao(300, 100)).toBe(1);
  });

  it('não fica negativa com relógio fora de hora', () => {
    expect(razaoDeMaturacao(-5, 100)).toBe(0);
  });

  /*
   * ESTE CASO MUDOU DE FORMA, e o requisito dele é o mesmo: "a barra nem
   * aparece". Ele afirmava ZERO, e quem fazia a barra sumir era um segundo
   * `if (!windowMinutes)` dentro do componente — a mesma regra escrita em dois
   * lugares, e o zero aqui só não dava problema por acidente.
   *
   * Agora a régua responde `null` para "não há o que desenhar", o componente
   * apenas obedece, e a distinção fica de pé: `0` é uma razão de verdade (o
   * pedido acabou de entrar), `null` é a ausência.
   */
  it('janela zerada, negativa ou ausente não tem barra — e isso não é zero', () => {
    expect(razaoDeMaturacao(30, 0)).toBeNull();
    expect(razaoDeMaturacao(30, -10)).toBeNull();
    expect(razaoDeMaturacao(30, null)).toBeNull();
  });

  it('até 50% está no prazo', () => {
    expect(faixaDe(0)).toBe('ok');
    expect(faixaDe(0.49)).toBe('ok');
  });

  it('a partir de 50% é hora de olhar', () => {
    expect(faixaDe(0.5)).toBe('atencao');
    expect(faixaDe(0.84)).toBe('atencao');
  });

  it('a partir de 85% está estourando', () => {
    expect(faixaDe(0.85)).toBe('estourando');
    expect(faixaDe(1)).toBe('estourando');
  });

  /**
   * A razão, exigindo que ela exista.
   *
   * `razaoDeMaturacao` devolve `null` para "não há o que desenhar" (sem hora
   * de entrada ou sem janela). Estes casos passam os dois, então `null` aqui é
   * o teste falhando por outro motivo — e o `throw` diz isso em vez de deixar
   * um `!` esconder a diferença.
   */
  function razao(minutos: number, janela: number): number {
    const r = razaoDeMaturacao(minutos, janela);
    if (r === null) throw new Error(`razão nula para ${minutos} min em janela de ${janela}`);
    return r;
  }
  /*
   * O caso do piloto: churrascaria com janela de 100 minutos. É o número que
   * decide o comportamento real da tela, então ele é teste e não exemplo.
   */
  it('na janela de 100 min da churrascaria, vira âmbar aos 50 e vermelho aos 85', () => {
    expect(faixaDe(razao(49, 100))).toBe('ok');
    expect(faixaDe(razao(50, 100))).toBe('atencao');
    expect(faixaDe(razao(84, 100))).toBe('atencao');
    expect(faixaDe(razao(85, 100))).toBe('estourando');
  });
});

/* ==========================================================================
 * TEMPO DESCONHECIDO NÃO É "AGORA" — a família do `new Date(null)`
 *
 * `created_at` é `string | null` no contrato. `OrderLine` fazia
 * `elapsedMinutes(order.created_at) ?? 0`, e ZERO é o pedido mais fresco
 * possível: a barra de maturação nascia vazia e verde para um pedido cuja hora
 * de entrada ninguém sabe.
 *
 * A Cozinha, sobre o MESMO dado, já respondia `level: 'unknown'` e um travessão
 * (`wait-time.ts`). Duas telas discordando sobre o mesmo pedido — e a que
 * mentia era a lista, que é a que se olha no meio do turno.
 * ======================================================================= */

describe('maturação com tempo desconhecido', () => {
  it('sem minutos, a barra não é desenhada — como já acontece sem janela', () => {
    expect(razaoDeMaturacao(null, 40)).toBeNull();
  });

  it('zero minutos continua sendo um pedido de verdade, e desenha vazia', () => {
    expect(razaoDeMaturacao(0, 40)).toBe(0);
  });
});
