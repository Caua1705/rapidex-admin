import { describe, expect, it } from 'vitest';

import {
  fraseDaRecusa,
  podeReceberEntregador,
  quemEstaCom,
  resumoDoLote,
  type AlvoDaRecusa,
} from './assignment-model';
import type { AssignmentResultItem, OrderCourier, OrderListItem } from '../api/types';

function pedido(overrides: Partial<OrderListItem> = {}): OrderListItem {
  return {
    id: 'ped-1',
    branch_id: 'fil-1',
    order_number: 1042,
    order_type: 'delivery',
    status: 'preparing',
    payment_status: 'paid',
    payment_method: 'pix',
    total: 50,
    customer_name_snapshot: 'Ana',
    customer_phone_snapshot: '85999990000',
    created_at: null,
    courier_id: null,
    courier_name: null,
    ...overrides,
  };
}

function item(overrides: Partial<AssignmentResultItem> = {}): AssignmentResultItem {
  return { order_id: 'ped-1', ok: true, assignment: null, error: null, ...overrides };
}

const ALVO: AlvoDaRecusa = { entregador: 'Jorge', filialDoEntregador: 'Aldeota' };

/*
 * ============================================================================
 * O BOTÃO NÃO É OFERECIDO ONDE A RESPOSTA SERIA "NÃO"
 * ============================================================================
 *
 * `not_delivery` e `order_closed` são recusas que a TELA já sabe prever: o tipo
 * e o status estão na linha. Oferecer o botão para depois explicar por que ele
 * não funcionou é pior que não oferecê-lo — o lojista clica, lê, e aprende que
 * o painel promete o que não cumpre.
 *
 * As outras duas (`not_found`, `other_branch`) dependem de escopo e de filial,
 * e essas a tela não tem como prever sozinha em todo caso — por isso as frases
 * existem.
 */
describe('podeReceberEntregador', () => {
  it('pedido de entrega em andamento aceita', () => {
    expect(podeReceberEntregador(pedido())).toBe(true);
  });

  it('RETIRADA não recebe entregador, e o botão nem aparece', () => {
    expect(podeReceberEntregador(pedido({ order_type: 'pickup' }))).toBe(false);
  });

  it('pedido que já terminou não recebe — nos três jeitos de terminar', () => {
    expect(podeReceberEntregador(pedido({ status: 'completed' }))).toBe(false);
    expect(podeReceberEntregador(pedido({ status: 'cancelled' }))).toBe(false);
    expect(podeReceberEntregador(pedido({ status: 'rejected' }))).toBe(false);
  });

  it('pendente ainda não foi aceito, mas é entrega e vai andar: aceita', () => {
    expect(podeReceberEntregador(pedido({ status: 'pending' }))).toBe(true);
  });
});

/*
 * ============================================================================
 * OS DOIS CAMPOS NULOS SÃO 200, E SIGNIFICAM "NINGUÉM AINDA"
 * ============================================================================
 *
 * É estado NORMAL do pedido, e não erro. 404 é outra coisa — o pedido que este
 * lojista não alcança —, e confundir os dois faria a tela mostrar "não
 * encontrado" no pedido que está aberto na frente dela.
 */
describe('quemEstaCom', () => {
  it('os dois nulos é "ninguém ainda", e não falha', () => {
    const resposta: OrderCourier = { courier: null, assignment: null };
    expect(quemEstaCom(resposta)).toBeNull();
  });

  it('com entregador, devolve quem é', () => {
    const resposta = {
      courier: {
        id: 'ent-1',
        branch_id: 'fil-1',
        name: 'Jorge',
        phone: '85999990000',
        is_active: true,
        has_access: true,
        access_generated_at: null,
        created_at: null,
      },
      assignment: null,
    } as OrderCourier;
    expect(quemEstaCom(resposta)?.name).toBe('Jorge');
  });

  /*
   * A LEITURA QUE NÃO VOLTOU NÃO É "NINGUÉM". `undefined` é ausência de fato, e
   * `null` é o fato "ninguém pegou" — a distinção que esta rodada aprendeu a
   * levar a sério, e que aqui separa "atribua alguém" de "não sei ainda".
   */
  it('sem resposta ainda, não afirma que ninguém pegou', () => {
    expect(quemEstaCom(undefined)).toBeUndefined();
  });
});

