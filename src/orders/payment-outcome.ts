/**
 * O DESFECHO DO DINHEIRO — e a diferença entre devolver e ser obrigado a
 * devolver.
 *
 * `payment_status` do pedido tem um valor só para as duas coisas: `refunded`.
 * O backend traduz de propósito, e a tradução mora em um lugar só
 * (`integrations/payment_gateway.py`), para o resto do sistema não sair
 * caçando "approved" e "charged_back" espalhados:
 *
 *   gateway `refunded`      → `refunded`   estorno: alguém devolveu o valor
 *   gateway `charged_back`  → `refunded`   CONTESTAÇÃO: o cliente abriu
 *                                          disputa no cartão e o emissor
 *                                          tirou o dinheiro de volta
 *
 * Para o painel, porém, os dois NÃO são o mesmo acontecimento. O primeiro é
 * uma decisão da casa (ou do cliente combinada com ela); o segundo é uma
 * disputa aberta contra a casa, chega sem aviso depois de o pedido já ter sido
 * entregue, e tem prazo de defesa junto ao gateway. Mostrar "Estornado" nos
 * dois casos esconde do lojista exatamente o caso em que ele precisa fazer
 * alguma coisa.
 *
 * ----------------------------------------------------------------------------
 * ONDE O DADO ESTÁ, JÁ QUE NÃO ESTÁ NO `payment_status`
 * ----------------------------------------------------------------------------
 *
 * No HISTÓRICO do pedido, que a rota de detalhe já devolve. Ao aplicar o
 * webhook, o `PaymentService` grava a linha com o status CRU do gateway na
 * nota (`f"status do gateway: {event.raw_status}"`) e o autor
 * (`gateway:mercadopago`). Nenhuma rota nova, nenhum campo novo: é o pedido
 * existente lido até o fim.
 *
 * NÃO É TEXTO LIVRE DO LOJISTA. A nota de cancelamento também vive nesta
 * tabela, e por isso a leitura aqui é ancorada duas vezes — no `status` da
 * linha (`payment:refunded`, o prefixo que o backend usa para separar evento
 * de dinheiro de status operacional) e no formato da nota. Uma linha de
 * cancelamento cujo motivo digitado fosse "status do gateway: charged_back"
 * não entra por nenhuma das duas.
 *
 * SE A NOTA NÃO DISSER NADA, É ESTORNO COMUM. Pedido antigo, `note` nula, ou
 * um gateway futuro que escreva de outro jeito: o painel afirma o que sabe
 * (voltou dinheiro) e não inventa a disputa. Errar para o lado da contestação
 * seria acusar o cliente com base em ausência de dado.
 */
import type { OrderStatusHistoryEntry } from '../api/types';
import { PAYMENT_STATUS_LABELS, labelFor } from './format';

/**
 * Como um evento de dinheiro aparece em `order_status_history.status` —
 * `PAYMENT_HISTORY_PREFIX` em `services/order_state_machine.py`. O prefixo é o
 * que impede um status operacional de ser lido como pagamento.
 */
const REFUNDED_HISTORY_STATUS = 'payment:refunded';

/** O status cru do gateway numa disputa aberta pelo cliente. */
const CHARGEBACK_GATEWAY_STATUS = 'charged_back';

/**
 * O formato exato da nota que o backend escreve. O `(detalhe)` opcional é o
 * desfecho síncrono do cartão (`status do gateway: approved (accredited)`) —
 * ele não chega em estorno, mas ler os dois formatos custa um grupo opcional e
 * evita que a leitura dependa de qual caminho gravou a linha.
 */
const GATEWAY_NOTE = /^\s*status do gateway:\s*([a-z_]+)/i;

/** O status cru do gateway numa linha do histórico, ou `null`. */
export function gatewayStatusOf(entry: OrderStatusHistoryEntry): string | null {
  const found = GATEWAY_NOTE.exec(entry.note ?? '');
  return found?.[1]?.toLowerCase() ?? null;
}

/** O dinheiro voltou porque o cliente contestou a cobrança? */
export function isChargeback(history: readonly OrderStatusHistoryEntry[]): boolean {
  return history.some(
    (entry) =>
      entry.status === REFUNDED_HISTORY_STATUS &&
      gatewayStatusOf(entry) === CHARGEBACK_GATEWAY_STATUS,
  );
}

export type PaymentOutcome = {
  /** O que a linha "Situação" do bloco Pagamento diz. */
  label: string;
  /**
   * O aviso do topo do painel, quando o dinheiro JÁ VOLTOU. `null` no resto —
   * inclusive no pagamento que ainda não chegou, que tem aviso próprio e outra
   * conversa ("a cozinha não pode começar").
   *
   * O TOM SAI DAQUI, e não do componente, pelo mesmo motivo de `stageOf()` em
   * `order-status.ts`: é aqui que se sabe o que o contrato do backend
   * significa. O painel só escolhe entre `alert--error` e `alert--info`; ele
   * não sabe o que é um `charged_back`.
   */
  notice: { tone: 'error' | 'info'; text: string } | null;
};

/** O `payment_status` em que o valor pago voltou por inteiro. */
const REFUNDED = 'refunded';

export function paymentOutcome(order: {
  payment_status: string;
  status_history: readonly OrderStatusHistoryEntry[];
}): PaymentOutcome {
  if (order.payment_status !== REFUNDED) {
    return { label: labelFor(PAYMENT_STATUS_LABELS, order.payment_status), notice: null };
  }

  if (isChargeback(order.status_history)) {
    return {
      label: 'Contestado pelo cliente',
      notice: {
        // Erro, e não atenção: é a única linha do painel que anuncia dinheiro
        // saindo de uma venda que já foi entregue.
        tone: 'error',
        text:
          'O cliente contestou esta cobrança no cartão e o valor foi devolvido a ele. ' +
          'Não foi a loja que estornou — a defesa da contestação corre no gateway, com prazo.',
      },
    };
  }

  return {
    label: labelFor(PAYMENT_STATUS_LABELS, REFUNDED),
    notice: {
      // Informação, e não erro: estorno é uma decisão, não um acidente.
      tone: 'info',
      text: 'O valor pago foi estornado ao cliente.',
    },
  };
}
