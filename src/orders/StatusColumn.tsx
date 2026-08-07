import type { OrderListItem } from '../api/types';
import type { BoardColumn } from './board-columns';
import { OrderCard } from './OrderCard';

/** Uma coluna do quadro: título, badge com o contador do backend e os cards. */
export function StatusColumn({
  column,
  orders,
  count,
  selectedOrderId,
  onOpenOrder,
}: {
  column: BoardColumn;
  orders: OrderListItem[];
  count: number;
  selectedOrderId: string | null;
  onOpenOrder: (orderId: string) => void;
}) {
  return (
    <section className="column" data-column={column.key}>
      <header className="column__header">
        <span className={`column__dot column__dot--${column.statuses[0]}`} />
        <h2 className="column__title">{column.title}</h2>
        {/*
          O contador vem de /admin/orders/status-counts e conta o FILTRO
          inteiro, não só o que está carregado nesta página. Por isso ele pode
          ser maior que o número de cards abaixo.
        */}
        <span className="column__badge" data-testid={`badge-${column.key}`}>
          {count}
        </span>
      </header>

      <div className="column__cards">
        {orders.length === 0 ? (
          <p className="column__empty faint">Nenhum pedido</p>
        ) : (
          orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              isSelected={order.id === selectedOrderId}
              onOpen={() => onOpenOrder(order.id)}
            />
          ))
        )}
      </div>
    </section>
  );
}
