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

  it('janela zerada ou negativa vale zero, e a barra nem aparece', () => {
    expect(razaoDeMaturacao(30, 0)).toBe(0);
    expect(razaoDeMaturacao(30, -10)).toBe(0);
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

  /*
   * O caso do piloto: churrascaria com janela de 100 minutos. É o número que
   * decide o comportamento real da tela, então ele é teste e não exemplo.
   */
  it('na janela de 100 min da churrascaria, vira âmbar aos 50 e vermelho aos 85', () => {
    expect(faixaDe(razaoDeMaturacao(49, 100))).toBe('ok');
    expect(faixaDe(razaoDeMaturacao(50, 100))).toBe('atencao');
    expect(faixaDe(razaoDeMaturacao(84, 100))).toBe('atencao');
    expect(faixaDe(razaoDeMaturacao(85, 100))).toBe('estourando');
  });
});
