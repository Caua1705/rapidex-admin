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
 *
 * ----------------------------------------------------------------------------
 * E JÁ QUE ESTE É O LUGAR: TODAS AS FRASES DE PAGAMENTO SAEM DAQUI
 * ----------------------------------------------------------------------------
 *
 * `paymentOutcome` devolve o rótulo da linha "Situação" E o aviso do topo,
 * inteiro, para os seis estados de `PAYMENT_STATUSES`. Não é centralização por
 * gosto: a distinção que mais custa nesta tela é entre `pending` e `in_review`
 * — duas esperas que travam a cozinha igual e pedem ligações opostas —, e ela
 * só sobrevive se houver um lugar só decidindo o que cada estado diz. Espalhada
 * pelos componentes, a segunda espera volta a ser escrita como a primeira.
 */
import type { OrderStatusHistoryEntry } from '../api/types';
import { PAYMENT_STATUS_LABELS, labelFor } from './format';
import { isAwaitingOnlinePayment } from './order-status';

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
   * O AVISO DO TOPO DO PAINEL — a frase inteira, não um pedaço dela.
   *
   * `null` quando não há nada a avisar: pagamento pago, ou a pagar na entrega.
   * Nos outros casos o texto sai daqui pronto, e é isto que impede que a mesma
   * espera ganhe duas frases diferentes conforme o componente que a desenha.
   *
   * O TOM TAMBÉM SAI DAQUI, pelo mesmo motivo de `stageOf()` em
   * `order-status.ts`: é aqui que se sabe o que o contrato do backend
   * significa. O painel só transforma o tom na classe do primitivo; ele não
   * sabe o que é um `charged_back` nem um `in_review`.
   */
  notice: { tone: 'error' | 'warn' | 'info'; text: string } | null;
};

/** O `payment_status` em que o valor pago voltou por inteiro. */
const REFUNDED = 'refunded';

/**
 * O antifraude do gateway segurou a cobrança para análise.
 *
 * SÓ ACONTECE COM CARTÃO — pix não passa por análise —, e é o estado que o
 * fluxo de cartão trouxe para o painel. Ele existe separado de `pending` no
 * backend por uma razão que é toda de tela: as duas esperas travam a cozinha
 * igual, mas pedem conversas OPOSTAS com o cliente (ver `PAYMENT_STATUS_LABELS`
 * em `format.ts`).
 */
const IN_REVIEW = 'in_review';

export function paymentOutcome(order: {
  payment_status: string;
  status_history: readonly OrderStatusHistoryEntry[];
}): PaymentOutcome {
  if (order.payment_status === REFUNDED) {
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

  if (order.payment_status === IN_REVIEW) {
    return {
      label: labelFor(PAYMENT_STATUS_LABELS, IN_REVIEW),
      notice: {
        // Atenção e não erro: nada deu errado, uma coisa está faltando
        // acontecer — que é exatamente o que `--alert` significa no sistema.
        tone: 'warn',
        // O GATEWAY É NOMEADO porque quem lê precisa saber onde a análise
        // corre para poder acompanhá-la. Em produção ele é sempre o Mercado
        // Pago; o provider `sandbox` também alcança este estado, mas só em
        // desenvolvimento, onde o nome errado não engana ninguém.
        text:
          'Cartão em análise antifraude do Mercado Pago. Não é o cliente que está devendo — ' +
          'ele já passou o cartão, e quem ainda não respondeu é o gateway. A análise pode ' +
          'levar até 48 horas úteis, e a cozinha não pode preparar este pedido até ela sair.',
      },
    };
  }

  const label = labelFor(PAYMENT_STATUS_LABELS, order.payment_status);

  /*
   * A ESPERA COMUM — o pix que ainda não caiu, o cartão recusado que o cliente
   * pode tentar de novo. Aqui a frase é sobre o que NÃO dá para fazer, e a
   * situação entre parênteses é o que diz qual das duas esperas é.
   */
  if (isAwaitingOnlinePayment(order.payment_status)) {
    return {
      label,
      notice: {
        tone: 'warn',
        text: `Pagamento online ainda não confirmado (${label}). A cozinha não pode preparar este pedido.`,
      },
    };
  }

  return { label, notice: null };
}
