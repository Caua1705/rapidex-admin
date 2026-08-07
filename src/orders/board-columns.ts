import type { OrderListItem } from '../api/types';
import type { OrderStatus } from './order-status';

/**
 * As colunas do quadro, na ordem em que o pedido caminha.
 *
 * As seis primeiras são o fluxo normal. A última junta `cancelled` e
 * `rejected` porque, sem ela, recusar um pedido o faria SUMIR da tela — e o
 * lojista ficaria sem saber se recusou ou se errou o clique. São duas colunas
 * de um pedido morto; juntas ocupam o espaço de uma.
 */
export type BoardColumn = {
  key: string;
  title: string;
  statuses: readonly OrderStatus[];
};

export const BOARD_COLUMNS: readonly BoardColumn[] = [
  { key: 'pending', title: 'Pendente', statuses: ['pending'] },
  { key: 'accepted', title: 'Aceito', statuses: ['accepted'] },
  { key: 'preparing', title: 'Preparando', statuses: ['preparing'] },
  { key: 'ready', title: 'Pronto', statuses: ['ready'] },
  { key: 'out_for_delivery', title: 'Saiu para entrega', statuses: ['out_for_delivery'] },
  { key: 'completed', title: 'Concluído', statuses: ['completed'] },
  { key: 'closed', title: 'Cancelados / recusados', statuses: ['cancelled', 'rejected'] },
];

/** Distribui os pedidos carregados nas colunas, mantendo a ordem da lista. */
export function groupOrdersIntoColumns(orders: OrderListItem[]): Record<string, OrderListItem[]> {
  const grouped: Record<string, OrderListItem[]> = {};
  BOARD_COLUMNS.forEach((column) => {
    grouped[column.key] = [];
  });

  orders.forEach((order) => {
    const column = BOARD_COLUMNS.find((candidate) =>
      candidate.statuses.includes(order.status as OrderStatus),
    );
    // Status que o painel não conhece (backend novo, painel velho) não some:
    // cai na coluna de encerrados, onde o lojista pelo menos o enxerga.
    grouped[column?.key ?? 'closed']?.push(order);
  });

  return grouped;
}

/** Soma dos badges da coluna. O backend devolve contador por status. */
export function columnCount(column: BoardColumn, counts: Record<string, number>): number {
  return column.statuses.reduce((total, status) => total + (counts[status] ?? 0), 0);
}
