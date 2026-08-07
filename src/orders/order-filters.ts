import type { OrderListItem } from '../api/types';
import { OPERATION_TIMEZONE, daysAgoInOperationTimezone, todayInOperationTimezone } from './format';

export type PeriodPreset = 'today' | 'yesterday' | 'last7' | 'custom';

export type OrdersFilterState = {
  branchId: string;
  period: PeriodPreset;
  startDate: string; // AAAA-MM-DD
  endDate: string; // AAAA-MM-DD
  search: string;
};

/**
 * O painel abre no dia de hoje.
 *
 * Sem recorte de período a lista viria com o histórico inteiro paginado, e a
 * primeira página poderia nem conter os pedidos abertos agora — que é o único
 * motivo de a tela existir.
 */
export function defaultFilters(): OrdersFilterState {
  const today = todayInOperationTimezone();
  return { branchId: '', period: 'today', startDate: today, endDate: today, search: '' };
}

/** Traduz o atalho de período escolhido em datas concretas. */
export function datesForPeriod(
  period: PeriodPreset,
  current: { startDate: string; endDate: string },
): { startDate: string; endDate: string } {
  if (period === 'today') {
    const today = todayInOperationTimezone();
    return { startDate: today, endDate: today };
  }
  if (period === 'yesterday') {
    const yesterday = daysAgoInOperationTimezone(1);
    return { startDate: yesterday, endDate: yesterday };
  }
  if (period === 'last7') {
    return { startDate: daysAgoInOperationTimezone(6), endDate: todayInOperationTimezone() };
  }
  return current;
}

const dayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: OPERATION_TIMEZONE });

function dayOf(isoDate: string | null | undefined): string | null {
  if (!isoDate) return null;
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return null;
  return dayFormatter.format(date);
}

/** Tira acento e caixa para a busca por nome funcionar como o lojista espera. */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * O pedido que chegou pelo SSE cabe no que está filtrado na tela?
 *
 * O stream não conhece os filtros: ele manda TODO pedido do restaurante. Sem
 * esta conferência, um pedido de outra filial apareceria numa tela filtrada
 * por filial e o lojista veria algo que a lista recarregada não traz.
 *
 * É uma reimplementação do filtro do backend, então pode divergir dele. O
 * estrago máximo é um card a mais ou a menos até o próximo recarregamento —
 * por isso ela é permissiva de propósito: na dúvida, mostra.
 */
export function orderMatchesFilters(order: OrderListItem, filters: OrdersFilterState): boolean {
  if (filters.branchId && order.branch_id !== filters.branchId) return false;

  const day = dayOf(order.created_at);
  if (day) {
    if (filters.startDate && day < filters.startDate) return false;
    if (filters.endDate && day > filters.endDate) return false;
  }

  const search = filters.search.trim();
  if (search) {
    const digitsOnly = /^\d+$/.test(search);
    if (digitsOnly) {
      if (!String(order.order_number).includes(search)) return false;
    } else if (!normalize(order.customer_name_snapshot).includes(normalize(search))) {
      return false;
    }
  }

  return true;
}
