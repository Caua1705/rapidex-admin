/** Chamadas da tela de pedidos. */
import { apiClient, unwrap } from './client';
import type { PrepTimeResponse } from './contract-pending';
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
  /**
   * UM status, não uma lista — é o que a rota aceita. Quem precisa de vários
   * (a Cozinha) faz uma chamada por status, em paralelo.
   */
  status?: string;
};

/** Converte os filtros da tela na query da API, omitindo o que está vazio. */
function toQuery(filters: OrderFilters) {
  return {
    ...(filters.branchId ? { branch_id: filters.branchId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
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
 * Cancela com motivo.
 *
 * Rota própria, e não `PATCH /status` com `status: "cancelled"`, porque o
 * motivo é OBRIGATÓRIO aqui: cancelamento é a única transição que apaga
 * trabalho já feito, e sem o motivo gravado ninguém depois consegue dizer se
 * foi o cliente que desistiu ou a cozinha que não deu conta.
 */
export async function cancelOrder(orderId: string, reason: string): Promise<OrderDetail> {
  return unwrap(
    await apiClient.PATCH('/admin/orders/{order_id}/cancel', {
      params: {
        path: { order_id: orderId },
        // Mesma proteção do PATCH /status: se a resposta se perder na rede e o
        // navegador reenviar, o backend devolve a original em vez de gravar
        // dois cancelamentos no histórico.
        header: { 'Idempotency-Key': crypto.randomUUID() },
      },
      body: { reason },
    }),
  );
}

/**
 * Empurra o tempo de preparo da filial em N minutos.
 *
 * A resposta traz a faixa já ajustada, então a tela atualiza com ela e NÃO faz
 * uma segunda chamada para reler — no meio do almoço, o número na barra tem
 * que mudar no mesmo clique.
 */
export async function adjustPrepTime(
  branchId: string,
  deltaMinutes: number,
): Promise<PrepTimeResponse> {
  return unwrap(
    await apiClient.PATCH('/admin/branches/{branch_id}/prep-time', {
      params: { path: { branch_id: branchId } },
      body: { delta_minutes: deltaMinutes },
    }),
  );
}

/** Grava a faixa base, quando o backend recusa o empurrão por não ter uma. */
export async function setPrepTimeBase(
  branchId: string,
  prepTimeMin: number,
  prepTimeMax: number,
): Promise<PrepTimeResponse> {
  return unwrap(
    await apiClient.PATCH('/admin/branches/{branch_id}/prep-time', {
      params: { path: { branch_id: branchId } },
      body: { prep_time_min: prepTimeMin, prep_time_max: prepTimeMax },
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
