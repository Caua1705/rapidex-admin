import type { ReactNode } from 'react';

import { MaturationBar } from './MaturationBar';
import type { Stage } from './status';
import './OrderTicket.css';

/**
 * O TICKET DE PEDIDO — a unidade do quadro, e o ÚNICO componente de pedido do
 * sistema.
 *
 *   <OrderTicket
 *     stage="preparando"
 *     number={1042}
 *     elapsedLabel="62 min"
 *     elapsedMinutes={62}
 *     windowMinutes={100}
 *     timeLabel="20:41"
 *     customer="Marcos Lima"
 *     total="R$ 192,90"
 *     tags={['Entrega', 'Pix']}
 *     onOpen={abrir}
 *   />
 *
 * Ele não conhece o contrato da API: quem traduz um `OrderListItem` para estas
 * propriedades é `orders/OrderCard`. Isso é o que permite ao `ds/` compilar
 * sem depender do `openapi.d.ts` gerado.
 *
 * A HIERARQUIA, que é o que ele resolve:
 *
 *   BARRA DE MATURAÇÃO  o fio de brasa no topo — lê-se de longe, sem ler nada
 *   TEMPO DECORRIDO     tabular, na matiz do estágio, a maior tinta do cartão
 *   dinheiro            tabular, porque é o que se confere no caixa
 *   cliente             corpo
 *   nº e hora           apoio — é como o pedido é CHAMADO, não como é decidido
 *
 * Tempo, dinheiro e nº levam `.tnum`: são os três números que se comparam
 * descendo a fila, e o "#1042" da tela é o mesmo que sai na comanda térmica.
 * A letra continua sendo a mesma Inter do resto do cartão — só o alinhamento
 * em coluna (`tabular-nums`) muda.
 *
 * O ticket inteiro é um `<button>`: abrir o detalhe é UMA ação, e um card
 * clicável feito de <div> com onClick é a forma mais comum de uma tela perder
 * o teclado.
 */
export function OrderTicket({
  stage,
  number,
  elapsedLabel,
  elapsedMinutes,
  windowMinutes,
  timeLabel,
  customer,
  total,
  tags = [],
  extraTag,
  alerta,
  selected = false,
  onOpen,
  'data-testid': testId,
  'data-status': dataStatus,
}: {
  stage: Stage;
  number: number;
  /** "12 min", "1h20" — já formatado por quem sabe formatar. */
  elapsedLabel: string;
  elapsedMinutes: number;
  /** A janela de preparo da loja. Sem ela, a barra de maturação não aparece. */
  windowMinutes: number | null;
  /** A hora de entrada, "20:41". */
  timeLabel: string;
  customer: string;
  total: string;
  tags?: readonly string[];
  /** Uma etiqueta que só existe em alguns pedidos (situação do pagamento). */
  extraTag?: string;
  /**
   * O aviso que IMPEDE o preparo — hoje, pagamento online não recebido. Em
   * âmbar de `pendente`, NUNCA em vermelho: quase todo pedido de Pix passa por
   * este estado, e um alarme que pinta o normal deixa de ser alarme.
   */
  alerta?: ReactNode;
  selected?: boolean;
  onOpen: () => void;
  'data-testid'?: string;
  'data-status'?: string;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid={testId}
      data-status={dataStatus}
      className={[
        'ds-ticket',
        `is-${stage}`,
        selected ? 'ds-ticket--selecionado' : '',
        alerta ? 'ds-ticket--alerta' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <MaturationBar elapsedMinutes={elapsedMinutes} windowMinutes={windowMinutes} />

      <span className="ds-ticket__corpo">
        <span className="ds-ticket__topo">
          {/* A maior tinta do cartão: é ela que decide o que fazer primeiro. */}
          <span className="ds-ticket__tempo tnum">{elapsedLabel}</span>
          <span className="ds-ticket__total tnum">{total}</span>
        </span>

        <span className="ds-ticket__cliente">{customer}</span>

        <span className="ds-ticket__meta">
          <span className="ds-ticket__numero tnum">#{number}</span>
          <span aria-hidden="true">·</span>
          <span className="tnum">{timeLabel}</span>
          {tags.map((tag) => (
            <span className="tag" key={tag}>
              {tag}
            </span>
          ))}
          {extraTag ? <span className="ds-ticket__pgto">{extraTag}</span> : null}
          {alerta ? <span className="ds-ticket__alerta">{alerta}</span> : null}
        </span>
      </span>
    </button>
  );
}
