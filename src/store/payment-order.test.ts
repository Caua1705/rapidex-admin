import { describe, expect, it } from 'vitest';

import type { PaymentMethod } from '../api/types';
import { ordemDoCliente } from './payment-order';

function forma(overrides: Partial<PaymentMethod>): PaymentMethod {
  return {
    id: 'pay-1',
    branch_id: 'fil-1',
    payment_flow: 'online',
    method_type: 'pix',
    label: 'Pix',
    brand: null,
    enabled: true,
    requires_gateway: false,
    earns_cashback: true,
    sort_order: 0,
    ...overrides,
  } as PaymentMethod;
}

/* ==========================================================================
 * A ORDEM É A DO CLIENTE, E ELA TEM TRÊS CHAVES
 *
 * `branch_repository.list_enabled_payment_methods` — a consulta que monta o
 * checkout — ordena por `payment_flow.asc(), sort_order.asc(), id.asc()`. A
 * listagem do painel (`admin_settings_repository.list_payment_methods`) usa
 * EXATAMENTE a mesma, de propósito.
 *
 * O painel desempatava por `label`, alfabético. E como toda forma nasce com
 * `sort_order: 0` — o painel não tem como reordená-las —, TODAS empatam: o
 * desempate decidia a lista inteira. O lojista via "Dinheiro, Pix" e o cliente
 * via a ordem em que elas foram cadastradas.
 * ======================================================================= */

describe('ordemDoCliente', () => {
  it('respeita sort_order antes de qualquer outra coisa', () => {
    const ordenadas = ordemDoCliente([
      forma({ id: 'b', label: 'Aaa', sort_order: 2 }),
      forma({ id: 'a', label: 'Zzz', sort_order: 1 }),
    ]);
    expect(ordenadas.map((m) => m.id)).toEqual(['a', 'b']);
  });

  /*
   * O CASO QUE ACONTECE EM TODA FILIAL: `sort_order` é 0 em todas, porque é
   * assim que o painel as cria e não há como reordená-las.
   */
  it('empatadas em sort_order, desempata por id — e NÃO por rótulo', () => {
    const ordenadas = ordemDoCliente([
      forma({ id: 'pay-2', label: 'Aaa dinheiro' }),
      forma({ id: 'pay-1', label: 'Zzz pix' }),
    ]);
    expect(ordenadas.map((m) => m.id)).toEqual(['pay-1', 'pay-2']);
  });

  it('o fluxo vem primeiro, como no ORDER BY do backend', () => {
    const ordenadas = ordemDoCliente([
      forma({ id: 'b', payment_flow: 'online' }),
      forma({ id: 'a', payment_flow: 'delivery' }),
    ]);
    expect(ordenadas.map((m) => m.id)).toEqual(['a', 'b']);
  });

  it('não muda a lista de origem', () => {
    const original = [forma({ id: 'b' }), forma({ id: 'a' })];
    ordemDoCliente(original);
    expect(original.map((m) => m.id)).toEqual(['b', 'a']);
  });
});
