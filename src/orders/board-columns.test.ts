import { describe, expect, it } from 'vitest';

import type { OrderListItem } from '../api/types';
import { BOARD_COLUMNS, columnCount, groupOrdersIntoColumns } from './board-columns';

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

describe('groupOrdersIntoColumns', () => {
  it('põe cada pedido na coluna do seu status', () => {
    const grouped = groupOrdersIntoColumns([
      orderWithStatus('a', 'pending'),
      orderWithStatus('b', 'preparing'),
      orderWithStatus('c', 'completed'),
    ]);

    expect(grouped.pending?.map((order) => order.id)).toEqual(['a']);
    expect(grouped.preparing?.map((order) => order.id)).toEqual(['b']);
    expect(grouped.completed?.map((order) => order.id)).toEqual(['c']);
  });

  it('junta cancelado e recusado na mesma coluna', () => {
    const grouped = groupOrdersIntoColumns([
      orderWithStatus('a', 'cancelled'),
      orderWithStatus('b', 'rejected'),
    ]);
    expect(grouped.closed?.map((order) => order.id)).toEqual(['a', 'b']);
  });

  // Backend novo com painel velho: o pedido não pode simplesmente sumir.
  it('não perde pedido com status desconhecido', () => {
    const grouped = groupOrdersIntoColumns([orderWithStatus('a', 'em_disputa')]);
    expect(grouped.closed?.map((order) => order.id)).toEqual(['a']);
  });

  it('devolve uma lista para cada coluna, mesmo vazia', () => {
    const grouped = groupOrdersIntoColumns([]);
    BOARD_COLUMNS.forEach((column) => expect(grouped[column.key]).toEqual([]));
  });
});

describe('columnCount', () => {
  it('soma os contadores dos status da coluna', () => {
    const counts = { pending: 3, cancelled: 2, rejected: 5 };
    const pendente = BOARD_COLUMNS.find((column) => column.key === 'pending')!;
    const encerrados = BOARD_COLUMNS.find((column) => column.key === 'closed')!;

    expect(columnCount(pendente, counts)).toBe(3);
    expect(columnCount(encerrados, counts)).toBe(7);
  });

  it('trata status ausente do contador como zero', () => {
    const pendente = BOARD_COLUMNS.find((column) => column.key === 'pending')!;
    expect(columnCount(pendente, {})).toBe(0);
  });
});
