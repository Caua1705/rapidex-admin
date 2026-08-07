import type { OrderDetail, OrderListItem } from '../api/types';

/**
 * O PATCH de status devolve o pedido DETALHADO, mas o quadro trabalha com o
 * item da lista. Em vez de esperar o SSE trazer a versão nova, recortamos o
 * detalhe no formato da lista e o card muda na hora — o clique do lojista
 * precisa dar resposta imediata.
 *
 * Todos os campos da lista existem no detalhe; o TypeScript reclama se o
 * backend acrescentar um campo obrigatório à lista e esquecermos dele aqui.
 */
export function listItemFromDetail(detail: OrderDetail): OrderListItem {
  return {
    id: detail.id,
    order_number: detail.order_number,
    branch_id: detail.branch_id,
    customer_name_snapshot: detail.customer_name_snapshot,
    customer_phone_snapshot: detail.customer_phone_snapshot,
    order_type: detail.order_type,
    status: detail.status,
    payment_method: detail.payment_method,
    payment_status: detail.payment_status,
    total: detail.total,
    created_at: detail.created_at,
  };
}
