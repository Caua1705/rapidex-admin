import { describe, expect, it } from 'vitest';

import type { OrderListItem } from '../api/types';
import { datesForPeriod, orderMatchesFilters, type OrdersFilterState } from './order-filters';

function filtersWith(overrides: Partial<OrdersFilterState> = {}): OrdersFilterState {
  return {
    branchId: '',
    period: 'custom',
    startDate: '2026-08-07',
    endDate: '2026-08-07',
    search: '',
    ...overrides,
  };
}

function orderFixture(overrides: Partial<OrderListItem> = {}): OrderListItem {
  return {
    id: 'ordem-1',
    order_number: 137,
    branch_id: 'filial-1',
    customer_name_snapshot: 'José Antônio',
    customer_phone_snapshot: '85999990000',
    order_type: 'delivery',
    status: 'pending',
    payment_method: 'pix',
    payment_status: 'paid',
    total: 42.5,
    // 15:00 em Fortaleza (UTC-3) no dia 7.
    created_at: '2026-08-07T18:00:00Z',
    ...overrides,
  };
}

describe('orderMatchesFilters', () => {
  it('aceita quando não há filtro nenhum além do período do dia', () => {
    expect(orderMatchesFilters(orderFixture(), filtersWith())).toBe(true);
  });

  it('recusa pedido de outra filial', () => {
    const filters = filtersWith({ branchId: 'filial-2' });
    expect(orderMatchesFilters(orderFixture(), filters)).toBe(false);
  });

  it('recusa pedido fora do período', () => {
    const filters = filtersWith({ startDate: '2026-08-08', endDate: '2026-08-08' });
    expect(orderMatchesFilters(orderFixture(), filters)).toBe(false);
  });

  // O dia é o do fuso da operação, não o do UTC: 02:00Z do dia 8 ainda é dia 7
  // em Fortaleza, e é o dia 7 que o lojista tem na tela.
  it('usa o fuso da operação para decidir o dia', () => {
    const order = orderFixture({ created_at: '2026-08-08T02:00:00Z' });
    expect(orderMatchesFilters(order, filtersWith())).toBe(true);
  });

  it('busca só por dígitos casa com o número do pedido', () => {
    expect(orderMatchesFilters(orderFixture(), filtersWith({ search: '137' }))).toBe(true);
    expect(orderMatchesFilters(orderFixture(), filtersWith({ search: '999' }))).toBe(false);
  });

  it('busca por texto ignora acento e caixa', () => {
    expect(orderMatchesFilters(orderFixture(), filtersWith({ search: 'jose' }))).toBe(true);
    expect(orderMatchesFilters(orderFixture(), filtersWith({ search: 'ANTONIO' }))).toBe(true);
    expect(orderMatchesFilters(orderFixture(), filtersWith({ search: 'carlos' }))).toBe(false);
  });

  it('não descarta pedido sem created_at', () => {
    const order = orderFixture({ created_at: null });
    expect(orderMatchesFilters(order, filtersWith())).toBe(true);
  });
});

describe('datesForPeriod', () => {
  const atual = { startDate: '2026-01-01', endDate: '2026-01-31' };

  it('hoje devolve o mesmo dia nas duas pontas', () => {
    const { startDate, endDate } = datesForPeriod('today', atual);
    expect(startDate).toBe(endDate);
    expect(startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('últimos 7 dias cobrem uma janela de 7 dias, hoje incluído', () => {
    const { startDate, endDate } = datesForPeriod('last7', atual);
    const dias = (Date.parse(endDate) - Date.parse(startDate)) / 86_400_000;
    expect(dias).toBe(6);
  });

  it('personalizado preserva o que o usuário digitou', () => {
    expect(datesForPeriod('custom', atual)).toEqual(atual);
  });
});
