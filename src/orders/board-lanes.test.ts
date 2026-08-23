import { describe, expect, it } from 'vitest';

import type { OrderListItem } from '../api/types';
import {
  BOARD_BLOCKS,
  LANES,
  MINUTOS_ATE_PAGAMENTO_PARADO,
  PAGAMENTO_PARADO_LANE,
  countFor,
  countForView,
  firstVisibleOrder,
  groupIntoLanes,
  historyOrders,
  isPagamentoParado,
  statusesForView,
} from './board-lanes';

function orderWithStatus(id: string, status: string): OrderListItem {
  return {
    id,
    order_number: 1,
    branch_id: 'filial-1',
    customer_name_snapshot: 'Cliente',
    customer_phone_snapshot: '85999990000',
    order_type: 'delivery',
    status,
    payment_method: 'cash',
    payment_status: 'on_delivery',
    total: 10,
    created_at: '2026-08-07T12:00:00Z',
  };
}

/** O relógio das provas: `created_at` dos fixtures + os minutos pedidos. */
const CRIADO_EM = Date.parse('2026-08-07T12:00:00Z');
const minutosDepois = (minutos: number) => CRIADO_EM + minutos * 60_000;

/** Um pedido de Pix esperando o gateway, criado na hora de `CRIADO_EM`. */
function pixPendente(id: string, payment_status = 'pending'): OrderListItem {
  return {
    ...orderWithStatus(id, 'pending'),
    payment_method: 'pix',
    payment_status,
  };
}

describe('groupIntoLanes', () => {
  it('põe cada pedido na faixa que responde pela pergunta dele', () => {
    const grouped = groupIntoLanes([
      orderWithStatus('a', 'pending'),
      orderWithStatus('b', 'accepted'),
      orderWithStatus('c', 'preparing'),
      orderWithStatus('d', 'ready'),
      orderWithStatus('e', 'out_for_delivery'),
    ]);

    expect(grouped.novos?.map((order) => order.id)).toEqual(['a']);
    expect(grouped.preparo?.map((order) => order.id)).toEqual(['b', 'c']);
    expect(grouped.prontos?.map((order) => order.id)).toEqual(['d', 'e']);
  });

  /* O quadro é o turno. O que já acabou é consulta e mora na outra aba. */
  it('não mostra no quadro o que é histórico', () => {
    const grouped = groupIntoLanes([
      orderWithStatus('a', 'pending'),
      orderWithStatus('b', 'completed'),
      orderWithStatus('c', 'cancelled'),
      orderWithStatus('d', 'rejected'),
    ]);

    expect(grouped.novos?.map((order) => order.id)).toEqual(['a']);
    expect(Object.values(grouped).flat()).toHaveLength(1);
  });

  // Backend novo com painel velho: o pedido não pode simplesmente sumir.
  it('não perde pedido com status desconhecido', () => {
    const grouped = groupIntoLanes([orderWithStatus('a', 'em_disputa')]);
    expect(grouped.novos?.map((order) => order.id)).toEqual(['a']);
  });

  it('devolve uma lista para cada bloco desenhado, mesmo vazia', () => {
    const grouped = groupIntoLanes([]);
    BOARD_BLOCKS.forEach((lane) => expect(grouped[lane.key]).toEqual([]));
  });
});

