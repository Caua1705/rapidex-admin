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
 * FAIXA VAZIA NÃO ESCREVE NADA. "Nenhum pedido" com um zero no contador ao
 * lado é a mesma informação dita duas vezes, e ela ocuparia a largura inteira
 * do quadro justamente no lugar onde o próximo pedido vai aparecer. O que fica
 * é o fio: ele mostra que a faixa existe e está vazia, sem afirmar nada.
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
    </section>
  );
}
