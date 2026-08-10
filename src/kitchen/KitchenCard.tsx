import type { OrderDetail, OrderListItem } from '../api/types';
import { labelFor, ORDER_TYPE_LABELS } from '../orders/format';
import { readOptionGroups } from '../orders/order-options';
import { advanceFor } from './kitchen-board';
import { readWait, type PrepWindow } from './wait-time';

/**
 * O cartão da Cozinha.
 *
 * Grande e legível A DISTÂNCIA: quem lê está de pé, a um metro ou mais da tela,
 * com as mãos ocupadas. Por isso o número do pedido é enorme, os itens vêm em
 * corpo maior que o do resto do painel, e o botão ocupa a largura inteira do
 * cartão — é alvo de mão, não de mouse.
 *
 * O que NÃO está aqui é tão deliberado quanto o que está: nada de cliente,
 * telefone, endereço, forma de pagamento ou total. A cozinha monta prato; esses
 * dados são do balcão e só roubariam o espaço dos itens.
 *
 * Os adicionais aparecem recuados e agrupados, pela mesma razão do detalhe do
 * pedido: é o grupo que separa a TROCA de acompanhamento ("Acompanhamento:
 * espaguete") da PORÇÃO EXTRA ("Adicional: espaguete"). Achatados, a cozinha
 * monta o prato errado — e aqui é onde o prato é montado de verdade.
 */
export function KitchenCard({
  order,
  detail,
  prepWindow,
  now,
  isPending,
  errorMessage,
  onAdvance,
}: {
  order: OrderListItem;
  detail: OrderDetail | undefined;
  /** A faixa de preparo da filial: a régua do cronômetro. Ver `wait-time.ts`. */
  prepWindow: PrepWindow;
  /** O mesmo instante para todos os cartões do render. Ver `useNow`. */
  now: number;
  isPending: boolean;
  errorMessage: string | null;
  onAdvance: (target: string) => void;
}) {
  const advance = advanceFor(order);
  const wait = readWait(order.created_at, prepWindow, now);

  return (
    <article
      className={`kitchen-card status-${order.status}`}
      data-testid={`kitchen-card-${order.order_number}`}
      data-status={order.status}
      data-wait={wait.level}
    >
      <header className="kitchen-card__head">
        <strong className="kitchen-card__number mono">#{order.order_number}</strong>

        {/*
          O cronômetro é a informação nº 1 desta tela e por isso ele é a
          etiqueta que muda de cor — não o cartão inteiro. Pintar o cartão de
          vermelho apagaria a matiz de status na borda esquerda, que é o que
          diz em que etapa o prato está.
        */}
        <span
          className="kitchen-card__elapsed mono"
          data-testid={`kitchen-wait-${order.order_number}`}
          title={
            wait.level === 'late'
              ? 'Passou do tempo de preparo configurado para esta filial.'
              : undefined
          }
        >
          {wait.label}
        </span>

        <span className="kitchen-card__type">{labelFor(ORDER_TYPE_LABELS, order.order_type)}</span>
      </header>

      {detail ? (
        <ul className="kitchen-items">
          {detail.items.map((item) => {
            const groups = readOptionGroups(item);
            return (
              <li className="kitchen-items__row" key={item.id}>
                <div className="kitchen-items__main">
                  <span className="kitchen-items__qty mono">{item.quantity}×</span>
                  <span className="kitchen-items__name">{item.product_name_snapshot}</span>
                </div>

                {groups.length > 0 ? (
                  <ul className="kitchen-options">
                    {groups.map((group) => (
                      <li className="kitchen-options__group" key={group.key}>
                        {group.label ? (
                          <span className="kitchen-options__label">{group.label}:</span>
                        ) : null}
                        <span className="kitchen-options__values">
                          {group.options.map((option) => option.label).join(', ')}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {/* Observação do item é instrução direta para a chapa: sem
                    cebola, ponto da carne. Ela não pode ficar discreta. */}
                {item.observation ? (
                  <p className="kitchen-items__observation">{item.observation}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="kitchen-card__loading faint">Carregando os itens…</p>
      )}

      {detail?.notes ? <p className="kitchen-card__notes">{detail.notes}</p> : null}

      {errorMessage ? (
        <p className="alert alert--error kitchen-card__error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      {advance ? (
        <button
          type="button"
          className="btn btn--primary kitchen-card__action"
          disabled={isPending}
          onClick={() => onAdvance(advance.target)}
          data-testid={`kitchen-advance-${order.order_number}`}
        >
          {isPending ? 'Enviando…' : advance.label}
        </button>
      ) : null}
    </article>
  );
}
