import type { OrderListItem } from '../api/types';
import type { Lane } from './board-lanes';
import { OrderCard } from './OrderCard';

/**
 * Uma FAIXA do quadro: cabeçalho à esquerda, fio até a margem, e os pedidos
 * correndo na horizontal.
 *
 * O cabeçalho é `is-<estágio>`, que vem de `tokens.css` e expõe `--st` de uma
 * vez — a cor da faixa nunca é escolhida aqui.
 *
 * FAIXA VAZIA NÃO ESCREVE NADA E NÃO OCUPA ALTURA. "Nenhum pedido" com um zero
 * no contador ao lado é a mesma informação dita duas vezes; e a área de
 * conteúdo vazia embaixo do título é pior que a frase, porque gasta altura da
 * dobra para não mostrar coisa nenhuma — no fim de um turno com duas faixas
 * zeradas, isso empurrava os pedidos de verdade para fora da tela.
 *
 * O que fica é a linha de título com o fio e o contador: ela diz que a faixa
 * existe e está vazia, em 14px de altura, sem afirmar nada.
 */
export function OrderLane({
  lane,
  orders,
  count,
  windowMinutes,
  selectedOrderId,
  onOpenOrder,
}: {
  lane: Lane;
  orders: OrderListItem[];
  count: number;
  windowMinutes: number | null;
  selectedOrderId: string | null;
  onOpenOrder: (orderId: string) => void;
}) {
  return (
    <section className={`faixa is-${lane.stage}`} data-lane={lane.key}>
      <header className="faixa__head">
        <span className="faixa__dot" aria-hidden="true" />
        <h2 className="faixa__title">{lane.title}</h2>
        {/*
          O contador vem de /admin/orders/status-counts e conta o FILTRO
          inteiro, não só o que está carregado nesta página. Por isso ele pode
          ser maior que o número de cartões ao lado.
        */}
        <span className="faixa__count" data-testid={`badge-${lane.key}`}>
          {count}
        </span>
        <span className="faixa__rule" aria-hidden="true" />
      </header>

      {/*
        O container só existe quando há cartão. Deixá-lo montado e vazio
        custaria o `gap` da faixa mesmo com altura zero — pouco por faixa, e
        exatamente o tipo de sobra que se acumula em três.
      */}
      {orders.length > 0 ? (
        <div className="faixa__cards">
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              windowMinutes={windowMinutes}
              isSelected={order.id === selectedOrderId}
              onOpen={() => onOpenOrder(order.id)}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
