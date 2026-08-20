import { OrderRow } from '../ds/OrderRow';
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
 * O PEDIDO NA LISTA — e este arquivo é só o TRADUTOR.
 *
 * `ds/OrderRow` desenha; este arquivo faz a única coisa que o design system não
 * pode fazer, porque exigiria que ele conhecesse o contrato da API: traduzir um
 * `OrderListItem` para as propriedades da linha.
 *
 * A fronteira é essa e ela vale a pena: `stageOf`, `isAwaitingOnlinePayment` e
 * os dicionários de rótulo são regra de PEDIDO. Se descessem para o `ds/`, o
 * design system passaria a precisar de `npm run api:generate` para compilar.
 *
 * Ele se chamava `OrderCard` enquanto o pedido era um cartão. Não é mais.
 */
export function OrderLine({
  order,
  stageLabel,
  abreBloco = false,
  windowMinutes = null,
  isSelected,
  onOpen,
}: {
  order: OrderListItem;
  /**
   * O nome do estágio. Ver `ds/OrderRow`: no layout largo ele só aparece na
   * linha que ABRE o bloco; no compacto, em todas.
   */
  stageLabel: string;
  /** Esta linha abre um bloco de estágio. No histórico não há bloco. */
  abreBloco?: boolean;
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
    <OrderRow
      stage={stageOf(order.status)}
      stageLabel={stageLabel}
      abreBloco={abreBloco}
      number={order.order_number}
      elapsedLabel={formatElapsed(order.created_at)}
      elapsedMinutes={elapsedMinutes(order.created_at) ?? 0}
      windowMinutes={windowMinutes}
      timeLabel={formatTime(order.created_at)}
      customer={order.customer_name_snapshot}
      modalidade={labelFor(ORDER_TYPE_LABELS, order.order_type)}
      pagamento={labelFor(PAYMENT_METHOD_LABELS, order.payment_method)}
      /*
       * Quando o pagamento JÁ entrou, a situação dele é conferência de caixa e
       * fica embaixo da forma, em tinta de apoio. Quando não entrou, ela vira
       * o `alerta` e toma a célula inteira: a cozinha não pode começar e o
       * backend recusa o "aceitar" — é proibição, não atributo.
       */
      pagamentoNota={
        awaitingPayment ? undefined : labelFor(PAYMENT_STATUS_LABELS, order.payment_status)
      }
      /*
       * O ALERTA QUEBRA EM DUAS LINHAS POR DECISÃO, e não por acidente de
       * largura. Como texto corrido, "Aguardando pagamento — não preparar"
       * entrava numa célula de 124px e saía em TRÊS linhas irregulares,
       * esticando a linha inteira. Partido no travessão, ele tem a mesma
       * anatomia do caso normal — a situação em cima, o que fazer embaixo — e
       * o leitor de tela continua ouvindo a frase inteira.
       */
      alerta={
        awaitingPayment ? (
          <>
            <span className="ds-row__alerta-situacao">
              {labelFor(PAYMENT_STATUS_LABELS, order.payment_status)}
            </span>
            <span className="ds-row__alerta-acao">não preparar</span>
          </>
        ) : undefined
      }
      total={formatCurrency(order.total)}
      selected={isSelected}
      onOpen={onOpen}
      data-testid={`order-card-${order.order_number}`}
      data-status={order.status}
    />
  );
}
