/**
 * Espelho da máquina de estados do backend
 * (`src/services/order_state_machine.py`).
 *
 * ATENÇÃO: quem decide é o backend. Ele recusa transição inválida com 409 e a
 * tela mostra a mensagem dele. Esta cópia existe só para a interface não
 * OFERECER um botão que vai falhar — clicar em "Saiu para entrega" num pedido
 * de retirada e levar um erro é ruído no meio do turno.
 *
 * Se as duas divergirem, o backend ganha: o pior que acontece é um botão a
 * mais ou a menos, nunca um pedido em estado errado.
 */

export const ORDER_STATUSES = [
  'pending',
  'accepted',
  'preparing',
  'ready',
  'out_for_delivery',
  'completed',
  'cancelled',
  'rejected',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  accepted: 'Aceito',
  preparing: 'Preparando',
  ready: 'Pronto',
  out_for_delivery: 'Saiu para entrega',
  completed: 'Concluído',
  cancelled: 'Cancelado',
  rejected: 'Recusado',
};

/** Para onde cada status pode ir. Chave sem destinos = estado final. */
const TRANSITIONS: Record<string, readonly OrderStatus[]> = {
  pending: ['accepted', 'rejected', 'cancelled'],
  accepted: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['out_for_delivery', 'completed', 'cancelled'],
  out_for_delivery: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  rejected: [],
};

/** A partir daqui o pedido está na mão do restaurante e consome insumo. */
const KITCHEN_STATUSES: readonly string[] = [
  'accepted',
  'preparing',
  'ready',
  'out_for_delivery',
  'completed',
];

/** Estados de pagamento que liberam o pedido para a cozinha. */
const PAYMENT_STATUSES_THAT_RELEASE: readonly string[] = ['paid', 'on_delivery'];

/**
 * O pedido está esperando dinheiro que ainda não chegou?
 *
 * É o destaque mais importante da tela: pagamento online em `pending` ou
 * `failed` significa que a cozinha NÃO pode começar. O backend recusa, mas
 * quem está na chapa precisa ver isso antes de tentar.
 */
export function isAwaitingOnlinePayment(paymentStatus: string): boolean {
  return !PAYMENT_STATUSES_THAT_RELEASE.includes(paymentStatus);
}

export function isTerminalStatus(status: string): boolean {
  return (TRANSITIONS[status]?.length ?? 0) === 0;
}

export type TransitionCheck = { allowed: true } | { allowed: false; reason: string };

/** Mesmas regras, mesma ordem de conferência do backend. */
export function checkTransition(
  order: { status: string; order_type: string; payment_status: string },
  target: OrderStatus,
): TransitionCheck {
  if (order.status === target) {
    return { allowed: false, reason: `O pedido já está em "${STATUS_LABELS[target]}".` };
  }

  const allowedTargets = TRANSITIONS[order.status];
  if (allowedTargets === undefined) {
    return { allowed: false, reason: `Status atual desconhecido: "${order.status}".` };
  }
  if (allowedTargets.length === 0) {
    return {
      allowed: false,
      reason: `"${STATUS_LABELS[order.status] ?? order.status}" é um estado final e não muda mais.`,
    };
  }
  if (!allowedTargets.includes(target)) {
    return {
      allowed: false,
      reason: `Não dá para ir de "${STATUS_LABELS[order.status]}" para "${STATUS_LABELS[target]}".`,
    };
  }
  if (target === 'out_for_delivery' && order.order_type !== 'delivery') {
    return { allowed: false, reason: 'Pedido de retirada não sai para entrega.' };
  }
  if (KITCHEN_STATUSES.includes(target) && isAwaitingOnlinePayment(order.payment_status)) {
    return {
      allowed: false,
      reason: 'Pagamento online ainda não confirmado. O pedido não pode ir para a cozinha.',
    };
  }

  return { allowed: true };
}

/** Destinos a oferecer como botão, na ordem em que o lojista costuma usar. */
export function nextStatusesFor(status: string): OrderStatus[] {
  return [...(TRANSITIONS[status] ?? [])];
}
