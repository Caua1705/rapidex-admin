import { OrderTicket } from '../ds/OrderTicket';
import type { OrderListItem } from '../api/types';
import {
  ORDER_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  elapsedMinutes,
  formatCurrency,
  formatElapsed,
  formatTime,
  labelFor,
} from './format';
import { isAwaitingOnlinePayment, stageOf } from './order-status';

/**
 * O PEDIDO NO QUADRO — e este arquivo é só o TRADUTOR.
 *
 * Havia dois componentes de pedido no projeto: `ds/OrderTicket`, que morava no
 * design system e só aparecia na galeria, e um `OrderCard` com marcação e CSS
 * próprios, que era o que o lojista via de verdade. Os dois desenhavam a mesma
 * coisa e já tinham divergido — hierarquia diferente, aviso de pagamento em
 * cor diferente, borda de estágio em espessura diferente.
 *
 * Agora existe UM só. `ds/OrderTicket` desenha; este arquivo faz a única coisa
 * que o design system não pode fazer, porque exigiria que ele conhecesse o
 * contrato da API: traduzir um `OrderListItem` para as propriedades do ticket.
 *
 * A fronteira é essa e ela vale a pena: `stageOf`, `isAwaitingOnlinePayment` e
 * os dicionários de rótulo são regra de PEDIDO. Se descessem para o `ds/`, o
 * design system passaria a precisar de `npm run api:generate` para compilar.
 */
export function OrderCard({
  order,
  windowMinutes = null,
  isSelected,
  onOpen,
}: {
  order: OrderListItem;
  /**
   * A janela de preparo da loja, em minutos — a régua da barra de maturação.
   * Sem ela a barra não aparece: uma barra sem régua mediria o nada.
   */
  windowMinutes?: number | null;
  isSelected: boolean;
  onOpen: () => void;
}) {
  const awaitingPayment = isAwaitingOnlinePayment(order.payment_status);

  return (
    <OrderTicket
      stage={stageOf(order.status)}
      number={order.order_number}
      elapsedLabel={formatElapsed(order.created_at)}
      elapsedMinutes={elapsedMinutes(order.created_at) ?? 0}
      windowMinutes={windowMinutes}
      timeLabel={formatTime(order.created_at)}
      customer={order.customer_name_snapshot}
      total={formatCurrency(order.total)}
      tags={[
        labelFor(ORDER_TYPE_LABELS, order.order_type),
        labelFor(PAYMENT_METHOD_LABELS, order.payment_method),
      ]}
      /*
       * O aviso que impede o preparo. A cozinha não pode começar e o backend
       * recusa o "aceitar" enquanto o pagamento online não entra — então ele é
       * uma linha própria dentro do ticket, e não mais uma etiqueta espremida
       * entre as outras, onde quebrava em três linhas de letra miúda.
       *
       * Quando o pagamento JÁ entrou, a situação dele vira etiqueta comum: é
       * conferência de caixa, não decisão.
       */
      alerta={
        awaitingPayment
          ? `${labelFor(PAYMENT_STATUS_LABELS, order.payment_status)} — não preparar`
          : undefined
      }
      extraTag={awaitingPayment ? undefined : labelFor(PAYMENT_STATUS_LABELS, order.payment_status)}
      selected={isSelected}
      onOpen={onOpen}
      data-testid={`order-card-${order.order_number}`}
      data-status={order.status}
    />
  );
}
