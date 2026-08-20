import { describe, expect, it } from 'vitest';

import type { OrderListItem } from '../api/types';
import {
  LANES,
  countFor,
  countForView,
  firstVisibleOrder,
  groupIntoLanes,
  historyOrders,
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

  it('devolve uma lista para cada faixa, mesmo vazia', () => {
    const grouped = groupIntoLanes([]);
    LANES.forEach((lane) => expect(grouped[lane.key]).toEqual([]));
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
