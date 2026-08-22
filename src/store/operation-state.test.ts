import { describe, expect, it } from 'vitest';

import type { BranchOperation } from '../api/types';
import { estaNoAr, notaDaPausa, pausaAtiva, situacaoDaFilial } from './operation-state';

/**
 * Uma linha de operação para o teste.
 *
 * `accepts_delivery_now` é DERIVADO de `accepts_delivery` quando ninguém o
 * escreve, e não fixo em `true`: ele é a chave já descontada a pausa, então
 * "não faz entrega" e "aceita entrega agora" é um estado que não existe. Com
 * ele fixo, um teste que desligasse só a chave ensaiaria uma loja impossível — e
 * foi exatamente o que aconteceu quando a situação passou a ler o campo certo.
 */
function filial(overrides: Partial<BranchOperation> = {}): BranchOperation {
  const aceitaEntrega = overrides.accepts_delivery ?? true;
  return {
    branch_id: 'b-1',
    branch_name: 'Aldeota',
    is_open: true,
    is_open_now: true,
    accepts_delivery: aceitaEntrega,
    accepts_delivery_now: aceitaEntrega,
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

/* ==========================================================================
 * A PAUSA DA ENTREGA — o estado que volta sozinho
 *
 * `accepts_delivery` é estrutural e espera alguém religar; a pausa é do momento
 * e vence no relógio. Confundir os dois é o que faz uma loja amanhecer aberta
 * sem aceitar entrega, com a ausência de pedido como único sintoma.
 * ======================================================================= */

const AGORA = new Date('2026-08-22T19:10:00-03:00');

describe('a pausa da entrega', () => {
  it('está ativa enquanto o prazo não venceu', () => {
    const linha = filial({ delivery_paused_until: '2026-08-22T20:30:00-03:00' });
    expect(pausaAtiva(linha, AGORA)).not.toBeNull();
  });

  /* Ela se desfaz SOZINHA: quem lê compara com o relógio, não com um booleano. */
  it('deixa de existir quando o prazo passa, sem ninguém mexer', () => {
    const linha = filial({ delivery_paused_until: '2026-08-22T19:00:00-03:00' });
    expect(pausaAtiva(linha, AGORA)).toBeNull();
  });

  it('sem prazo gravado não há pausa', () => {
    expect(pausaAtiva(filial(), AGORA)).toBeNull();
  });

  it('a frase leva o horário de volta, e o motivo quando existe', () => {
    expect(
      notaDaPausa(
        filial({
          delivery_paused_until: '2026-08-22T20:30:00-03:00',
          delivery_pause_reason: 'chuva forte',
        }),
        AGORA,
      ),
    ).toBe('Pausada até 20:30 · chuva forte');

    expect(
      notaDaPausa(filial({ delivery_paused_until: '2026-08-22T20:30:00-03:00' }), AGORA),
    ).toBe('Pausada até 20:30');
  });
});

describe('a situação lê "aceita agora", não "aceita"', () => {
  /*
   * A loja faz entrega (a chave está ligada) e não faz retirada. Com a entrega
   * pausada, ninguém consegue comprar AGORA — e um ponto que olhasse
   * `accepts_delivery` continuaria verde.
   */
  it('entrega pausada e sem retirada é "ninguém consegue comprar"', () => {
    const linha = filial({
      accepts_delivery: true,
      accepts_delivery_now: false,
      accepts_pickup: false,
    });
    expect(situacaoDaFilial(linha)).toBe('sem-forma-de-comprar');
  });

  it('mas a loja continua no ar quando a retirada segue de pé', () => {
    const linha = filial({
      accepts_delivery: true,
      accepts_delivery_now: false,
      accepts_pickup: true,
    });
    expect(situacaoDaFilial(linha)).toBe('no-ar');
  });
});