/*
 * ============================================================================
 * A RESPOSTA É 200 MESMO COM ITENS RECUSADOS
 * ============================================================================
 *
 * Quem decide é o `ok` de CADA item. Um lote que responde 200 e é lido como
 * "deu certo" é a forma mais silenciosa de o pedido de retirada no meio da
 * seleção nunca chegar a ninguém.
 */
describe('resumoDoLote', () => {
  it('todos gravados', () => {
    const resumo = resumoDoLote([item({ order_id: 'a' }), item({ order_id: 'b' })]);
    expect(resumo.gravados).toBe(2);
    expect(resumo.recusados).toHaveLength(0);
    expect(resumo.tudoCerto).toBe(true);
  });

  it('200 com recusa NÃO é sucesso', () => {
    const resumo = resumoDoLote([
      item({ order_id: 'a' }),
      item({ order_id: 'b', ok: false, error: 'not_delivery' }),
    ]);
    expect(resumo.gravados).toBe(1);
    expect(resumo.recusados).toHaveLength(1);
    expect(resumo.tudoCerto).toBe(false);
  });

  it('o lote inteiro recusado também é 200, e a tela precisa dizer isso', () => {
    const resumo = resumoDoLote([item({ ok: false, error: 'order_closed' })]);
    expect(resumo.gravados).toBe(0);
    expect(resumo.tudoCerto).toBe(false);
  });
});

/*
 * ============================================================================
 * AS QUATRO FRASES SÃO NOSSAS
 * ============================================================================
 *
 * O contrato traz o ENUM de propósito ("o painel escreve a mensagem por codigo,
 * nao pelo texto"). A glosa da descrição da rota é explicação para quem lê o
 * contrato, não texto de tela.
 */
describe('fraseDaRecusa', () => {
  /*
   * `not_found` NÃO DISTINGUE inexistente / de outro restaurante / de filial
   * invisível. O backend uniu os três "para nao virar oraculo de UUID", e a
   * tela não pode desfazer isso — uma frase que separasse os casos seria a tela
   * afirmando o que ninguém lhe contou.
   */
  it('not_found não vira oráculo de UUID', () => {
    const frase = fraseDaRecusa('not_found', ALVO);
    expect(frase).toBe('Este pedido não está na sua lista.');
    expect(frase).not.toContain('outro restaurante');
  });

  it('not_delivery diz o que é, em uma linha', () => {
    expect(fraseDaRecusa('not_delivery', ALVO)).toBe('Retirada não tem entregador.');
  });

  it('order_closed é o pedido que já acabou', () => {
    expect(fraseDaRecusa('order_closed', ALVO)).toBe('Este pedido já terminou.');
  });

  /*
   * `other_branch` É A ÚNICA QUE PRECISA DE CONTEXTO: sem dizer de qual filial
   * é o motoboy, "o pedido é de outra" não diz outra do quê.
   */
  it('other_branch nomeia o entregador e a filial dele', () => {
    expect(fraseDaRecusa('other_branch', ALVO)).toBe(
      'Jorge é da Aldeota, e este pedido é de outra.',
    );
  });

  /*
   * UM CÓDIGO QUE O PAINEL NÃO CONHECE NÃO PODE VIRAR TELA EM BRANCO. O backend
   * pode ganhar um quinto motivo antes de este painel saber dele, e a linha
   * precisa dizer alguma coisa.
   */
  it('código desconhecido ainda produz uma frase', () => {
    expect(fraseDaRecusa('motivo_novo_do_backend', ALVO)).toBeTruthy();
  });
});
