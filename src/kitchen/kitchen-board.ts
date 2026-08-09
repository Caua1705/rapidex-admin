/**
 * As regras da tela de Cozinha, sem React e sem rede.
 *
 * A Cozinha é a MESMA fonte de dados do quadro de pedidos (`/admin/orders` e o
 * mesmo SSE) vista por outro recorte: só o que está na mão de quem cozinha, com
 * um caminho adiante por cartão.
 *
 * Duas regras respondem por quase tudo o que este arquivo faz:
 *
 *   1. SÓ TRÊS ESTADOS — Aceito, Preparando, Pronto. Pendente ainda não foi
 *      aceito e não é trabalho da cozinha; o que saiu para entrega já não é.
 *      Mostrar os outros encheria a tela de cartão que ninguém vai tocar.
 *   2. PEDIDO NÃO PAGO NÃO APARECE. Pagamento online pendente ou recusado
 *      significa que o dinheiro não entrou: o backend recusa a transição, e
 *      montar o prato antes disso é prejuízo. Não é para aparecer esmaecido
 *      nem travado — é para não estar lá.
 */
import type { OrderListItem } from '../api/types';
import { isAwaitingOnlinePayment } from '../orders/order-status';

/** As três colunas, na ordem em que o prato caminha. */
export const KITCHEN_COLUMNS = [
  { key: 'accepted', title: 'Aceito' },
  { key: 'preparing', title: 'Preparando' },
  { key: 'ready', title: 'Pronto' },
] as const;

export type KitchenColumnKey = (typeof KITCHEN_COLUMNS)[number]['key'];

export const KITCHEN_STATUSES: readonly KitchenColumnKey[] = KITCHEN_COLUMNS.map(
  (column) => column.key,
);

/** O pedido pertence à tela de Cozinha? */
export function belongsInKitchen(order: Pick<OrderListItem, 'status' | 'payment_status'>): boolean {
  if (!KITCHEN_STATUSES.includes(order.status as KitchenColumnKey)) return false;
  // A regra que evita prato montado sem dinheiro na conta.
  return !isAwaitingOnlinePayment(order.payment_status);
}

export type KitchenAdvance = {
  /** Para onde o botão leva. */
  target: string;
  /** O que o botão diz — a AÇÃO da cozinha, não o nome do estado. */
  label: string;
};

/**
 * O único botão do cartão.
 *
 * Um por cartão, e não a lista de transições possíveis: na cozinha existe um
 * caminho adiante e mais nada. Cancelar não está aqui de propósito — exige
 * motivo, é decisão de quem atende, e um botão vermelho ao lado de "Pronto"
 * seria clicado sem querer com a mão suja de farinha.
 *
 * Em "Pronto" o destino depende do tipo: pedido de entrega sai para o
 * entregador, pedido de retirada se encerra no balcão. Oferecer "Saiu para
 * entrega" num pedido de retirada daria erro do backend na cara do cozinheiro.
 */
export function advanceFor(
  order: Pick<OrderListItem, 'status' | 'order_type'>,
): KitchenAdvance | null {
  if (order.status === 'accepted') return { target: 'preparing', label: 'Começar a preparar' };
  if (order.status === 'preparing') return { target: 'ready', label: 'Marcar como pronto' };
  if (order.status === 'ready') {
    return order.order_type === 'delivery'
      ? { target: 'out_for_delivery', label: 'Saiu para entrega' }
      : { target: 'completed', label: 'Entregue ao cliente' };
  }
  return null;
}

/**
 * Distribui os pedidos nas três colunas: o mais ANTIGO primeiro.
 *
 * O contrário do quadro de pedidos, que mostra o mais novo no topo. Aqui a
 * ordem é a fila da cozinha — quem chegou antes come antes —, e inverter isso
 * faria o pedido mais velho afundar até ser esquecido.
 */
export function groupForKitchen(
  orders: readonly OrderListItem[],
): Record<KitchenColumnKey, OrderListItem[]> {
  const grouped = { accepted: [], preparing: [], ready: [] } as Record<
    KitchenColumnKey,
    OrderListItem[]
  >;

  orders.filter(belongsInKitchen).forEach((order) => {
    grouped[order.status as KitchenColumnKey].push(order);
  });

  (Object.keys(grouped) as KitchenColumnKey[]).forEach((key) => {
    grouped[key].sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''));
  });

  return grouped;
}
