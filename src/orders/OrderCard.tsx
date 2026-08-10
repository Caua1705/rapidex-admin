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
import { isAwaitingOnlinePayment, stageOf } from './order-status';

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
        `is-${stageOf(order.status)}`,
        awaitingPayment ? 'order-card--unpaid' : '',
        isSelected ? 'order-card--selected' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-testid={`order-card-${order.order_number}`}
      data-status={order.status}
    >
      {/*
        Nº, hora, cronômetro e total na MESMA linha. Os dois números que se
        comparam entre cards — o nº à esquerda e o total à direita — ficam na
        mesma linha de base e em mono tabular, então a coluna inteira se lê de
        cima a baixo sem o olho reancorar.
      */}
      <div className="order-card__top">
        <strong className="order-card__number tnum">#{order.order_number}</strong>
        <span className="faint">{formatTime(order.created_at)}</span>
        <span className="order-card__elapsed">{formatElapsed(order.created_at)}</span>
        <span className="order-card__total tnum">{formatCurrency(order.total)}</span>
      </div>

      <div className="order-card__customer">{order.customer_name_snapshot}</div>

      <div className="order-card__foot">
        <span className="order-card__tags">
          <span className="tag">{labelFor(ORDER_TYPE_LABELS, order.order_type)}</span>
          <span className="tag">{labelFor(PAYMENT_METHOD_LABELS, order.payment_method)}</span>
        </span>

        {!awaitingPayment ? (
          <span className="order-card__payment faint">
            {labelFor(PAYMENT_STATUS_LABELS, order.payment_status)}
          </span>
        ) : null}
      </div>

      {/*
        O destaque mais importante da tela: pagamento online que ainda não
        entrou. A cozinha não pode preparar — e o backend recusa o "aceitar"
        enquanto isso.

        Ele perdeu a caixa vermelha (o card inteiro já é vermelho) mas ficou
        numa LINHA PRÓPRIA: espremido ao lado das etiquetas, ele quebrava em
        três linhas de letra miúda e virava o texto menos legível do card, que
        é o oposto do que ele precisa ser.
      */}
      {awaitingPayment ? (
        <div className="order-card__unpaid-banner">
          {labelFor(PAYMENT_STATUS_LABELS, order.payment_status)} — não preparar
        </div>
      ) : null}
    </button>
  );
}