describe('isPagamentoParado', () => {
  it('não é parado enquanto a espera não chega no limite', () => {
    const order = pixPendente('a');
    expect(isPagamentoParado(order, minutosDepois(MINUTOS_ATE_PAGAMENTO_PARADO - 1))).toBe(false);
  });

  it('é parado a partir do limite', () => {
    const order = pixPendente('a');
    expect(isPagamentoParado(order, minutosDepois(MINUTOS_ATE_PAGAMENTO_PARADO))).toBe(true);
  });

  /*
   * Cartão recusado não é "ainda pode pagar": é uma tentativa que terminou.
   * Esperar trinta minutos por ela seria esperar por nada.
   */
  it('recusado cai na hora, sem esperar o limite', () => {
    const order = pixPendente('a', 'failed');
    expect(isPagamentoParado(order, minutosDepois(0))).toBe(true);
  });

  it('pago e pagamento na entrega nunca entram, por mais velhos que sejam', () => {
    const daquiATresDias = minutosDepois(3 * 24 * 60);
    expect(isPagamentoParado(pixPendente('a', 'paid'), daquiATresDias)).toBe(false);
    expect(isPagamentoParado(orderWithStatus('b', 'pending'), daquiATresDias)).toBe(false);
  });

  /*
   * Dinheiro que entrou e voltou num pedido que ninguém aceitou. Não é espera:
   * não volta sozinho, e por isso não espera o limite.
   */
  it('estornado cai na hora, como o recusado', () => {
    expect(isPagamentoParado(pixPendente('a', 'refunded'), minutosDepois(0))).toBe(true);
  });

  /*
   * ============================================================================
   * A EXCLUSÃO QUE DEU NOME À REGRA
   * ============================================================================
   *
   * `in_review` é o antifraude do gateway analisando um CARTÃO. O bloco existe
   * para tirar da vista o que não vai acontecer, e a análise ainda pode virar
   * pedido — o veredito chega por webhook sem o cliente fazer nada.
   *
   * E O TEMPO NÃO MUDA A NATUREZA DO ESTADO: a análise pode levar 48 horas
   * úteis e continua não sendo abandono. Por isso a prova vai até três dias, e
   * não até o limite de trinta minutos.
   */
  it('em análise antifraude nunca desce, nem depois de 48 horas', () => {
    const emAnalise = pixPendente('a', 'in_review');

    expect(isPagamentoParado(emAnalise, minutosDepois(31))).toBe(false);
    expect(isPagamentoParado(emAnalise, minutosDepois(48 * 60))).toBe(false);
    expect(isPagamentoParado(emAnalise, minutosDepois(3 * 24 * 60))).toBe(false);
  });

  /*
   * A RAZÃO DE A LISTA SER DE QUEM ENTRA. Foi assim que `in_review` desceu
   * sozinho: a condição era "tudo que não é pago", e um estado novo do backend
   * herdou um bloco que não é dele. O próximo fica em "Novos" até alguém
   * decidir o contrário — que é o lado certo para errar.
   */
  it('estado de pagamento que o painel não conhece fica em Novos', () => {
    const inventado = pixPendente('a', 'algo_que_o_backend_inventou');

    expect(isPagamentoParado(inventado, minutosDepois(3 * 24 * 60))).toBe(false);
  });

  /* Sem hora não há espera a medir, e na dúvida a linha fica onde o lojista a vê. */
  it('pedido sem created_at não é dado como parado', () => {
    const order = { ...pixPendente('a'), created_at: null };
    expect(isPagamentoParado(order, minutosDepois(999))).toBe(false);
  });

  it('aceita um limite diferente do padrão', () => {
    const order = pixPendente('a');
    expect(isPagamentoParado(order, minutosDepois(10), 5)).toBe(true);
    expect(isPagamentoParado(order, minutosDepois(10), 15)).toBe(false);
  });
});

describe('o bloco dos pagamentos parados', () => {
  it('desce só o que passou do limite, e mantém a ordem da lista', () => {
    const grouped = groupIntoLanes(
      [pixPendente('recente'), pixPendente('velho-1'), pixPendente('velho-2')].map((order, i) =>
        i === 0 ? order : { ...order, created_at: '2026-08-07T10:00:00Z' },
      ),
      minutosDepois(1),
    );

    expect(grouped.novos?.map((o) => o.id)).toEqual(['recente']);
    expect(grouped[PAGAMENTO_PARADO_LANE.key]?.map((o) => o.id)).toEqual(['velho-1', 'velho-2']);
  });

  /*
   * A GARANTIA CENTRAL DA RODADA: nada sai do quadro. O que a partição faz é
   * mudar de bloco, e a soma continua sendo a mesma lista.
   */
  it('não perde pedido nenhum: o que sai de Novos entra no bloco', () => {
    const orders = [pixPendente('a'), pixPendente('b'), orderWithStatus('c', 'preparing')];
    const grouped = groupIntoLanes(orders, minutosDepois(90));

    expect(Object.values(grouped).flat()).toHaveLength(3);
    expect(grouped.novos).toEqual([]);
    expect(grouped[PAGAMENTO_PARADO_LANE.key]?.map((o) => o.id)).toEqual(['a', 'b']);
  });

  /*
   * O cliente pagou no minuto 45. É o caso que justifica separar em vez de
   * esconder: o SSE atualiza `payment_status` e a linha volta para o topo sem
   * nenhuma regra de "desesconder".
   */
  it('volta para Novos assim que o pagamento entra', () => {
    const pago = { ...pixPendente('a'), payment_status: 'paid' };
    const grouped = groupIntoLanes([pago], minutosDepois(45));

    expect(grouped.novos?.map((o) => o.id)).toEqual(['a']);
    expect(grouped[PAGAMENTO_PARADO_LANE.key]).toEqual([]);
  });

  /* No quadro inteiro, e não só na função: a linha em análise fica em Novos. */
  it('o pedido em análise antifraude continua em Novos', () => {
    const emAnalise = pixPendente('a', 'in_review');
    const grouped = groupIntoLanes([emAnalise, pixPendente('b')], minutosDepois(90));

    expect(grouped.novos?.map((o) => o.id)).toEqual(['a']);
    expect(grouped[PAGAMENTO_PARADO_LANE.key]?.map((o) => o.id)).toEqual(['b']);
  });

  /* A descida é só da primeira faixa: o que já está com a cozinha não desce. */
  it('não mexe em pedido que já saiu de Novos', () => {
    const aceitoSemPagar = { ...pixPendente('a'), status: 'accepted' };
    const grouped = groupIntoLanes([aceitoSemPagar], minutosDepois(90));

    expect(grouped.preparo?.map((o) => o.id)).toEqual(['a']);
    expect(grouped[PAGAMENTO_PARADO_LANE.key]).toEqual([]);
  });

  /* O bloco não pode virar faixa: `LANES` é quem alimenta os contadores. */
  it('fica fora de LANES, para o badge de Novos não dobrar', () => {
    expect(LANES.some((lane) => lane.key === PAGAMENTO_PARADO_LANE.key)).toBe(false);
    expect(BOARD_BLOCKS.map((lane) => lane.key)).toEqual([
      'novos',
      PAGAMENTO_PARADO_LANE.key,
      'preparo',
      'prontos',
    ]);
    expect(countFor(statusesForView('andamento'), { pending: 3 })).toBe(3);
  });
});

