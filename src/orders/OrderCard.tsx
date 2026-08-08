import type { OrderListItem } from '../api/types';
import {
  ORDER_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  formatCurrency,
  formatElapsed,
  formatTime,
  labelFor,
} from './format';
import { isAwaitingOnlinePayment } from './order-status';

/**
 * O card do pedido no quadro.
 *
 * Cada linha existe por um motivo operacional:
 *   nº e hora      — como o lojista chama o pedido no balcão;
 *   "há X min"     — o dado que decide o que fazer primeiro;
 *   cliente        — para conferir na entrega;
 *   tipo           — entrega e retirada têm fluxos diferentes;
 *   pagamento      — forma e situação, lado a lado, porque "Pix" sozinho não
 *                    diz se o dinheiro entrou;
 *   total          — conferência de caixa.
 */
export function OrderCard({
  order,
  isSelected,
  onOpen,
}: {
  order: OrderListItem;
  isSelected: boolean;
  onOpen: () => void;
}) {
  const awaitingPayment = isAwaitingOnlinePayment(order.payment_status);

  return (
    <button
      type="button"
      onClick={onOpen}
      className={[
        'order-card',
        // Pinta a borda esquerda com a matiz do status, pelos tokens.
        `status-${order.status}`,
        awaitingPayment ? 'order-card--unpaid' : '',
        isSelected ? 'order-card--selected' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-testid={`order-card-${order.order_number}`}
      data-status={order.status}
    >
      <div className="order-card__top">
        <strong className="order-card__number mono">#{order.order_number}</strong>
        <span className="faint">{formatTime(order.created_at)}</span>
        <span className="order-card__elapsed">{formatElapsed(order.created_at)}</span>
      </div>

      <div className="order-card__customer">{order.customer_name_snapshot}</div>

      <div className="order-card__tags">
        <span className={`tag tag--${order.order_type}`}>
          {labelFor(ORDER_TYPE_LABELS, order.order_type)}
        </span>
        <span className="tag">{labelFor(PAYMENT_METHOD_LABELS, order.payment_method)}</span>
      </div>

      {/*
        O destaque mais importante da tela: pagamento online que ainda não
        entrou. A cozinha não pode preparar — e o backend recusa o "aceitar"
        enquanto isso. Precisa ser visível de longe, não um ícone discreto.
      */}
      {awaitingPayment ? (
        // Sem emoji: o vermelho e a borda já gritam, e emoji some na
        // renderização de algumas telas de balcão.
        <div className="order-card__unpaid-banner">
          {labelFor(PAYMENT_STATUS_LABELS, order.payment_status)} — não preparar
        </div>
      ) : (
        <div className="order-card__payment faint">
          {labelFor(PAYMENT_STATUS_LABELS, order.payment_status)}
        </div>
      )}

      <div className="order-card__total mono">{formatCurrency(order.total)}</div>
    </button>
  );
}
