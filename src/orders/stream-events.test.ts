import { describe, expect, it } from 'vitest';

import type { OrderListItem } from '../api/types';
import { AppliedEventKeys, upsertOrder } from './stream-events';

function orderFixture(overrides: Partial<OrderListItem> = {}): OrderListItem {
  return {
    id: 'ordem-1',
    order_number: 101,
    branch_id: 'filial-1',
    customer_name_snapshot: 'Maria',
    customer_phone_snapshot: '85999990000',
    order_type: 'delivery',
    status: 'pending',
    payment_method: 'pix',
    payment_status: 'paid',
    total: 42.5,
    created_at: '2026-08-07T12:00:00Z',
    ...overrides,
  };
}

describe('AppliedEventKeys', () => {
  it('aceita o evento uma vez e descarta a repetição', () => {
    const applied = new AppliedEventKeys();
    expect(applied.markIfNew('evento-a')).toBe(true);
    expect(applied.markIfNew('evento-a')).toBe(false);
    expect(applied.markIfNew('evento-b')).toBe(true);
  });

  // Sem o teto, um painel aberto o dia todo acumularia milhares de chaves.
  it('esquece as chaves mais antigas quando estoura o limite', () => {
    const applied = new AppliedEventKeys(2);
    applied.markIfNew('a');
    applied.markIfNew('b');
    applied.markIfNew('c'); // expulsa 'a'

    expect(applied.size).toBe(2);
    expect(applied.markIfNew('c')).toBe(false);
    expect(applied.markIfNew('a')).toBe(true);
  });
});

describe('upsertOrder', () => {
  it('põe o pedido novo no topo', () => {
    const antigo = orderFixture({ id: 'antigo', order_number: 100 });
    const novo = orderFixture({ id: 'novo', order_number: 101 });

    expect(upsertOrder([antigo], novo).map((order) => order.id)).toEqual(['novo', 'antigo']);
  });

  it('substitui o pedido que já estava, sem mudar a posição', () => {
    const primeiro = orderFixture({ id: 'a' });
    const segundo = orderFixture({ id: 'b', status: 'pending' });
    const atualizado = orderFixture({ id: 'b', status: 'preparing' });

    const result = upsertOrder([primeiro, segundo], atualizado);

    expect(result).toHaveLength(2);
    expect(result[1]?.status).toBe('preparing');
    expect(result.map((order) => order.id)).toEqual(['a', 'b']);
  });

  it('não muta a lista recebida', () => {
    const lista = [orderFixture({ id: 'a' })];
    upsertOrder(lista, orderFixture({ id: 'b' }));
    expect(lista).toHaveLength(1);
  });
});