describe('historyOrders', () => {
  it('junta concluído, cancelado e recusado, na ordem em que vieram', () => {
    const history = historyOrders([
      orderWithStatus('a', 'pending'),
      orderWithStatus('b', 'completed'),
      orderWithStatus('c', 'rejected'),
      orderWithStatus('d', 'cancelled'),
    ]);
    expect(history.map((order) => order.id)).toEqual(['b', 'c', 'd']);
  });
});

describe('statusesForView', () => {
  it('a aba em andamento é a soma das três faixas', () => {
    expect(statusesForView('andamento')).toEqual([
      'pending',
      'accepted',
      'preparing',
      'ready',
      'out_for_delivery',
    ]);
  });

  it('a aba de histórico é o resto, e as duas não se sobrepõem', () => {
    const andamento = statusesForView('andamento');
    const historico = statusesForView('historico');
    expect(historico).toEqual(['completed', 'cancelled', 'rejected']);
    expect(historico.some((status) => andamento.includes(status))).toBe(false);
  });
});

describe('contadores', () => {
  it('soma os contadores dos status pedidos', () => {
    const counts = { pending: 3, accepted: 2, preparing: 5 };
    expect(countFor(['accepted', 'preparing'], counts)).toBe(7);
  });

  it('trata status ausente do contador como zero', () => {
    expect(countFor(['pending'], {})).toBe(0);
  });

  it('a contagem da aba cobre tudo o que ela mostra', () => {
    const counts = {
      pending: 1,
      accepted: 1,
      preparing: 1,
      ready: 1,
      out_for_delivery: 1,
      completed: 40,
      cancelled: 2,
      rejected: 1,
    };
    expect(countForView('andamento', counts)).toBe(5);
    expect(countForView('historico', counts)).toBe(43);
  });
});

describe('firstVisibleOrder', () => {
  /*
   * A TELA ESCOLHE ESTE PEDIDO SOZINHA na abertura (ver `OrdersPage`), então
   * "o primeiro" precisa ser o primeiro que o OLHO encontra — e não
   * `orders[0]`, que é só o primeiro carregado.
   */
  it('é o primeiro da primeira faixa que tem pedido, não o primeiro carregado', () => {
    const orders = [
      orderWithStatus('a', 'preparing'),
      orderWithStatus('b', 'pending'),
      orderWithStatus('c', 'ready'),
    ];
    // `a` veio primeiro na resposta, mas "Novos" é a faixa de cima.
    expect(firstVisibleOrder(orders, 'andamento')?.id).toBe('b');
  });

  /*
   * Com todos os novos parados no pagamento, o bloco deles é o que está no
   * alto — e é nele que o olho cai. Varrer só `LANES` abriria a tela num
   * pedido do meio da lista.
   */
  it('encontra o pedido do bloco de pagamento parado antes do que está em preparo', () => {
    const parado = { ...pixPendente('parado'), created_at: '2020-01-01T00:00:00Z' };
    const orders = [orderWithStatus('preparando', 'preparing'), parado];
    expect(firstVisibleOrder(orders, 'andamento')?.id).toBe('parado');
  });

  it('pula faixa vazia', () => {
    const orders = [orderWithStatus('a', 'ready'), orderWithStatus('b', 'preparing')];
    expect(firstVisibleOrder(orders, 'andamento')?.id).toBe('b');
  });

  it('no histórico é o primeiro encerrado, na ordem em que veio', () => {
    const orders = [
      orderWithStatus('a', 'pending'),
      orderWithStatus('b', 'completed'),
      orderWithStatus('c', 'cancelled'),
    ];
    expect(firstVisibleOrder(orders, 'historico')?.id).toBe('b');
  });

  it('devolve nulo quando não há o que escolher — e é isso que segura a trava', () => {
    expect(firstVisibleOrder([], 'andamento')).toBeNull();
    expect(firstVisibleOrder([orderWithStatus('a', 'completed')], 'andamento')).toBeNull();
    expect(firstVisibleOrder([orderWithStatus('a', 'pending')], 'historico')).toBeNull();
  });
});
