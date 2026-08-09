import { describe, expect, it } from 'vitest';

import type { OrderListItem } from '../api/types';
import { advanceFor, belongsInKitchen, groupForKitchen, KITCHEN_STATUSES } from './kitchen-board';

function order(overrides: Partial<OrderListItem> = {}): OrderListItem {
  return {
    id: 'o-1',
    order_number: 1,
    branch_id: 'b-1',
    customer_name_snapshot: 'Ana',
    customer_phone_snapshot: '85999990000',
    order_type: 'delivery',
    status: 'preparing',
    payment_method: 'pix',
    payment_status: 'paid',
    total: 50,
    created_at: '2026-08-09T12:00:00Z',
    ...overrides,
  };
}

describe('belongsInKitchen', () => {
  it('aceita os três estados da cozinha', () => {
    expect(KITCHEN_STATUSES).toEqual(['accepted', 'preparing', 'ready']);
    KITCHEN_STATUSES.forEach((status) => {
      expect(belongsInKitchen(order({ status }))).toBe(true);
    });
  });

  // Pendente ainda não foi aceito; o que saiu para entrega já não é da cozinha.
  it('recusa o que não é trabalho da cozinha', () => {
    ['pending', 'out_for_delivery', 'completed', 'cancelled', 'rejected'].forEach((status) => {
      expect(belongsInKitchen(order({ status }))).toBe(false);
    });
  });

  /*
   * A regra mais cara desta tela: montar o prato de um pedido cujo pagamento
   * online não entrou é prejuízo direto. Ele não aparece esmaecido nem travado
   * — ele não aparece.
   */
  it('pedido com pagamento online não confirmado não entra', () => {
    expect(belongsInKitchen(order({ payment_status: 'pending' }))).toBe(false);
    expect(belongsInKitchen(order({ payment_status: 'failed' }))).toBe(false);
  });

  it('pago e a pagar na entrega entram: nos dois o dinheiro está garantido', () => {
    expect(belongsInKitchen(order({ payment_status: 'paid' }))).toBe(true);
    expect(belongsInKitchen(order({ payment_status: 'on_delivery' }))).toBe(true);
  });
});

describe('advanceFor', () => {
  it('cada estado tem um caminho adiante e um só', () => {
    expect(advanceFor(order({ status: 'accepted' }))).toMatchObject({ target: 'preparing' });
    expect(advanceFor(order({ status: 'preparing' }))).toMatchObject({ target: 'ready' });
  });

  // Oferecer "Saiu para entrega" num pedido de retirada daria erro do backend
  // na cara do cozinheiro.
  it('em Pronto, o destino depende do tipo do pedido', () => {
    expect(advanceFor(order({ status: 'ready', order_type: 'delivery' }))).toMatchObject({
      target: 'out_for_delivery',
    });
    expect(advanceFor(order({ status: 'ready', order_type: 'pickup' }))).toMatchObject({
      target: 'completed',
    });
  });

  it('estado fora da cozinha não tem botão', () => {
    expect(advanceFor(order({ status: 'pending' }))).toBeNull();
    expect(advanceFor(order({ status: 'completed' }))).toBeNull();
  });

  it('o rótulo é a ação da cozinha, não o nome do estado', () => {
    expect(advanceFor(order({ status: 'accepted' }))?.label).toBe('Começar a preparar');
  });
});

describe('groupForKitchen', () => {
  it('separa nas três colunas e descarta o resto', () => {
    const grouped = groupForKitchen([
      order({ id: 'a', status: 'accepted' }),
      order({ id: 'b', status: 'preparing' }),
      order({ id: 'c', status: 'ready' }),
      order({ id: 'd', status: 'pending' }),
      order({ id: 'e', status: 'completed' }),
    ]);

    expect(grouped.accepted.map((entry) => entry.id)).toEqual(['a']);
    expect(grouped.preparing.map((entry) => entry.id)).toEqual(['b']);
    expect(grouped.ready.map((entry) => entry.id)).toEqual(['c']);
  });

  it('o não pago não chega a nenhuma coluna', () => {
    const grouped = groupForKitchen([
      order({ id: 'pago', status: 'preparing', payment_status: 'paid' }),
      order({ id: 'nao-pago', status: 'preparing', payment_status: 'pending' }),
    ]);

    expect(grouped.preparing.map((entry) => entry.id)).toEqual(['pago']);
  });

  /*
   * A fila da cozinha é o contrário do quadro de pedidos: quem chegou antes
   * come antes. Com o mais novo no topo, o pedido mais velho afunda até ser
   * esquecido.
   */
  it('ordena do mais antigo para o mais novo', () => {
    const grouped = groupForKitchen([
      order({ id: 'novo', created_at: '2026-08-09T12:30:00Z' }),
      order({ id: 'velho', created_at: '2026-08-09T11:00:00Z' }),
      order({ id: 'meio', created_at: '2026-08-09T12:00:00Z' }),
    ]);

    expect(grouped.preparing.map((entry) => entry.id)).toEqual(['velho', 'meio', 'novo']);
  });

  it('pedido sem data não quebra a ordenação', () => {
    const grouped = groupForKitchen([
      order({ id: 'com-data', created_at: '2026-08-09T12:00:00Z' }),
      order({ id: 'sem-data', created_at: null }),
    ]);

    expect(grouped.preparing).toHaveLength(2);
  });
});
