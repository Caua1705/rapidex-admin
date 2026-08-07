/** Chamadas da tela de pedidos. */
import { apiClient, unwrap } from './client';
import type {
  Branch,
  OrderDetail,
  OrderListResponse,
  OrderStatusCountsResponse,
  StreamTicket,
} from './types';

/**
 * Filtros da tela. `branchId` vazio = todas as filiais que o lojista enxerga
 * (o backend já limita pelo escopo do token, então "todas" nunca vaza filial
 * de outro restaurante).
 */
export type OrderFilters = {
  branchId?: string;
  startDate?: string; // AAAA-MM-DD
  endDate?: string; // AAAA-MM-DD
  search?: string;
};

/** Converte os filtros da tela na query da API, omitindo o que está vazio. */
function toQuery(filters: OrderFilters) {
  return {
    ...(filters.branchId ? { branch_id: filters.branchId } : {}),
    ...(filters.startDate ? { start_date: filters.startDate } : {}),
    ...(filters.endDate ? { end_date: filters.endDate } : {}),
    ...(filters.search?.trim() ? { search: filters.search.trim() } : {}),
  };
}

export async function listOrders(
  filters: OrderFilters,
  limit: number,
  offset: number,
): Promise<OrderListResponse> {
  return unwrap(
    await apiClient.GET('/admin/orders', {
      params: { query: { ...toQuery(filters), limit, offset } },
    }),
  );
}

export async function fetchStatusCounts(filters: OrderFilters): Promise<OrderStatusCountsResponse> {
  return unwrap(
    await apiClient.GET('/admin/orders/status-counts', {
      params: { query: toQuery(filters) },
    }),
  );
}

export async function fetchOrderDetail(orderId: string): Promise<OrderDetail> {
  return unwrap(
    await apiClient.GET('/admin/orders/{order_id}', {
      params: { path: { order_id: orderId } },
    }),
  );
}

export async function updateOrderStatus(
  orderId: string,
  status: string,
  note?: string,
): Promise<OrderDetail> {
  return unwrap(
    await apiClient.PATCH('/admin/orders/{order_id}/status', {
      params: {
        path: { order_id: orderId },
        // Chave nova a cada clique do lojista. Ela protege o RETRY: se a
        // resposta se perder na rede e o navegador reenviar, o backend
        // devolve a resposta original em vez de gravar outra linha no
        // histórico do pedido.
        header: { 'Idempotency-Key': crypto.randomUUID() },
      },
      body: { status, ...(note ? { note } : {}) },
    }),
  );
}

/**
 * Credencial de 30s para abrir o SSE.
 *
 * O EventSource do navegador não manda cabeçalho, então o token de 12h teria
 * que ir na URL — e acabaria no log do proxy, no Referer e no histórico.
 */
export async function createStreamTicket(): Promise<StreamTicket> {
  return unwrap(await apiClient.POST('/admin/orders/stream-ticket', {}));
}

export async function listBranches(): Promise<Branch[]> {
  return unwrap(await apiClient.GET('/admin/branches'));
}
