import { describe, expect, it } from 'vitest';

import type { BranchOperation } from '../api/types';
import { estaNoAr, situacaoDaFilial } from './operation-state';

function filial(overrides: Partial<BranchOperation> = {}): BranchOperation {
  return {
    branch_id: 'b-1',
    branch_name: 'Aldeota',
    is_open: true,
    is_open_now: true,
    accepts_delivery: true,
    /*
     * A PAUSA DE ENTREGA entrou numa rodada do backend que este painel ainda
     * não lê. `accepts_delivery_now` é o `accepts_delivery` já descontada a
     * pausa temporária; sem pausa, os dois são iguais — que é o estado em que
     * a migração cria as filiais e o único que estes testes ensaiam.
     */
    accepts_delivery_now: true,
    accepts_pickup: true,
    overrides: {},
    /*
     * `free_delivery_enabled` entrou no `effective` numa rodada de ENTREGA do
     * backend, e o painel ainda não a lê. Ela está aqui porque o contrato a
     * exige, e com o valor que a migração dá — desligada: um fixture que a
     * afirmasse ligada faria este teste ensaiar uma operação que não existe.
     */
    effective: {
      min_order_value: 20,
      service_fee_enabled: true,
      service_fee_amount: 2,
      free_delivery_enabled: false,
    },
    ...overrides,
  };
}

describe('a situação de uma filial', () => {
  it('é "no ar" só com a chave ligada, o horário aberto e uma forma de comprar', () => {
    expect(situacaoDaFilial(filial())).toBe('no-ar');
    expect(estaNoAr(filial())).toBe(true);
  });

  it('é "fechada" quando a chave está desligada', () => {
    expect(situacaoDaFilial(filial({ is_open: false }))).toBe('fechada');
  });

  it('é "fora do horário" com a chave ligada e a agenda de hoje fechada', () => {
    expect(situacaoDaFilial(filial({ is_open_now: false }))).toBe('fora-do-horario');
  });

  /*
   * O ESTADO SEM SAÍDA VISUAL, e o motivo deste arquivo existir.
   *
   * Desligar entrega e retirada equivale a fechar a loja, mas não fica igual a
   * fechar: a chave continua ligada e a linha diria "aberta" enquanto ninguém
   * consegue comprar.
   */
  it('não está no ar sem entrega e sem retirada, mesmo com a chave ligada', () => {
    const parada = filial({ accepts_delivery: false, accepts_pickup: false });

    expect(situacaoDaFilial(parada)).toBe('sem-forma-de-comprar');
    expect(estaNoAr(parada)).toBe(false);
    expect(parada.is_open).toBe(true);
  });

  it('uma forma de comprar basta: só retirada continua no ar', () => {
    expect(situacaoDaFilial(filial({ accepts_delivery: false }))).toBe('no-ar');
    expect(situacaoDaFilial(filial({ accepts_pickup: false }))).toBe('no-ar');
  });

  /*
   * "Fora do horário" passa sozinho quando o relógio virar; "sem forma de
   * comprar" só passa quando alguém religar uma das duas. Valendo os dois, a
   * tela diz o que precisa de gente.
   */
  it('valendo os dois, fala o que precisa de gente', () => {
    expect(
      situacaoDaFilial(
        filial({ is_open_now: false, accepts_delivery: false, accepts_pickup: false }),
      ),
    ).toBe('sem-forma-de-comprar');
  });

  it('a chave desligada ganha de tudo: é o que o próprio controle já responde', () => {
    expect(
      situacaoDaFilial(filial({ is_open: false, is_open_now: false, accepts_delivery: false })),
    ).toBe('fechada');
  });

  it('sem leitura não afirma nada, e o ponto não acende', () => {
    expect(situacaoDaFilial(null)).toBe('desconhecida');
    expect(estaNoAr(null)).toBe(false);
  });
});
