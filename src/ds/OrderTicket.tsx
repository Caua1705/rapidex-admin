import type { ReactNode } from 'react';

import { MaturationBar } from './MaturationBar';
import type { Stage } from './status';
import './OrderTicket.css';

/**
 * O TICKET DE PEDIDO — a unidade do quadro.
 *
 *   <OrderTicket
 *     stage="preparando"
 *     number={1042}
 *     elapsedLabel="62 min"
 *     elapsedMinutes={62}
 *     windowMinutes={100}
 *     customer="Marcos Lima"
 *     total="R$ 192,90"
 *     tags={['Entrega', 'Pix']}
 *     onOpen={abrir}
 *   />
 *
 * A HIERARQUIA DELE RESOLVE O PROBLEMA PRINCIPAL DA TELA ANTIGA, onde tudo
 * tinha o mesmo peso e o tempo decorrido — a informação que decide o que fazer
 * primeiro — ficava em cinza de 10px:
 *
 *   TEMPO DECORRIDO   22px/800, a maior tinta do cartão
 *   dinheiro          16px/800, porque é o que se confere no caixa
 *   cliente           corpo
 *   nº e hora         apoio, 12px em --ink-3 — é como o pedido é CHAMADO,
 *                     não como ele é decidido
 *
 * O número do pedido é o único texto do painel em mono: ele é o mesmo "#1042"
 * que sai na comanda impressa de 48 colunas, e a continuidade entre a tela e o
 * papel é o que faz o balcão e a cozinha falarem do mesmo pedido.
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
  alerta,
  selected = false,
  onOpen,
  'data-testid': testId,
}: {
  stage: Stage;
  number: number;
  /** "12 min", "1 h 20" — já formatado por quem sabe formatar. */
  elapsedLabel: string;
  elapsedMinutes: number;
  windowMinutes: number | null;
  /** A hora de entrada, "20:41". */
  timeLabel: string;
  customer: string;
  total: string;
  tags?: readonly string[];
  /**
   * O aviso que impede o preparo — hoje, pagamento online não recebido. Em
   * âmbar de `pendente`, NUNCA em vermelho: quase todo pedido de Pix passa por
   * este estado, e um alarme que pinta o normal deixa de ser alarme.
   */
  alerta?: ReactNode;
  selected?: boolean;
  onOpen: () => void;
  'data-testid'?: string;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid={testId}
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
          <span className="ds-ticket__tempo t-num">{elapsedLabel}</span>
          <span className="ds-ticket__total t-money">{total}</span>
        </span>

        <span className="ds-ticket__cliente t-body">{customer}</span>

        <span className="ds-ticket__meta">
          <span className="ds-ticket__numero t-code">#{number}</span>
          <span aria-hidden="true">·</span>
          <span>{timeLabel}</span>
          {tags.map((tag) => (
            <span className="ds-ticket__tag" key={tag}>
              {tag}
            </span>
          ))}
        </span>

        {alerta ? <span className="ds-ticket__alerta">{alerta}</span> : null}
      </span>
    </button>
  );
}
