import { describe, expect, it } from 'vitest';

import { checkTransition, isAwaitingOnlinePayment, nextStatusesFor } from './order-status';

/** Pedido base dos testes: entrega, pago, pendente de aceite. */
function orderWith(overrides: Partial<Parameters<typeof checkTransition>[0]> = {}) {
  return {
    status: 'pending',
    order_type: 'delivery',
    payment_status: 'paid',
    ...overrides,
  };
}

describe('isAwaitingOnlinePayment', () => {
  it('libera pago e pago-na-entrega', () => {
    expect(isAwaitingOnlinePayment('paid')).toBe(false);
    expect(isAwaitingOnlinePayment('on_delivery')).toBe(false);
  });

  it('segura pagamento online pendente, recusado ou estornado', () => {
    expect(isAwaitingOnlinePayment('pending')).toBe(true);
    expect(isAwaitingOnlinePayment('failed')).toBe(true);
    expect(isAwaitingOnlinePayment('refunded')).toBe(true);
  });
});

describe('checkTransition', () => {
  it('aceita o caminho normal do pedido', () => {
    expect(checkTransition(orderWith(), 'accepted').allowed).toBe(true);
    expect(checkTransition(orderWith({ status: 'accepted' }), 'preparing').allowed).toBe(true);
    expect(checkTransition(orderWith({ status: 'preparing' }), 'ready').allowed).toBe(true);
    expect(checkTransition(orderWith({ status: 'ready' }), 'out_for_delivery').allowed).toBe(true);
    expect(checkTransition(orderWith({ status: 'out_for_delivery' }), 'completed').allowed).toBe(
      true,
    );
  });

  it('recusa atalho: aceito não pula direto para pronto', () => {
    const check = checkTransition(orderWith({ status: 'accepted' }), 'ready');
    expect(check.allowed).toBe(false);
  });

  it('recusa sair de estado final', () => {
    const check = checkTransition(orderWith({ status: 'cancelled' }), 'accepted');
    expect(check).toEqual({
      allowed: false,
      reason: '"Cancelado" é um estado final e não muda mais.',
    });
  });

  it('recusa ir para o mesmo status', () => {
    expect(checkTransition(orderWith({ status: 'preparing' }), 'preparing').allowed).toBe(false);
  });

  it('recusa saída para entrega em pedido de retirada', () => {
    const check = checkTransition(
      orderWith({ status: 'ready', order_type: 'pickup' }),
      'out_for_delivery',
    );
    expect(check).toEqual({ allowed: false, reason: 'Pedido de retirada não sai para entrega.' });
  });

  // A regra que motiva o destaque vermelho no card.
  it('recusa mandar para a cozinha pedido com pagamento online não confirmado', () => {
    const check = checkTransition(orderWith({ payment_status: 'pending' }), 'accepted');
    expect(check.allowed).toBe(false);
    expect(check.allowed === false && check.reason).toContain('Pagamento online');
  });

  it('permite recusar e cancelar mesmo sem pagamento confirmado', () => {
    expect(checkTransition(orderWith({ payment_status: 'pending' }), 'rejected').allowed).toBe(
      true,
    );
    expect(checkTransition(orderWith({ payment_status: 'failed' }), 'cancelled').allowed).toBe(
      true,
    );
  });

  it('avisa quando o status atual não existe no grafo', () => {
    const check = checkTransition(orderWith({ status: 'inventado' }), 'accepted');
    expect(check).toEqual({ allowed: false, reason: 'Status atual desconhecido: "inventado".' });
  });
});

describe('nextStatusesFor', () => {
  it('devolve os destinos possíveis', () => {
    expect(nextStatusesFor('pending')).toEqual(['accepted', 'rejected', 'cancelled']);
    expect(nextStatusesFor('ready')).toEqual(['out_for_delivery', 'completed', 'cancelled']);
  });

  it('devolve vazio para estado final e para status desconhecido', () => {
    expect(nextStatusesFor('completed')).toEqual([]);
    expect(nextStatusesFor('inventado')).toEqual([]);
  });
});
